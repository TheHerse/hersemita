-- Phase 3 foundation follow-up: allow active team coaches to access existing
-- coach-owned tables through team_id while keeping the original coach_id path.
--
-- Run after supabase/team-parent-foundation.sql.

begin;

drop policy if exists "Coaches manage own runners" on public.runners;
drop policy if exists "Team coaches can manage runners" on public.runners;
create policy "Team coaches can manage runners"
  on public.runners
  for all
  to authenticated
  using (
    public.is_team_coach(team_id)
    or exists (
      select 1
      from public.coaches
      where coaches.id = runners.coach_id
        and coaches.clerk_id = (select auth.jwt()->>'sub')
    )
  )
  with check (
    public.is_team_coach(team_id)
    or exists (
      select 1
      from public.coaches
      where coaches.id = runners.coach_id
        and coaches.clerk_id = (select auth.jwt()->>'sub')
    )
  );

drop policy if exists "Coaches manage own activities" on public.activities;
drop policy if exists "Team coaches can manage activities" on public.activities;
create policy "Team coaches can manage activities"
  on public.activities
  for all
  to authenticated
  using (
    exists (
      select 1
      from public.runners
      where runners.id = activities.runner_id
        and (
          public.is_team_coach(runners.team_id)
          or exists (
            select 1
            from public.coaches
            where coaches.id = runners.coach_id
              and coaches.clerk_id = (select auth.jwt()->>'sub')
          )
        )
    )
  )
  with check (
    exists (
      select 1
      from public.runners
      where runners.id = activities.runner_id
        and (
          public.is_team_coach(runners.team_id)
          or exists (
            select 1
            from public.coaches
            where coaches.id = runners.coach_id
              and coaches.clerk_id = (select auth.jwt()->>'sub')
          )
        )
    )
  );

drop policy if exists "Coaches can manage own groups" on public.runner_groups;
drop policy if exists "Team coaches can manage groups" on public.runner_groups;
create policy "Team coaches can manage groups"
  on public.runner_groups
  for all
  to authenticated
  using (
    public.is_team_coach(team_id)
    or exists (
      select 1
      from public.coaches
      where coaches.id = runner_groups.coach_id
        and coaches.clerk_id = (select auth.jwt()->>'sub')
    )
  )
  with check (
    public.is_team_coach(team_id)
    or exists (
      select 1
      from public.coaches
      where coaches.id = runner_groups.coach_id
        and coaches.clerk_id = (select auth.jwt()->>'sub')
    )
  );

drop policy if exists "Coaches can manage own group memberships" on public.runner_group_members;
drop policy if exists "Team coaches can manage group memberships" on public.runner_group_members;
create policy "Team coaches can manage group memberships"
  on public.runner_group_members
  for all
  to authenticated
  using (
    exists (
      select 1
      from public.runner_groups
      where runner_groups.id = runner_group_members.group_id
        and (
          public.is_team_coach(runner_groups.team_id)
          or exists (
            select 1
            from public.coaches
            where coaches.id = runner_groups.coach_id
              and coaches.clerk_id = (select auth.jwt()->>'sub')
          )
        )
    )
  )
  with check (
    exists (
      select 1
      from public.runner_groups
      where runner_groups.id = runner_group_members.group_id
        and (
          public.is_team_coach(runner_groups.team_id)
          or exists (
            select 1
            from public.coaches
            where coaches.id = runner_groups.coach_id
              and coaches.clerk_id = (select auth.jwt()->>'sub')
          )
        )
    )
  );

drop policy if exists "Coaches can manage own workout templates" on public.workout_templates;
drop policy if exists "Team coaches can manage workout templates" on public.workout_templates;
create policy "Team coaches can manage workout templates"
  on public.workout_templates
  for all
  to authenticated
  using (
    public.is_team_coach(team_id)
    or exists (
      select 1
      from public.coaches
      where coaches.id = workout_templates.coach_id
        and coaches.clerk_id = (select auth.jwt()->>'sub')
    )
  )
  with check (
    public.is_team_coach(team_id)
    or exists (
      select 1
      from public.coaches
      where coaches.id = workout_templates.coach_id
        and coaches.clerk_id = (select auth.jwt()->>'sub')
    )
  );

