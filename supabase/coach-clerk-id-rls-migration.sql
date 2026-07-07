-- Clerk identity cleanup for Hersemita.
--
-- Run this in Supabase SQL Editor before deploying app code that queries
-- public.coaches.clerk_id.
--
-- Based on the July 7, 2026 audit:
-- - public.runners rows with null coach_id: 0
-- - public.activities rows with null runner_id: 0
-- - public.settings rows: 0

begin;

alter table public.coaches
  add column if not exists clerk_id text;

update public.coaches
set clerk_id = email
where clerk_id is null;

alter table public.coaches
  alter column clerk_id set not null;

create unique index if not exists coaches_clerk_id_key
  on public.coaches(clerk_id);

-- These were verified as safe by the audit checks above.
alter table public.runners
  alter column coach_id set not null;

alter table public.activities
  alter column runner_id set not null;

alter table public.coaches enable row level security;
alter table public.runners enable row level security;
alter table public.activities enable row level security;
alter table public.runner_groups enable row level security;
alter table public.runner_group_members enable row level security;
alter table public.workout_templates enable row level security;
alter table public.workout_assignments enable row level security;
alter table public.recovery_logs enable row level security;
alter table public.injuries enable row level security;
alter table public.weekly_loads enable row level security;
alter table public.coach_alerts enable row level security;

drop policy if exists "Coaches read own profile" on public.coaches;
drop policy if exists "Coaches can read own profile" on public.coaches;
drop policy if exists "Coaches can create own profile" on public.coaches;
drop policy if exists "Coaches can update own profile" on public.coaches;

create policy "Coaches can read own profile"
  on public.coaches
  for select
  to authenticated
  using (clerk_id = (select auth.jwt()->>'sub'));

create policy "Coaches can create own profile"
  on public.coaches
  for insert
  to authenticated
  with check (clerk_id = (select auth.jwt()->>'sub'));

create policy "Coaches can update own profile"
  on public.coaches
  for update
  to authenticated
  using (clerk_id = (select auth.jwt()->>'sub'))
  with check (clerk_id = (select auth.jwt()->>'sub'));

drop policy if exists "Coaches manage own runners" on public.runners;
drop policy if exists "Coaches can read own runners" on public.runners;
drop policy if exists "Coaches can create own runners" on public.runners;
drop policy if exists "Coaches can update own runners" on public.runners;
drop policy if exists "Coaches can delete own runners" on public.runners;

create policy "Coaches manage own runners"
  on public.runners
  for all
  to authenticated
  using (
    exists (
      select 1
      from public.coaches
      where coaches.id = runners.coach_id
        and coaches.clerk_id = (select auth.jwt()->>'sub')
    )
  )
  with check (
    exists (
      select 1
      from public.coaches
      where coaches.id = runners.coach_id
        and coaches.clerk_id = (select auth.jwt()->>'sub')
    )
  );

drop policy if exists "Coaches manage own activities" on public.activities;
drop policy if exists "Coaches can read own activities" on public.activities;
drop policy if exists "Coaches can create own activities" on public.activities;
drop policy if exists "Coaches can update own activities" on public.activities;
drop policy if exists "Coaches can delete own activities" on public.activities;

create policy "Coaches manage own activities"
  on public.activities
  for all
  to authenticated
  using (
    exists (
      select 1
      from public.runners
      join public.coaches on coaches.id = runners.coach_id
      where runners.id = activities.runner_id
        and coaches.clerk_id = (select auth.jwt()->>'sub')
    )
  )
  with check (
    exists (
      select 1
      from public.runners
      join public.coaches on coaches.id = runners.coach_id
      where runners.id = activities.runner_id
        and coaches.clerk_id = (select auth.jwt()->>'sub')
    )
  );

drop policy if exists "Coaches can manage own groups" on public.runner_groups;
create policy "Coaches can manage own groups"
  on public.runner_groups
  for all
  to authenticated
  using (
    exists (
      select 1
      from public.coaches
      where coaches.id = runner_groups.coach_id
        and coaches.clerk_id = (select auth.jwt()->>'sub')
    )
  )
  with check (
    exists (
      select 1
      from public.coaches
      where coaches.id = runner_groups.coach_id
        and coaches.clerk_id = (select auth.jwt()->>'sub')
    )
  );

drop policy if exists "Coaches can manage own group memberships" on public.runner_group_members;
create policy "Coaches can manage own group memberships"
  on public.runner_group_members
  for all
  to authenticated
  using (
    exists (
      select 1
      from public.runner_groups
      join public.coaches on coaches.id = runner_groups.coach_id
      where runner_groups.id = runner_group_members.group_id
        and coaches.clerk_id = (select auth.jwt()->>'sub')
    )
  )
  with check (
    exists (
      select 1
      from public.runner_groups
      join public.coaches on coaches.id = runner_groups.coach_id
      where runner_groups.id = runner_group_members.group_id
        and coaches.clerk_id = (select auth.jwt()->>'sub')
    )
  );

drop policy if exists "Coaches can manage own workout templates" on public.workout_templates;
create policy "Coaches can manage own workout templates"
  on public.workout_templates
  for all
  to authenticated
  using (
    exists (
      select 1
      from public.coaches
      where coaches.id = workout_templates.coach_id
        and coaches.clerk_id = (select auth.jwt()->>'sub')
    )
  )
  with check (
    exists (
      select 1
      from public.coaches
      where coaches.id = workout_templates.coach_id
        and coaches.clerk_id = (select auth.jwt()->>'sub')
    )
  );

drop policy if exists "Coaches can manage own workout assignments" on public.workout_assignments;
create policy "Coaches can manage own workout assignments"
  on public.workout_assignments
  for all
  to authenticated
  using (
    exists (
      select 1
      from public.coaches
      where coaches.id = workout_assignments.coach_id
        and coaches.clerk_id = (select auth.jwt()->>'sub')
    )
  )
  with check (
    exists (
      select 1
      from public.coaches
      where coaches.id = workout_assignments.coach_id
        and coaches.clerk_id = (select auth.jwt()->>'sub')
    )
  );

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
        and coaches.clerk_id = (select auth.jwt()->>'sub')
    )
  )
  with check (
    exists (
      select 1
      from public.runners
      join public.coaches on coaches.id = runners.coach_id
      where runners.id = recovery_logs.runner_id
        and coaches.clerk_id = (select auth.jwt()->>'sub')
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
        and coaches.clerk_id = (select auth.jwt()->>'sub')
    )
  )
  with check (
    exists (
      select 1
      from public.runners
      join public.coaches on coaches.id = runners.coach_id
      where runners.id = injuries.runner_id
        and coaches.clerk_id = (select auth.jwt()->>'sub')
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
        and coaches.clerk_id = (select auth.jwt()->>'sub')
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
        and coaches.clerk_id = (select auth.jwt()->>'sub')
    )
  )
  with check (
    exists (
      select 1
      from public.coaches
      where coaches.id = coach_alerts.coach_id
        and coaches.clerk_id = (select auth.jwt()->>'sub')
    )
  );

commit;
