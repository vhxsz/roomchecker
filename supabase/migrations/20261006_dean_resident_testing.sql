-- Allows any authenticated profile, including a Dean, to be a resident.
-- Self-verification remains prohibited by record_room_check.
begin;
create or replace function public.resident_assignment_operation(p_actor uuid,p_action text,p_body jsonb)
returns jsonb language plpgsql security definer set search_path=public as $$
declare destination rooms; resident uuid; result jsonb;
begin
 perform pg_advisory_xact_lock(20261005);
 if not exists(select 1 from profiles where id=p_actor and role='dean') then raise exception 'Dean permission required'; end if;
 if p_action not in ('assign_student','remove_assignment') then raise exception 'Unknown resident assignment action'; end if;
 resident:=(p_body->>'studentId')::uuid;
 if not exists(select 1 from profiles where id=resident) then raise exception 'User not found'; end if;
 if exists(select 1 from check_events where closed_at is null) then raise exception 'Close the current check before moving residents'; end if;
 if p_action='remove_assignment' then
  update room_assignments set active=false where student_id=resident and active;
  result:=jsonb_build_object('studentId',resident);
 else
  select * into destination from rooms where id=(p_body->>'roomId')::uuid;
  if not found or not destination.active then raise exception 'Select an active room'; end if;
  if exists(select 1 from room_assignments where student_id=resident and room_id=destination.id and active) then
   select to_jsonb(a.*) into result from room_assignments a where student_id=resident and active;
  else
   if (select count(*) from room_assignments where room_id=destination.id and active)>=destination.capacity then raise exception 'This room has no available beds'; end if;
   update room_assignments set active=false where student_id=resident and active;
   insert into room_assignments(room_id,student_id) values(destination.id,resident) returning to_jsonb(room_assignments.*) into result;
  end if;
 end if;
 insert into audit_logs(actor_id,action,entity_type,entity_id,metadata)
 values(p_actor,p_action,'resident',resident::text,p_body-'action');
 return result;
end $$;
revoke all on function public.resident_assignment_operation(uuid,text,jsonb) from public,anon,authenticated;
grant execute on function public.resident_assignment_operation(uuid,text,jsonb) to service_role;
commit;
