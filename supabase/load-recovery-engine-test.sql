-- Manual sanity test for the split load/recovery migration files.
-- Run after the migration. This creates isolated test rows inside a
-- transaction and rolls them back at the end.

begin;

insert into public.coaches (id, email, name, school_name)
values (
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  'load-engine-test-coach',
  'Load Engine Test Coach',
  'Hersemita Test School'
)
on conflict (id) do nothing;

insert into public.runners (
  id,
  coach_id,
  first_name,
  last_name,
  grade,
  parent_phone,
  garmin_user_id,
  access_code,
  username
)
values (
  'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  'Load',
  'Tester',
  11,
  null,
  'load-engine-test-runner',
  '123456',
  'load_engine_test_runner'
)
on conflict (id) do nothing;

-- These 11 activity inserts are intentionally simple:
-- activity_date = 2026-05-11
-- acute window = 2026-05-05 through 2026-05-11
-- chronic window = 2026-04-14 through 2026-05-11
--
-- Last 7 days: 50, 50, 50, 50, 50, 50, 100 = acute_load 400
-- Last 28 days total: 600, so chronic_load = 600 / 4 = 150
-- ACWR = 400 / 150 = 2.67
-- Monotony = avg([50,50,50,50,50,50,100]) / stddev_samp(...) = 3.02
-- Strain = 400 * 3.023715... = 1209.49, rounded by SQL from full precision

insert into public.activities (
  runner_id,
  garmin_activity_id,
  distance_miles,
  duration_seconds,
  pace_per_mile,
  start_time,
  verified,
  training_load,
  training_load_source
)
values ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'load_test_2026_04_14', 4, 1800, 450, '2026-04-14T12:00:00Z', true, 40, 'manual');

insert into public.activities (
  runner_id,
  garmin_activity_id,
  distance_miles,
  duration_seconds,
  pace_per_mile,
  start_time,
  verified,
  training_load,
  training_load_source
)
values ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'load_test_2026_04_21', 5, 2250, 450, '2026-04-21T12:00:00Z', true, 50, 'manual');

insert into public.activities (
  runner_id,
  garmin_activity_id,
  distance_miles,
  duration_seconds,
  pace_per_mile,
  start_time,
  verified,
  training_load,
  training_load_source
)
values ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'load_test_2026_04_28', 6, 2700, 450, '2026-04-28T12:00:00Z', true, 60, 'manual');

insert into public.activities (
  runner_id,
  garmin_activity_id,
  distance_miles,
  duration_seconds,
  pace_per_mile,
  start_time,
  verified,
  training_load,
  training_load_source
)
values ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'load_test_2026_05_04', 5, 2250, 450, '2026-05-04T12:00:00Z', true, 50, 'manual');

insert into public.activities (
  runner_id,
  garmin_activity_id,
  distance_miles,
  duration_seconds,
  pace_per_mile,
  start_time,
  verified,
  training_load,
  training_load_source
)
values ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'load_test_2026_05_05', 5, 2250, 450, '2026-05-05T12:00:00Z', true, 50, 'manual');

insert into public.activities (
  runner_id,
  garmin_activity_id,
  distance_miles,
  duration_seconds,
  pace_per_mile,
  start_time,
  verified,
  training_load,
  training_load_source
)
values ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'load_test_2026_05_06', 5, 2250, 450, '2026-05-06T12:00:00Z', true, 50, 'manual');

insert into public.activities (
  runner_id,
  garmin_activity_id,
  distance_miles,
  duration_seconds,
  pace_per_mile,
  start_time,
  verified,
  training_load,
  training_load_source
)
values ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'load_test_2026_05_07', 5, 2250, 450, '2026-05-07T12:00:00Z', true, 50, 'manual');

insert into public.activities (
  runner_id,
  garmin_activity_id,
  distance_miles,
  duration_seconds,
  pace_per_mile,
  start_time,
  verified,
  training_load,
  training_load_source
)
values ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'load_test_2026_05_08', 5, 2250, 450, '2026-05-08T12:00:00Z', true, 50, 'manual');

insert into public.activities (
  runner_id,
  garmin_activity_id,
  distance_miles,
  duration_seconds,
  pace_per_mile,
  start_time,
  verified,
  training_load,
  training_load_source
)
values ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'load_test_2026_05_09', 5, 2250, 450, '2026-05-09T12:00:00Z', true, 50, 'manual');

insert into public.activities (
  runner_id,
  garmin_activity_id,
  distance_miles,
  duration_seconds,
  pace_per_mile,
  start_time,
  verified,
  training_load,
  training_load_source
)
values ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'load_test_2026_05_10', 5, 2250, 450, '2026-05-10T12:00:00Z', true, 50, 'manual');

insert into public.activities (
  runner_id,
  garmin_activity_id,
  distance_miles,
  duration_seconds,
  pace_per_mile,
  start_time,
  verified,
  training_load,
  training_load_source
)
values ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'load_test_2026_05_11', 8, 3600, 450, '2026-05-11T12:00:00Z', true, 100, 'manual');

-- Expected final row:
-- week_start  acute_load  chronic_load  acwr_ratio  monotony  strain   status
-- 2026-05-11  400.00      150.00        2.67        3.02      1209.49  high_load
select
  week_start,
  acute_load,
  chronic_load,
  acwr_ratio,
  monotony,
  strain,
  status
from public.weekly_loads
where runner_id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'
  and week_start = '2026-05-11';

rollback;
