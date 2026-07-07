-- Verification queries for the split load/recovery migration.
-- Run after:
--   1. supabase/load-recovery-schema-only.sql
--   2. supabase/load-recovery-step-2a-functions.sql
--   3. supabase/load-recovery-step-2b-triggers-rls.sql

-- Expected: all four tables resolve to public table names.
select
  to_regclass('public.recovery_logs') as recovery_logs,
  to_regclass('public.injuries') as injuries,
  to_regclass('public.weekly_loads') as weekly_loads,
  to_regclass('public.coach_alerts') as coach_alerts;

-- Expected: five trigger rows.
select
  trigger_table,
  trigger_name
from (
  select
    t.tgrelid::regclass::text as trigger_table,
    t.tgname as trigger_name
  from pg_trigger t
  where not t.tgisinternal
    and t.tgrelid in (
      'public.activities'::regclass,
      'public.recovery_logs'::regclass,
      'public.injuries'::regclass,
      'public.weekly_loads'::regclass
    )
) triggers
where trigger_name in (
  'activities_recalculate_runner_load',
  'recovery_logs_check_alerts',
  'recovery_logs_touch_updated_at',
  'injuries_touch_updated_at',
  'weekly_loads_touch_updated_at'
)
order by trigger_table, trigger_name;

-- Expected: relrowsecurity = true for all four tables.
select
  c.relname as table_name,
  c.relrowsecurity as rls_enabled
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relname in ('recovery_logs', 'injuries', 'weekly_loads', 'coach_alerts')
order by c.relname;

-- Expected: four policy rows.
select
  tablename as table_name,
  policyname as policy_name,
  cmd
from pg_policies
where schemaname = 'public'
  and tablename in ('recovery_logs', 'injuries', 'weekly_loads', 'coach_alerts')
order by table_name, policy_name;

-- Expected: five function rows.
select
  p.proname as function_name
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname in (
    'touch_updated_at',
    'recalculate_runner_load',
    'recalculate_runner_load_from_activity',
    'check_recovery_alerts',
    'check_recovery_alerts_from_log'
  )
order by p.proname;
