-- Phase 4 parent portal foundation.
--
-- Parents sign in with Clerk. Guardian contacts can be linked directly by
-- clerk_id, or claimed by verified email in app code when clerk_id is empty.

begin;

alter table public.guardian_contacts
  add column if not exists clerk_id text,
  add column if not exists portal_enabled boolean not null default true,
  add column if not exists last_portal_claimed_at timestamptz;

create index if not exists guardian_contacts_clerk_id_idx
  on public.guardian_contacts(clerk_id)
  where clerk_id is not null;

create index if not exists guardian_contacts_team_lower_email_idx
  on public.guardian_contacts(team_id, lower(email))
  where email is not null;

create or replace function public.current_guardian_ids()
returns setof uuid
language sql
stable
security definer
set search_path = public
as $$
  select guardian_contacts.id
  from public.guardian_contacts
  where guardian_contacts.clerk_id = (select auth.jwt()->>'sub')
    and guardian_contacts.portal_enabled = true
$$;

drop policy if exists "Guardians can read own contact" on public.guardian_contacts;
create policy "Guardians can read own contact"
  on public.guardian_contacts
  for select
  to authenticated
  using (
    portal_enabled = true
    and clerk_id = (select auth.jwt()->>'sub')
  );

drop policy if exists "Guardians can read own runner links" on public.runner_guardians;
create policy "Guardians can read own runner links"
  on public.runner_guardians
  for select
  to authenticated
  using (
    guardian_id in (select public.current_guardian_ids())
  );

drop policy if exists "Guardians can read linked runners" on public.runners;
create policy "Guardians can read linked runners"
  on public.runners
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.runner_guardians
      where runner_guardians.runner_id = runners.id
        and runner_guardians.guardian_id in (select public.current_guardian_ids())
    )
  );

drop policy if exists "Guardians can read linked runner activities" on public.activities;
create policy "Guardians can read linked runner activities"
  on public.activities
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.runner_guardians
      where runner_guardians.runner_id = activities.runner_id
        and runner_guardians.guardian_id in (select public.current_guardian_ids())
    )
  );

drop policy if exists "Guardians can read linked runner recovery logs" on public.recovery_logs;
create policy "Guardians can read linked runner recovery logs"
  on public.recovery_logs
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.runner_guardians
      where runner_guardians.runner_id = recovery_logs.runner_id
        and runner_guardians.guardian_id in (select public.current_guardian_ids())
    )
  );

drop policy if exists "Guardians can read linked runner alerts" on public.coach_alerts;
create policy "Guardians can read linked runner alerts"
  on public.coach_alerts
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.runner_guardians
      where runner_guardians.runner_id = coach_alerts.runner_id
        and runner_guardians.guardian_id in (select public.current_guardian_ids())
    )
  );

commit;
