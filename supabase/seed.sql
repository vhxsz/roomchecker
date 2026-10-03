insert into public.check_templates (name, check_time, days_of_week, grace_minutes, active)
values
  ('Post-Worship Study Hall Check', '19:30', '{0,1,2,3,4}', 20, true),
  ('Night Room Check', '22:00', '{0,1,2,3,4,5,6}', 20, true)
on conflict do nothing;
