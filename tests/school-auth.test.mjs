import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import {PGlite} from '@electric-sql/pglite';
import {isSchoolEmail,isSchoolGoogleSession} from '../src/lib/school-auth.ts';

const token=method=>'e30.'+Buffer.from(JSON.stringify({amr:[{method}]})).toString('base64url')+'.signature';
const user={email:'student@kingsway.college',identities:[{provider:'google',identity_data:{email:'student@kingsway.college',email_verified:true}}]};
test('Only exact school emails and verified Google OAuth sessions pass the app policy',()=>{
 assert.equal(isSchoolGoogleSession(user,token('oauth')),true);
 assert.equal(isSchoolGoogleSession(user,token('password')),false);
 assert.equal(isSchoolGoogleSession(user,token('otp')),false);
 assert.equal(isSchoolGoogleSession({...user,email:'student@gmail.com'},token('oauth')),false);
 assert.equal(isSchoolGoogleSession({...user,identities:[]},token('oauth')),false);
 assert.equal(isSchoolGoogleSession({...user,identities:[{provider:'google',identity_data:{email:user.email,email_verified:false}}]},token('oauth')),false);
 for(const email of ['a@kingsway.college.evil.com','a@sub.kingsway.college','a@@kingsway.college',' a@kingsway.college','a@gmail.com'])assert.equal(isSchoolEmail(email),false);
 assert.equal(isSchoolEmail('Alex@KINGSWAY.COLLEGE'),true);
});
test('Database rejects unauthorized signup and protects existing data from password sessions',async()=>{
 const db=new PGlite();
 try{
  await db.exec(`create role anon;create role authenticated;create role service_role;create role supabase_auth_admin;
   create schema auth;create schema storage;
   create table auth.users(id uuid primary key,email text,raw_app_meta_data jsonb default '{}',raw_user_meta_data jsonb default '{}');
   create table auth.identities(user_id uuid,provider text,identity_data jsonb);
   create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
   create function auth.jwt() returns jsonb language sql stable as $$select coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb$$;
   create table storage.buckets(id text primary key,name text,public boolean);create table storage.objects(bucket_id text);alter table storage.objects enable row level security;`);
  await db.exec((await readFile(new URL('../supabase/schema.sql',import.meta.url),'utf8')).replace('create extension if not exists "pgcrypto";',''));
  await db.exec(await readFile(new URL('../supabase/migrations/20261005_school_google_only.sql',import.meta.url),'utf8'));
  for(const[email,provider]of [['a@gmail.com','google'],['a@kingsway.college','email'],['a@kingsway.college.evil.com','google']]){
   await assert.rejects(db.query('insert into auth.users(id,email,raw_app_meta_data) values($1,$2,$3)',[randomUUID(),email,JSON.stringify({provider})]),/Google account/);
   const response=(await db.query('select school_google_signup($1::jsonb) as result',[JSON.stringify({user:{email,app_metadata:{provider}}})])).rows[0].result;
   assert.equal(response.error.http_code,403);
  }
  const id=randomUUID();
  await db.query('insert into auth.users(id,email,raw_app_meta_data) values($1,$2,$3)',[id,user.email,JSON.stringify({provider:'google'})]);
  assert.equal((await db.query('select role from profiles where id=$1',[id])).rows[0].role,'student');
  await db.query("insert into auth.identities values($1,'google',$2)",[id,JSON.stringify(user.identities[0].identity_data)]);
  await db.exec('grant usage on schema public,auth to authenticated;grant select on all tables in schema public to authenticated');
  await db.query("select set_config('request.jwt.claim.sub',$1,false)",[id]);
  await db.query("select set_config('request.jwt.claims',$1,false)",[JSON.stringify({amr:[{method:'password'}]})]);
  await db.exec('set role authenticated');
  assert.equal((await db.query('select * from profiles')).rows.length,0);
  await db.exec('reset role');
  await db.query("select set_config('request.jwt.claims',$1,false)",[JSON.stringify({amr:[{method:'oauth'}]})]);
  await db.exec('set role authenticated');
  assert.equal((await db.query('select * from profiles')).rows.length,1);
  await db.exec('reset role');
 }finally{await db.close();}
});
