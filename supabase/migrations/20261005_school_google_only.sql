-- Apply after schema.sql and the residence operations migration.
-- Existing accounts/history are preserved, but non-school/non-OAuth sessions
-- can no longer access application data.
begin;
create or replace function public.school_google_signup(event jsonb) returns jsonb
language plpgsql immutable set search_path=public as $$
begin
 if coalesce(lower(event->'user'->>'email'),'') !~ '^[^[:space:]@]+@kingsway[.]college$'
 or coalesce(event->'user'->'app_metadata'->>'provider','')<>'google' then
  return jsonb_build_object('error',jsonb_build_object('http_code',403,'message','Use your @kingsway.college Google account to sign in.'));
 end if;
 return '{}'::jsonb;
end $$;
revoke all on function public.school_google_signup(jsonb) from public,anon,authenticated;
grant execute on function public.school_google_signup(jsonb) to supabase_auth_admin;

-- Always enforce creation even if the optional Before User Created Hook is
-- not configured yet. The hook provides a friendlier Auth error message.
create or replace function public.guard_school_signup() returns trigger
language plpgsql set search_path=public as $$
begin
 if coalesce(lower(new.email),'') !~ '^[^[:space:]@]+@kingsway[.]college$'
 or coalesce(new.raw_app_meta_data->>'provider','')<>'google' then
  raise exception 'Use your @kingsway.college Google account to sign in.' using errcode='42501';
 end if;
 return new;
end $$;
drop trigger if exists guard_school_signup on auth.users;
create trigger guard_school_signup before insert on auth.users for each row execute function public.guard_school_signup();

create or replace function public.school_session_allowed() returns boolean
language sql stable security definer set search_path=public as $$
 select exists(
  select 1 from auth.users u join auth.identities i on i.user_id=u.id
  where u.id=auth.uid() and lower(u.email) ~ '^[^[:space:]@]+@kingsway[.]college$'
   and i.provider='google' and i.identity_data->>'email_verified'='true'
   and lower(i.identity_data->>'email')=lower(u.email)
 ) and exists(select 1 from jsonb_array_elements(coalesce(auth.jwt()->'amr','[]'::jsonb)) a where a->>'method'='oauth')
$$;
revoke all on function public.school_session_allowed() from public,anon;
grant execute on function public.school_session_allowed() to authenticated;

do $$
declare relation text;
begin
 foreach relation in array array['profiles','floors','rooms','room_assignments','check_templates','check_events','verifications','audit_logs'] loop
  execute format('drop policy if exists "school Google sessions only" on public.%I',relation);
  execute format('create policy "school Google sessions only" on public.%I as restrictive for all to authenticated using (public.school_session_allowed()) with check (public.school_session_allowed())',relation);
 end loop;
 if to_regclass('public.maintenance_requests') is not null then
  execute 'drop policy if exists "school Google sessions only" on public.maintenance_requests';
  execute 'create policy "school Google sessions only" on public.maintenance_requests as restrictive for all to authenticated using (public.school_session_allowed()) with check (public.school_session_allowed())';
 end if;
end $$;
drop policy if exists "school Google photo sessions only" on storage.objects;
create policy "school Google photo sessions only" on storage.objects as restrictive for all to authenticated
 using(bucket_id<>'room-check-photos' or public.school_session_allowed())
 with check(bucket_id<>'room-check-photos' or public.school_session_allowed());
commit;
