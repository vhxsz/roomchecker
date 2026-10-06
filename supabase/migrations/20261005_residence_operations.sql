-- Run after schema.sql on new projects, or once on an existing project.
begin;

create table if not exists public.maintenance_requests (
 id uuid primary key default gen_random_uuid(),
 room_id uuid not null references public.rooms(id),
 reported_by uuid references public.profiles(id) on delete set null,
 title text not null check (length(title) between 3 and 120),
 description text not null check (length(description) between 10 and 2000),
 priority text not null check (priority in ('normal','urgent')),
 status text not null default 'open' check (status in ('open','in_progress','resolved')),
 resolution text,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
alter table public.maintenance_requests enable row level security;
create policy "request visibility" on public.maintenance_requests for select to authenticated
 using (reported_by=auth.uid() or public.current_role()='dean' or exists (
 select 1 from public.rooms r where r.id=room_id and r.checker_id=auth.uid()));
create index maintenance_status_idx on public.maintenance_requests(status,created_at desc);
create index if not exists verifications_pending_review_idx on public.verifications(verified_at) where status='photo_review';

-- All mutations go through authenticated server routes; no browser bypass of
-- role guards, room capacity, signed QR verification or photo review.
drop policy if exists "deans manage profiles" on public.profiles;
drop policy if exists "deans manage floors" on public.floors;
drop policy if exists "deans manage rooms" on public.rooms;
drop policy if exists "deans manage assignments" on public.room_assignments;
drop policy if exists "deans manage templates" on public.check_templates;
drop policy if exists "deans manage events" on public.check_events;
drop policy if exists "checkers create verification" on public.verifications;
drop policy if exists "deans review verification" on public.verifications;
drop policy if exists "staff write audit logs" on public.audit_logs;
drop policy if exists "staff upload evidence" on storage.objects;
drop policy if exists "staff read assignments" on public.room_assignments;
create policy "assigned room visibility" on public.room_assignments for select to authenticated
 using (student_id=auth.uid() or public.current_role()='dean' or exists (
 select 1 from public.rooms r where r.id=room_id and r.checker_id=auth.uid()));
drop policy if exists "verification visibility" on public.verifications;
create policy "verification visibility" on public.verifications for select to authenticated
 using (student_id=auth.uid() or public.current_role()='dean' or exists (
 select 1 from public.rooms r where r.id=room_id and r.checker_id=auth.uid()));
drop policy if exists "users read own profile" on public.profiles;
create policy "users read own profile" on public.profiles for select to authenticated
 using (id=auth.uid() or public.current_role()='dean' or exists (
 select 1 from public.room_assignments a join public.rooms r on r.id=a.room_id
 where a.student_id=profiles.id and a.active and r.checker_id=auth.uid()));

-- Serialize residence mutations. At school scale this small transaction lock
-- avoids transfers, role changes, room edits and session closure racing.
create or replace function public.lock_residence_write() returns trigger
language plpgsql set search_path=public as $$
begin
 perform pg_advisory_xact_lock(20261005);
 return null;
end $$;
create trigger residence_rooms_lock before insert or update or delete on public.rooms
 for each statement execute function public.lock_residence_write();
create trigger residence_assignments_lock before insert or update or delete on public.room_assignments
 for each statement execute function public.lock_residence_write();
create trigger residence_profiles_lock before insert or update or delete on public.profiles
 for each statement execute function public.lock_residence_write();

create or replace function public.guard_profile_delete() returns trigger
language plpgsql set search_path=public as $$
begin
 if old.role='dean' and (select count(*) from profiles where role='dean')<=1 then raise exception 'The last Dean cannot be deleted'; end if;
 if exists(select 1 from check_events where closed_at is null) and exists(select 1 from room_assignments where student_id=old.id and active)
 then raise exception 'Close the current check before deleting a resident'; end if;
 if exists(select 1 from check_events where created_by=old.id) or exists(select 1 from verifications where student_id=old.id or checker_id=old.id or reviewed_by=old.id)
 then raise exception 'This user has attendance history. Remove checker permissions or demote the account instead of deleting it.'; end if;
 return old;
end $$;
create trigger guard_profile_delete before delete on public.profiles for each row execute function public.guard_profile_delete();

create or replace function public.guard_room() returns trigger
language plpgsql set search_path=public as $$
declare residents integer;
begin
 if new.capacity not between 1 and 8 then raise exception 'Capacity must be between 1 and 8'; end if;
 if new.checker_id is not null and not exists (select 1 from profiles where id=new.checker_id and role='checker')
 then raise exception 'Assigned user must be a Checker'; end if;
 select count(*) into residents from room_assignments where room_id=new.id and active;
 if residents>new.capacity then raise exception 'Capacity is below current occupancy'; end if;
 if not new.active and residents>0 then raise exception 'Move residents before deactivating a room'; end if;
 return new;
end $$;
create trigger guard_room before insert or update on public.rooms for each row execute function public.guard_room();

create or replace function public.residence_operation(p_actor uuid,p_action text,p_body jsonb)
returns jsonb language plpgsql security definer set search_path=public as $$
declare target uuid; checker uuid; room_ids uuid[]; target_role user_role;
 result jsonb; destination rooms; resident uuid; session check_events;
begin
 perform pg_advisory_xact_lock(20261005);
 if not exists(select 1 from profiles where id=p_actor and role='dean') then raise exception 'Dean permission required'; end if;
 if p_action='set_role' then
  target:=(p_body->>'id')::uuid; target_role:=(p_body->>'role')::user_role;
  if target=p_actor then raise exception 'You cannot change your own role'; end if;
  if not exists(select 1 from profiles where id=target) then raise exception 'User not found'; end if;
  if target_role<>'dean' and exists(select 1 from profiles where id=target and role='dean')
   and (select count(*) from profiles where role='dean')<=1 then raise exception 'The last Dean cannot be demoted'; end if;
  if target_role<>'checker' then update rooms set checker_id=null where checker_id=target; end if;
  -- A student worker remains a resident when promoted or demoted.
  update profiles set role=target_role where id=target returning to_jsonb(profiles.*) into result;
 elsif p_action='set_checker_rooms' then
  checker:=(p_body->>'checkerId')::uuid;
  select coalesce(array_agg(distinct value::uuid),'{}'::uuid[]) into room_ids from jsonb_array_elements_text(p_body->'roomIds');
  if not exists(select 1 from profiles where id=checker and role='checker') then raise exception 'Only Checkers can be assigned rooms'; end if;
  if (select count(*) from rooms where id=any(room_ids) and active)<>cardinality(room_ids) then raise exception 'Select existing active rooms'; end if;
  update rooms set checker_id=null where checker_id=checker and not(id=any(room_ids));
  update rooms set checker_id=checker where id=any(room_ids);
  result:=jsonb_build_object('id',checker,'rooms',room_ids);
 elsif p_action='assign_student' then
  resident:=(p_body->>'studentId')::uuid;
  if not exists(select 1 from profiles where id=resident and role in ('student','checker')) then raise exception 'Only resident students or Checkers can occupy rooms'; end if;
  if exists(select 1 from check_events where closed_at is null) then raise exception 'Close the current check before moving residents'; end if;
  select * into destination from rooms where id=(p_body->>'roomId')::uuid;
  if not found or not destination.active then raise exception 'Select an active room'; end if;
  if exists(select 1 from room_assignments where student_id=resident and room_id=destination.id and active) then
   select to_jsonb(a.*) into result from room_assignments a where student_id=resident and active;
  else
   if (select count(*) from room_assignments where room_id=destination.id and active)>=destination.capacity then raise exception 'This room has no available beds'; end if;
   update room_assignments set active=false where student_id=resident and active;
   insert into room_assignments(room_id,student_id) values(destination.id,resident) returning to_jsonb(room_assignments.*) into result;
  end if;
 elsif p_action='remove_assignment' then
  if exists(select 1 from check_events where closed_at is null) then raise exception 'Close the current check before moving residents'; end if;
  update room_assignments set active=false where student_id=(p_body->>'studentId')::uuid and active;
  result:=p_body;
 elsif p_action='open_event' then
  if not exists(select 1 from check_templates where id=(p_body->>'templateId')::uuid and active) then raise exception 'This schedule is disabled'; end if;
  insert into check_events(template_id,scheduled_for,opened_at,created_by)
   values((p_body->>'templateId')::uuid,now(),now(),p_actor) returning to_jsonb(check_events.*) into result;
 elsif p_action='close_event' then
  select * into session from check_events where id=(p_body->>'id')::uuid;
  if not found or session.closed_at is not null then raise exception 'This session is already closed'; end if;
  insert into verifications(event_id,student_id,checker_id,room_id,method,status)
   select session.id,a.student_id,p_actor,a.room_id,'qr','absent' from room_assignments a join rooms r on r.id=a.room_id
   where a.active and r.active on conflict(event_id,student_id) do nothing;
  update check_events set closed_at=now() where id=session.id returning to_jsonb(check_events.*) into result;
 else raise exception 'Unknown residence action'; end if;
 insert into audit_logs(actor_id,action,entity_type,entity_id,metadata)
  values(p_actor,p_action,'residence',result->>'id',p_body-'action');
 return result;
end $$;
revoke all on function public.residence_operation(uuid,text,jsonb) from public,anon,authenticated;
grant execute on function public.residence_operation(uuid,text,jsonb) to service_role;

create or replace function public.record_room_check(p_actor uuid,p_student uuid,p_room uuid,p_event uuid,p_method text,p_photo text default null,p_notes text default null)
returns jsonb language plpgsql security definer set search_path=public as $$
declare actor_role user_role; result jsonb;
begin
 perform pg_advisory_xact_lock(20261005);
 select role into actor_role from profiles where id=p_actor;
 if actor_role is null or actor_role not in ('dean','checker') then raise exception 'Checker permission required'; end if;
 if p_actor=p_student then raise exception 'You cannot verify your own attendance'; end if;
 if not exists(select 1 from rooms where id=p_room and active and (actor_role='dean' or checker_id=p_actor)) then raise exception 'This room is not assigned to this checker'; end if;
 if not exists(select 1 from check_events where id=p_event and opened_at is not null and closed_at is null) then raise exception 'Room check session is not open'; end if;
 if exists(select 1 from check_events e join check_templates t on t.id=e.template_id where e.id=p_event and now()>e.opened_at+make_interval(mins=>t.grace_minutes))
 then raise exception 'The verification window has expired. Ask the Dean to close this session.'; end if;
 if not exists(select 1 from room_assignments where room_id=p_room and student_id=p_student and active) then raise exception 'Student is not assigned to this room'; end if;
 if p_method not in ('qr','photo') or (p_method='photo' and p_photo is null) then raise exception 'Invalid verification method'; end if;
 if exists(select 1 from verifications where event_id=p_event and student_id=p_student and status='verified') then raise exception 'Student is already verified'; end if;
 insert into verifications(event_id,student_id,checker_id,room_id,method,status,photo_path,notes)
 values(p_event,p_student,p_actor,p_room,p_method,case when p_method='qr' then 'verified'::check_status else 'photo_review'::check_status end,p_photo,p_notes)
 on conflict(event_id,student_id) do update set method=excluded.method,status=excluded.status,checker_id=excluded.checker_id,
 photo_path=excluded.photo_path,notes=excluded.notes,verified_at=now(),reviewed_by=null,reviewed_at=null
 returning to_jsonb(verifications.*) into result;
 insert into audit_logs(actor_id,action,entity_type,entity_id,metadata) values(p_actor,'record_'||p_method,'verification',result->>'id',jsonb_build_object('roomId',p_room,'studentId',p_student));
 return result;
end $$;
revoke all on function public.record_room_check(uuid,uuid,uuid,uuid,text,text,text) from public,anon,authenticated;
grant execute on function public.record_room_check(uuid,uuid,uuid,uuid,text,text,text) to service_role;
commit;