drop policy if exists "Coaches can manage own workout assignments" on public.workout_assignments;
drop policy if exists "Team coaches can manage workout assignments" on public.workout_assignments;
create policy "Team coaches can manage workout assignments"
  on public.workout_assignments
  for all
  to authenticated
  using (
    public.is_team_coach(team_id)
    or exists (
      select 1
      from public.coaches
      where coaches.id = workout_assignments.coach_id
        and coaches.clerk_id = (select auth.jwt()->>'sub')
    )
  )
  with check (
    public.is_team_coach(team_id)
    or exists (
      select 1
      from public.coaches
      where coaches.id = workout_assignments.coach_id
        and coaches.clerk_id = (select auth.jwt()->>'sub')
    )
  );

drop policy if exists "Coaches can manage own recovery logs" on public.recovery_logs;
drop policy if exists "Team coaches can manage recovery logs" on public.recovery_logs;
create policy "Team coaches can manage recovery logs"
  on public.recovery_logs
  for all
  to authenticated
  using (
    exists (
      select 1
      from public.runners
      where runners.id = recovery_logs.runner_id
        and (
          public.is_team_coach(runners.team_id)
          or exists (
            select 1
            from public.coaches
            where coaches.id = runners.coach_id
              and coaches.clerk_id = (select auth.jwt()->>'sub')
          )
        )
    )
  )
  with check (
    exists (
      select 1
      from public.runners
      where runners.id = recovery_logs.runner_id
        and (
          public.is_team_coach(runners.team_id)
          or exists (
            select 1
            from public.coaches
            where coaches.id = runners.coach_id
              and coaches.clerk_id = (select auth.jwt()->>'sub')
          )
        )
    )
  );

drop policy if exists "Coaches can manage own injuries" on public.injuries;
drop policy if exists "Team coaches can manage injuries" on public.injuries;
create policy "Team coaches can manage injuries"
  on public.injuries
  for all
  to authenticated
  using (
    exists (
      select 1
      from public.runners
      where runners.id = injuries.runner_id
        and (
          public.is_team_coach(runners.team_id)
          or exists (
            select 1
            from public.coaches
            where coaches.id = runners.coach_id
              and coaches.clerk_id = (select auth.jwt()->>'sub')
          )
        )
    )
  )
  with check (
    exists (
      select 1
      from public.runners
      where runners.id = injuries.runner_id
        and (
          public.is_team_coach(runners.team_id)
          or exists (
            select 1
            from public.coaches
            where coaches.id = runners.coach_id
              and coaches.clerk_id = (select auth.jwt()->>'sub')
          )
        )
    )
  );

drop policy if exists "Coaches can read own weekly loads" on public.weekly_loads;
drop policy if exists "Team coaches can read weekly loads" on public.weekly_loads;
create policy "Team coaches can read weekly loads"
  on public.weekly_loads
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.runners
      where runners.id = weekly_loads.runner_id
        and (
          public.is_team_coach(runners.team_id)
          or exists (
            select 1
            from public.coaches
            where coaches.id = runners.coach_id
              and coaches.clerk_id = (select auth.jwt()->>'sub')
          )
        )
    )
  );

drop policy if exists "Coaches can manage own alerts" on public.coach_alerts;
drop policy if exists "Team coaches can manage alerts" on public.coach_alerts;
create policy "Team coaches can manage alerts"
  on public.coach_alerts
  for all
  to authenticated
  using (
    public.is_team_coach(team_id)
    or exists (
      select 1
      from public.coaches
      where coaches.id = coach_alerts.coach_id
        and coaches.clerk_id = (select auth.jwt()->>'sub')
    )
  )
  with check (
    public.is_team_coach(team_id)
    or exists (
      select 1
      from public.coaches
      where coaches.id = coach_alerts.coach_id
        and coaches.clerk_id = (select auth.jwt()->>'sub')
    )
  );

commit;
