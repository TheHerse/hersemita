-- Cleanup for the Phase 5 Assistant Random demo data.
-- This removes only rows tagged by scripts/seed-phase-five-demo-data.mjs.

begin;

delete from public.coach_alerts
where runner_id = '4835d989-7820-44fc-b2b0-dbda6d3622de'
  and dedupe_key like 'phase5_demo_assistant_random%';

delete from public.recovery_logs
where runner_id = '4835d989-7820-44fc-b2b0-dbda6d3622de'
  and notes like '%[Phase 5 Demo]%';

delete from public.activities
where runner_id = '4835d989-7820-44fc-b2b0-dbda6d3622de'
  and garmin_activity_id like 'phase5_demo_assistant_random%';

delete from public.weekly_loads
where runner_id = '4835d989-7820-44fc-b2b0-dbda6d3622de'
  and week_start between '2026-05-25'::date and '2026-07-19'::date;

commit;
