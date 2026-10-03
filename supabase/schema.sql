create extension if not exists "pgcrypto";

create type public.user_role as enum ('dean', 'checker', 'student');
create type public.check_status as enum ('verified', 'photo_review', 'pending', 'absent');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role public.user_role not null default 'student',
  full_name text not null,
  email text not null unique,
  age integer check (age between 10 and 30),
  grade text,
  nationality text,
  student_code text unique default ('KWC-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 12))),
  created_at timestamptz not null default now()
);

create table public.floors (
  id uuid primary key default gen_random_uuid(),
  hall text not null,
  floor_number integer not null,
  label text not null,
  unique (hall, floor_number)
);

create table public.rooms (
  id uuid primary key default gen_random_uuid(),
  floor_id uuid not null references public.floors(id) on delete cascade,
  room_number text not null unique,
  capacity integer not null default 2 check (capacity > 0),
  checker_id uuid references public.profiles(id) on delete set null,
  active boolean not null default true
);

create table public.room_assignments (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms(id) on delete cascade,
  student_id uuid not null references public.profiles(id) on delete cascade,
  active boolean not null default true,
  assigned_at timestamptz not null default now(),
  unique (student_id, active)
);

create table public.check_templates (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  check_time time not null,
  days_of_week integer[] not null default '{0,1,2,3,4,5,6}',
  grace_minutes integer not null default 15,
  active boolean not null default true
);

create table public.check_events (
  id uuid primary key default gen_random_uuid(),
  template_id uuid references public.check_templates(id),
  scheduled_for timestamptz not null,
  opened_at timestamptz,
  closed_at timestamptz,
  created_by uuid references public.profiles(id)
);

create table public.verifications (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.check_events(id) on delete cascade,
  student_id uuid not null references public.profiles(id) on delete cascade,
  checker_id uuid not null references public.profiles(id),
  room_id uuid not null references public.rooms(id),
  method text not null check (method in ('qr', 'photo')),
  status public.check_status not null,
  photo_path text,
  notes text,
  verified_at timestamptz not null default now(),
  reviewed_by uuid references public.profiles(id),
  reviewed_at timestamptz,
  unique (event_id, student_id)
);

alter table public.profiles enable row level security;
alter table public.floors enable row level security;
alter table public.rooms enable row level security;
alter table public.room_assignments enable row level security;
alter table public.check_templates enable row level security;
alter table public.check_events enable row level security;
alter table public.verifications enable row level security;

create or replace function public.current_role() returns public.user_role language sql stable security definer set search_path = public as $$
  select role from public.profiles where id = auth.uid()
$$;

create policy "users read own profile" on public.profiles for select using (id = auth.uid() or public.current_role() in ('dean','checker'));
create policy "deans manage profiles" on public.profiles for all using (public.current_role() = 'dean') with check (public.current_role() = 'dean');
create policy "authenticated read floors" on public.floors for select to authenticated using (true);
create policy "deans manage floors" on public.floors for all using (public.current_role() = 'dean') with check (public.current_role() = 'dean');
create policy "authenticated read rooms" on public.rooms for select to authenticated using (true);
create policy "deans manage rooms" on public.rooms for all using (public.current_role() = 'dean') with check (public.current_role() = 'dean');
create policy "staff read assignments" on public.room_assignments for select using (public.current_role() in ('dean','checker') or student_id = auth.uid());
create policy "deans manage assignments" on public.room_assignments for all using (public.current_role() = 'dean') with check (public.current_role() = 'dean');
create policy "authenticated read templates" on public.check_templates for select to authenticated using (true);
create policy "deans manage templates" on public.check_templates for all using (public.current_role() = 'dean') with check (public.current_role() = 'dean');
create policy "staff read events" on public.check_events for select using (public.current_role() in ('dean','checker'));
create policy "deans manage events" on public.check_events for all using (public.current_role() = 'dean') with check (public.current_role() = 'dean');
create policy "verification visibility" on public.verifications for select using (public.current_role() in ('dean','checker') or student_id = auth.uid());
create policy "checkers create verification" on public.verifications for insert with check (public.current_role() in ('checker','dean') and checker_id = auth.uid());
create policy "deans review verification" on public.verifications for update using (public.current_role() = 'dean');

insert into storage.buckets (id, name, public) values ('room-check-photos','room-check-photos',false) on conflict do nothing;
create policy "staff upload evidence" on storage.objects for insert to authenticated with check (bucket_id='room-check-photos' and public.current_role() in ('checker','dean'));
create policy "deans view evidence" on storage.objects for select to authenticated using (bucket_id='room-check-photos' and public.current_role()='dean');

create table public.audit_logs (
  id bigint generated always as identity primary key,
  actor_id uuid references public.profiles(id) on delete set null,
  action text not null,
  entity_type text not null,
  entity_id text,
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now()
);
alter table public.audit_logs enable row level security;
create policy "deans read audit logs" on public.audit_logs for select using (public.current_role() = 'dean');
create policy "staff write audit logs" on public.audit_logs for insert with check (actor_id = auth.uid() and public.current_role() in ('dean','checker'));

create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, role, full_name, email)
  values (
    new.id,
    'student',
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)),
    new.email
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users for each row execute procedure public.handle_new_user();

create index room_assignments_student_active_idx on public.room_assignments(student_id, active);
create index rooms_checker_idx on public.rooms(checker_id);
create index check_events_schedule_idx on public.check_events(scheduled_for desc);
create index verifications_event_status_idx on public.verifications(event_id, status);
create index audit_logs_created_idx on public.audit_logs(created_at desc);
