-- Harden Hersemita around teams as the security boundary.
--
-- Run after:
--   1. supabase/team-parent-foundation.sql
--   2. supabase/team-access-rls.sql
--
-- This keeps legacy coach_id columns for compatibility, but removes the
-- coach_id-only fallback from live RLS policies.

begin;

update public.runners
set team_id = teams.id
from public.teams
where runners.team_id is null
  and teams.owner_coach_id = runners.coach_id;

update public.runner_groups
set team_id = teams.id
from public.teams
where runner_groups.team_id is null
  and teams.owner_coach_id = runner_groups.coach_id;

update public.workout_templates
set team_id = teams.id
from public.teams
where workout_templates.team_id is null
  and teams.owner_coach_id = workout_templates.coach_id;

update public.workout_assignments
set team_id = teams.id
from public.teams
where workout_assignments.team_id is null
  and teams.owner_coach_id = workout_assignments.coach_id;

update public.coach_alerts
set team_id = teams.id
from public.teams
where coach_alerts.team_id is null
  and teams.owner_coach_id = coach_alerts.coach_id;

do $$
declare
  missing_count integer;
begin
  select count(*) into missing_count
  from (
    select 'runners' as table_name from public.runners where team_id is null
    union all
    select 'runner_groups' from public.runner_groups where team_id is null
    union all
    select 'workout_templates' from public.workout_templates where team_id is null
    union all
    select 'workout_assignments' from public.workout_assignments where team_id is null
    union all
    select 'coach_alerts' from public.coach_alerts where team_id is null
  ) missing_rows;

  if missing_count > 0 then
    raise exception 'Cannot harden team access while % team-owned rows still have null team_id', missing_count;
  end if;
end $$;

alter table public.runners alter column team_id set not null;
alter table public.runner_groups alter column team_id set not null;
alter table public.workout_templates alter column team_id set not null;
alter table public.workout_assignments alter column team_id set not null;
alter table public.coach_alerts alter column team_id set not null;

with ranked_groups as (
  select
    id,
    first_value(id) over (
      partition by team_id, name
      order by created_at asc, id asc
    ) as keep_group_id,
    row_number() over (
      partition by team_id, name
      order by created_at asc, id asc
    ) as group_rank
  from public.runner_groups
),
duplicate_memberships as (
  select
    ranked_groups.keep_group_id,
    runner_group_members.runner_id
  from ranked_groups
  join public.runner_group_members
    on runner_group_members.group_id = ranked_groups.id
  where ranked_groups.group_rank > 1
),
inserted_memberships as (
  insert into public.runner_group_members (group_id, runner_id)
  select distinct keep_group_id, runner_id
  from duplicate_memberships
  where not exists (
    select 1
    from public.runner_group_members existing
    where existing.group_id = duplicate_memberships.keep_group_id
      and existing.runner_id = duplicate_memberships.runner_id
  )
  returning group_id, runner_id
)
delete from public.runner_group_members
using ranked_groups
where runner_group_members.group_id = ranked_groups.id
  and ranked_groups.group_rank > 1;

with ranked_groups as (
  select
    id,
    row_number() over (
      partition by team_id, name
      order by created_at asc, id asc
    ) as group_rank
  from public.runner_groups
)
delete from public.runner_groups
using ranked_groups
where runner_groups.id = ranked_groups.id
  and ranked_groups.group_rank > 1;

alter table public.runner_groups
  drop constraint if exists runner_groups_coach_id_name_key;

create unique index if not exists runner_groups_team_id_name_key
  on public.runner_groups(team_id, name);

drop policy if exists "Team coaches can manage runners" on public.runners;
create policy "Team coaches can manage runners"
  on public.runners
  for all
  to authenticated
  using (public.is_team_coach(team_id))
  with check (public.is_team_coach(team_id));

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
        and public.is_team_coach(runners.team_id)
    )
  )
  with check (
    exists (
      select 1
      from public.runners
      where runners.id = activities.runner_id
        and public.is_team_coach(runners.team_id)
    )
  );

drop policy if exists "Team coaches can manage groups" on public.runner_groups;
create policy "Team coaches can manage groups"
  on public.runner_groups
  for all
  to authenticated
  using (public.is_team_coach(team_id))
  with check (public.is_team_coach(team_id));

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
        and public.is_team_coach(runner_groups.team_id)
    )
  )
  with check (
    exists (
      select 1
      from public.runner_groups
      where runner_groups.id = runner_group_members.group_id
        and public.is_team_coach(runner_groups.team_id)
    )
  );

drop policy if exists "Team coaches can manage workout templates" on public.workout_templates;
create policy "Team coaches can manage workout templates"
  on public.workout_templates
  for all
  to authenticated
  using (public.is_team_coach(team_id))
  with check (public.is_team_coach(team_id));

drop policy if exists "Team coaches can manage workout assignments" on public.workout_assignments;
create policy "Team coaches can manage workout assignments"
  on public.workout_assignments
  for all
  to authenticated
  using (public.is_team_coach(team_id))
  with check (public.is_team_coach(team_id));

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
        and public.is_team_coach(runners.team_id)
    )
  )
  with check (
    exists (
      select 1
      from public.runners
      where runners.id = recovery_logs.runner_id
        and public.is_team_coach(runners.team_id)
    )
  );

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
        and public.is_team_coach(runners.team_id)
    )
  )
  with check (
    exists (
      select 1
      from public.runners
      where runners.id = injuries.runner_id
        and public.is_team_coach(runners.team_id)
    )
  );

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
        and public.is_team_coach(runners.team_id)
    )
  );

drop policy if exists "Team coaches can manage alerts" on public.coach_alerts;
create policy "Team coaches can manage alerts"
  on public.coach_alerts
  for all
  to authenticated
  using (public.is_team_coach(team_id))
  with check (public.is_team_coach(team_id));

commit;
