-- Phase 0 read-only data hygiene checks.
-- Safe to run any time. This does not modify production data.

-- Team-owned rows that would break team-scoped access if null.
select 'runners_without_team' as check_name, count(*) as issue_count
from public.runners
where team_id is null
union all
select 'runner_groups_without_team', count(*)
from public.runner_groups
where team_id is null
union all
select 'workout_templates_without_team', count(*)
from public.workout_templates
where team_id is null
union all
select 'workout_assignments_without_team', count(*)
from public.workout_assignments
where team_id is null
union all
select 'coach_alerts_without_team', count(*)
from public.coach_alerts
where team_id is null
union all
select 'guardians_without_team', count(*)
from public.guardian_contacts
where team_id is null;

-- Runner/guardian link integrity. `runner_guardians` does not need its own
-- team_id because the team can be inferred through the linked runner/guardian.
select 'runner_guardian_links_missing_runner' as check_name, count(*) as issue_count
from public.runner_guardians
left join public.runners on runners.id = runner_guardians.runner_id
where runners.id is null
union all
select 'runner_guardian_links_missing_guardian', count(*)
from public.runner_guardians
left join public.guardian_contacts on guardian_contacts.id = runner_guardians.guardian_id
where guardian_contacts.id is null
union all
select 'runner_guardian_team_mismatch', count(*)
from public.runner_guardians
join public.runners on runners.id = runner_guardians.runner_id
join public.guardian_contacts on guardian_contacts.id = runner_guardians.guardian_id
where runners.team_id is distinct from guardian_contacts.team_id;

-- Parent contacts that still look like throwaway/test data.
select
  id,
  team_id,
  first_name,
  last_name,
  email,
  phone,
  clerk_id,
  created_at
from public.guardian_contacts
where lower(coalesce(email, '')) in ('test@a.com', 'test@example.com', 'codex.parent.test@example.com')
   or lower(coalesce(email, '')) like '%example.com'
order by created_at desc;

-- Guardians linked to more than one runner. This can be valid for siblings,
-- but it should be reviewed during testing.
select
  guardian_contacts.id as guardian_id,
  guardian_contacts.email,
  guardian_contacts.phone,
  count(runner_guardians.runner_id) as linked_runner_count,
  string_agg(runners.first_name || ' ' || runners.last_name, ', ' order by runners.last_name, runners.first_name) as runners
from public.guardian_contacts
join public.runner_guardians on runner_guardians.guardian_id = guardian_contacts.id
join public.runners on runners.id = runner_guardians.runner_id
group by guardian_contacts.id, guardian_contacts.email, guardian_contacts.phone
having count(runner_guardians.runner_id) > 1
order by linked_runner_count desc, guardian_contacts.email nulls last;

-- Assistant/head coach membership sanity.
select
  teams.id as team_id,
  coalesce(teams.school_name, teams.name) as team_name,
  count(*) filter (where team_coach_memberships.role = 'head_coach' and team_coach_memberships.status = 'active') as active_head_coaches,
  count(*) filter (where team_coach_memberships.role = 'assistant_coach' and team_coach_memberships.status = 'active') as active_assistant_coaches
from public.teams
left join public.team_coach_memberships on team_coach_memberships.team_id = teams.id
group by teams.id, teams.school_name, teams.name
order by team_name;
