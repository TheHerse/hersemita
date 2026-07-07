-- Step 2b: triggers and RLS policies.
-- Run after supabase/load-recovery-step-2a-functions.sql succeeds.

drop trigger if exists recovery_logs_touch_updated_at on public.recovery_logs;
create trigger recovery_logs_touch_updated_at
  before update on public.recovery_logs
  for each row
  execute function public.touch_updated_at();

drop trigger if exists injuries_touch_updated_at on public.injuries;
create trigger injuries_touch_updated_at
  before update on public.injuries
  for each row
  execute function public.touch_updated_at();

drop trigger if exists weekly_loads_touch_updated_at on public.weekly_loads;
create trigger weekly_loads_touch_updated_at
  before update on public.weekly_loads
  for each row
  execute function public.touch_updated_at();

drop trigger if exists activities_recalculate_runner_load on public.activities;
create trigger activities_recalculate_runner_load
  after insert or update of training_load, start_time on public.activities
  for each row
  when (new.training_load is not null)
  execute function public.recalculate_runner_load_from_activity();

drop trigger if exists recovery_logs_check_alerts on public.recovery_logs;
create trigger recovery_logs_check_alerts
  after insert or update on public.recovery_logs
  for each row
  execute function public.check_recovery_alerts_from_log();

alter table public.recovery_logs enable row level security;
alter table public.injuries enable row level security;
alter table public.weekly_loads enable row level security;
alter table public.coach_alerts enable row level security;

drop policy if exists "Coaches can manage own recovery logs" on public.recovery_logs;
create policy "Coaches can manage own recovery logs"
  on public.recovery_logs
  for all
  to authenticated
  using (
    exists (
      select 1
      from public.runners
      join public.coaches on coaches.id = runners.coach_id
      where runners.id = recovery_logs.runner_id
        and coaches.email = (select auth.jwt()->>'sub')
    )
  )
  with check (
    exists (
      select 1
      from public.runners
      join public.coaches on coaches.id = runners.coach_id
      where runners.id = recovery_logs.runner_id
        and coaches.email = (select auth.jwt()->>'sub')
    )
  );

drop policy if exists "Coaches can manage own injuries" on public.injuries;
create policy "Coaches can manage own injuries"
  on public.injuries
  for all
  to authenticated
  using (
    exists (
      select 1
      from public.runners
      join public.coaches on coaches.id = runners.coach_id
      where runners.id = injuries.runner_id
        and coaches.email = (select auth.jwt()->>'sub')
    )
  )
  with check (
    exists (
      select 1
      from public.runners
      join public.coaches on coaches.id = runners.coach_id
      where runners.id = injuries.runner_id
        and coaches.email = (select auth.jwt()->>'sub')
    )
  );

drop policy if exists "Coaches can read own weekly loads" on public.weekly_loads;
create policy "Coaches can read own weekly loads"
  on public.weekly_loads
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.runners
      join public.coaches on coaches.id = runners.coach_id
      where runners.id = weekly_loads.runner_id
        and coaches.email = (select auth.jwt()->>'sub')
    )
  );

drop policy if exists "Coaches can manage own alerts" on public.coach_alerts;
create policy "Coaches can manage own alerts"
  on public.coach_alerts
  for all
  to authenticated
  using (
    exists (
      select 1
      from public.coaches
      where coaches.id = coach_alerts.coach_id
        and coaches.email = (select auth.jwt()->>'sub')
    )
  )
  with check (
    exists (
      select 1
      from public.coaches
      where coaches.id = coach_alerts.coach_id
        and coaches.email = (select auth.jwt()->>'sub')
    )
  );
