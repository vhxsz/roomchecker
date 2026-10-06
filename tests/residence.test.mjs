import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { PGlite } from '@electric-sql/pglite';

test('Residence database permissions and transactional workflows',async t=>{
 const db=new PGlite();
 try{
  await db.exec(`create role anon;create role authenticated;create role service_role;
   create schema auth;create schema storage;
   create table auth.users(id uuid primary key,email text,raw_user_meta_data jsonb default '{}');
   create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
   create table storage.buckets(id text primary key,name text,public boolean);
   create table storage.objects(id uuid default gen_random_uuid(),bucket_id text);
   alter table storage.objects enable row level security;`);
  const schema=await readFile(new URL('../supabase/schema.sql',import.meta.url),'utf8');
  await db.exec(schema.replace('create extension if not exists "pgcrypto";',''));
  await db.exec(await readFile(new URL('../supabase/migrations/20261005_residence_operations.sql',import.meta.url),'utf8'));
  const dean=randomUUID(),checker=randomUUID(),student=randomUUID(),other=randomUUID(),floor=randomUUID(),roomA=randomUUID(),roomB=randomUUID(),template=randomUUID();
  for(const[id,role]of [[dean,'dean'],[checker,'checker'],[student,'student'],[other,'student']]){
   await db.query('insert into auth.users(id,email) values($1,$2)',[id,`${role}-${id}@test.school`]);
   await db.query('update profiles set role=$2 where id=$1',[id,role]);
  }
  await db.query("insert into floors(id,hall,floor_number,label) values($1,'North',1,'First')",[floor]);
  await db.query("insert into rooms(id,floor_id,room_number,capacity) values($1,$3,'101',1),($2,$3,'102',2)",[roomA,roomB,floor]);
  await db.query("insert into check_templates(id,name,check_time) values($1,'Night','22:00')",[template]);
  const op=async(actor,action,body)=>(await db.query('select residence_operation($1,$2,$3::jsonb) as result',[actor,action,JSON.stringify(body)])).rows[0].result;
  const record=async(actor,who,room,event,method='qr')=>(await db.query('select record_room_check($1,$2,$3,$4,$5,$6,null) as result',[actor,who,room,event,method,method==='photo'?'test/photo.jpg':null])).rows[0].result;

  await t.test('Dean assigns students, transfers atomically, prevents overcapacity',async()=>{
   await op(dean,'assign_student',{studentId:student,roomId:roomA});
   await op(dean,'assign_student',{studentId:other,roomId:roomB});
   await assert.rejects(op(dean,'assign_student',{studentId:other,roomId:roomA}),/available beds/);
   const rows=(await db.query('select room_id from room_assignments where student_id=$1 and active',[other])).rows;
   assert.equal(rows.length,1);assert.equal(rows[0].room_id,roomB);
   await op(dean,'assign_student',{studentId:student,roomId:roomA}); // idempotent
  });
  await t.test('Promoting a resident preserves their room; students cannot promote users',async()=>{
   await op(dean,'set_role',{id:student,role:'checker'});
   assert.equal((await db.query('select count(*)::int as n from room_assignments where student_id=$1 and active',[student])).rows[0].n,1);
   await assert.rejects(op(other,'set_role',{id:checker,role:'dean'}),/Dean permission/);
   await assert.rejects(op(dean,'set_role',{id:dean,role:'student'}),/own role/);
  });
  await t.test('Invalid bulk assignment rolls back; demotion revokes coverage',async()=>{
   await op(dean,'set_checker_rooms',{checkerId:student,roomIds:[roomA,roomB]});
   await assert.rejects(op(dean,'set_checker_rooms',{checkerId:student,roomIds:[randomUUID()]}),/active rooms/);
   assert.equal((await db.query('select count(*)::int as n from rooms where checker_id=$1',[student])).rows[0].n,2);
   await op(dean,'set_role',{id:student,role:'student'});
   assert.equal((await db.query('select count(*)::int as n from rooms where checker_id=$1',[student])).rows[0].n,0);
   await op(dean,'set_checker_rooms',{checkerId:checker,roomIds:[roomA]});
  });
  await t.test('Room edits validate checker role, occupancy and activation',async()=>{
   await assert.rejects(db.query('update rooms set checker_id=$1 where id=$2',[other,roomB]),/must be a Checker/);
   await assert.rejects(db.query('update rooms set active=false where id=$1',[roomA]),/Move residents/);
   await assert.rejects(db.query('update rooms set capacity=0 where id=$1',[roomA]),/Capacity/);
  });
  const event=await op(dean,'open_event',{templateId:template});
  await t.test('Session roster is stable and cannot be moved mid-check',async()=>{
   await assert.rejects(op(dean,'assign_student',{studentId:student,roomId:roomB}),/Close the current check/);
   await assert.rejects(op(dean,'remove_assignment',{studentId:student}),/Close the current check/);
   await assert.rejects(op(dean,'open_event',{templateId:template}),/unique/);
  });
  await t.test('QR verification requires an assigned room and independent checker',async()=>{
   await assert.rejects(record(checker,other,roomB,event.id),/not assigned/);
   await assert.rejects(record(checker,checker,roomA,event.id),/own attendance/);
   await assert.rejects(record(student,student,roomA,event.id),/Checker permission/);
   const verified=await record(checker,student,roomA,event.id);
   assert.equal(verified.status,'verified');
   await assert.rejects(record(checker,student,roomA,event.id,'photo'),/already verified/);
  });
  await t.test('Session closure records absences and rejects late verifications',async()=>{
   await op(dean,'close_event',{id:event.id});
   const absence=(await db.query('select status from verifications where event_id=$1 and student_id=$2',[event.id,other])).rows[0];
   assert.equal(absence.status,'absent');
   await assert.rejects(record(dean,other,roomB,event.id),/not open/);
  });
  await t.test('Browser RLS disallows fake attendance and role escalation',async()=>{
   await db.exec('grant usage on schema public,auth to authenticated;grant all on all tables in schema public to authenticated;grant usage,select on all sequences in schema public to authenticated;');
   await db.query("select set_config('request.jwt.claim.sub',$1,false)",[checker]);
   await db.exec('set role authenticated');
   try{
    await assert.rejects(db.query("insert into verifications(event_id,student_id,checker_id,room_id,method,status) values($1,$2,$3,$4,'qr','verified')",[event.id,other,checker,roomB]),/row-level security/);
    await assert.rejects(db.query("select residence_operation($1,'set_role',$2::jsonb)",[checker,JSON.stringify({id:checker,role:'dean'})]),/permission denied/);
    assert.equal((await db.query("update profiles set role='dean' where id=$1 returning id",[checker])).rows.length,0);
    assert.equal((await db.query('select student_id from room_assignments where active')).rows.length,1);
    assert.equal((await db.query('select student_id from verifications')).rows.length,1);
   }finally{await db.exec('reset role');}
  });
  await t.test('Photo evidence starts pending and records an audit trail',async()=>{
   const second=await op(dean,'open_event',{templateId:template});
   const photo=await record(dean,other,roomB,second.id,'photo');
   assert.equal(photo.status,'photo_review');
   assert.equal(photo.photo_path,'test/photo.jpg');
   assert.ok((await db.query("select id from audit_logs where action='record_photo'")).rows.length);
  });
  await t.test('Verification window expires and historical accounts are protected',async()=>{
   await db.exec("update check_events set opened_at=now()-interval '3 hours' where closed_at is null");
   const open=(await db.query('select id from check_events where closed_at is null')).rows[0];
   await assert.rejects(record(checker,student,roomA,open.id),/window has expired/);
   await assert.rejects(db.query('delete from profiles where id=$1',[dean]),/last Dean/);
   await assert.rejects(db.query('delete from profiles where id=$1',[checker]),/attendance history/);
  });
 }finally{await db.close();}
});
