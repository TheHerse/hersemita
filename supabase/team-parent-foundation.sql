-- Phase 3 foundation: teams, multi-coach access, and parent/guardian modeling.
--
-- This migration is intentionally additive. It keeps the current coach-owned
-- columns in place while adding team-scoped tables/columns that the app can
-- move toward screen by screen.

begin;

create table if not exists public.teams (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  school_name text,
  owner_coach_id uuid references public.coaches(id) on delete set null,
  default_distance_unit text not null default 'miles',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint teams_default_distance_unit_check
    check (default_distance_unit in ('miles', 'kilometers'))
);

create table if not exists public.team_coach_memberships (
  team_id uuid not null references public.teams(id) on delete cascade,
  coach_id uuid not null references public.coaches(id) on delete cascade,
  role text not null check (role in ('head_coach', 'assistant_coach')),
  status text not null default 'active' check (status in ('active', 'invited', 'disabled')),
  created_at timestamptz not null default now(),
  primary key (team_id, coach_id)
);

create table if not exists public.guardian_contacts (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade,
  first_name text,
  last_name text,
  phone text,
  email text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint guardian_contacts_contact_check
    check (phone is not null or email is not null)
);

create table if not exists public.runner_guardians (
  runner_id uuid not null references public.runners(id) on delete cascade,
  guardian_id uuid not null references public.guardian_contacts(id) on delete cascade,
  relationship text,
  is_primary boolean not null default false,
  created_at timestamptz not null default now(),
  primary key (runner_id, guardian_id)
);

alter table public.coaches
  add column if not exists active_team_id uuid references public.teams(id) on delete set null;

alter table public.runners
  add column if not exists team_id uuid references public.teams(id) on delete set null;

alter table public.runner_groups
  add column if not exists team_id uuid references public.teams(id) on delete cascade;

alter table public.workout_templates
  add column if not exists team_id uuid references public.teams(id) on delete cascade;

alter table public.workout_assignments
  add column if not exists team_id uuid references public.teams(id) on delete cascade;

alter table public.coach_alerts
  add column if not exists team_id uuid references public.teams(id) on delete cascade;

create index if not exists teams_owner_coach_id_idx
  on public.teams(owner_coach_id);

create index if not exists team_coach_memberships_coach_id_idx
  on public.team_coach_memberships(coach_id);

create index if not exists guardian_contacts_team_id_idx
  on public.guardian_contacts(team_id);

create index if not exists guardian_contacts_phone_idx
  on public.guardian_contacts(phone)
  where phone is not null;

create index if not exists guardian_contacts_email_idx
  on public.guardian_contacts(email)
  where email is not null;

create unique index if not exists guardian_contacts_team_phone_key
  on public.guardian_contacts(team_id, phone)
  where phone is not null;

create unique index if not exists guardian_contacts_team_email_key
  on public.guardian_contacts(team_id, lower(email))
  where email is not null;

create index if not exists runner_guardians_guardian_id_idx
  on public.runner_guardians(guardian_id);

create index if not exists runners_team_id_idx
  on public.runners(team_id);

create index if not exists runner_groups_team_id_idx
  on public.runner_groups(team_id);

create index if not exists workout_templates_team_id_idx
  on public.workout_templates(team_id);

create index if not exists workout_assignments_team_date_idx
  on public.workout_assignments(team_id, assigned_date desc);

create index if not exists coach_alerts_team_id_idx
  on public.coach_alerts(team_id);

-- Create one team per existing coach. Existing app code can continue using
-- coach_id while new code can start reading team_id.
insert into public.teams (name, school_name, owner_coach_id, default_distance_unit)
select
  coalesce(nullif(coaches.school_name, ''), nullif(coaches.name, ''), 'Hersemita Team') as name,
  coaches.school_name,
  coaches.id,
  coalesce(coaches.preferred_distance_unit, 'miles')
from public.coaches
where not exists (
  select 1
  from public.teams
  where teams.owner_coach_id = coaches.id
);

insert into public.team_coach_memberships (team_id, coach_id, role, status)
select teams.id, teams.owner_coach_id, 'head_coach', 'active'
from public.teams
where teams.owner_coach_id is not null
  and not exists (
    select 1
    from public.team_coach_memberships
    where team_coach_memberships.team_id = teams.id
      and team_coach_memberships.coach_id = teams.owner_coach_id
  );

update public.coaches
set active_team_id = teams.id
from public.teams
where teams.owner_coach_id = coaches.id
  and coaches.active_team_id is null;

update public.runners
set team_id = teams.id
from public.teams
where teams.owner_coach_id = runners.coach_id
  and runners.team_id is null;

update public.runner_groups
set team_id = teams.id
from public.teams
where teams.owner_coach_id = runner_groups.coach_id
  and runner_groups.team_id is null;

update public.workout_templates
set team_id = teams.id
from public.teams
where teams.owner_coach_id = workout_templates.coach_id
  and workout_templates.team_id is null;

update public.workout_assignments
set team_id = teams.id
from public.teams
where teams.owner_coach_id = workout_assignments.coach_id
  and workout_assignments.team_id is null;

update public.coach_alerts
set team_id = teams.id
from public.teams
where teams.owner_coach_id = coach_alerts.coach_id
  and coach_alerts.team_id is null;

-- Convert existing runner parent_phone values into guardian contacts so the
-- parent portal can start from current roster data.
insert into public.guardian_contacts (team_id, phone)
select distinct
  runners.team_id,
  nullif(trim(runners.parent_phone), '') as phone
from public.runners
where runners.team_id is not null
  and nullif(trim(runners.parent_phone), '') is not null
on conflict do nothing;

insert into public.runner_guardians (runner_id, guardian_id, relationship, is_primary)
select
  runners.id,
  guardian_contacts.id,
  'parent_guardian',
  true
from public.runners
join public.guardian_contacts
  on guardian_contacts.team_id = runners.team_id
  and guardian_contacts.phone = nullif(trim(runners.parent_phone), '')
where runners.team_id is not null
  and nullif(trim(runners.parent_phone), '') is not null
on conflict do nothing;

create or replace function public.current_coach_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select coaches.id
  from public.coaches
  where coaches.clerk_id = (select auth.jwt()->>'sub')
  limit 1
$$;

create or replace function public.is_team_coach(p_team_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.team_coach_memberships
    where team_coach_memberships.team_id = p_team_id
      and team_coach_memberships.coach_id = public.current_coach_id()
      and team_coach_memberships.status = 'active'
  )
$$;

create or replace function public.team_coach_role(p_team_id uuid)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select team_coach_memberships.role
  from public.team_coach_memberships
  where team_coach_memberships.team_id = p_team_id
    and team_coach_memberships.coach_id = public.current_coach_id()
    and team_coach_memberships.status = 'active'
  limit 1
$$;

alter table public.teams enable row level security;
alter table public.team_coach_memberships enable row level security;
alter table public.guardian_contacts enable row level security;
alter table public.runner_guardians enable row level security;

drop policy if exists "Team coaches can read teams" on public.teams;
create policy "Team coaches can read teams"
  on public.teams
  for select
  to authenticated
  using (public.is_team_coach(id));

drop policy if exists "Head coaches can update teams" on public.teams;
create policy "Head coaches can update teams"
  on public.teams
  for update
  to authenticated
  using (public.team_coach_role(id) = 'head_coach')
  with check (public.team_coach_role(id) = 'head_coach');

drop policy if exists "Team coaches can read coach memberships" on public.team_coach_memberships;
create policy "Team coaches can read coach memberships"
  on public.team_coach_memberships
  for select
  to authenticated
  using (public.is_team_coach(team_id));

drop policy if exists "Head coaches can manage coach memberships" on public.team_coach_memberships;
create policy "Head coaches can manage coach memberships"
  on public.team_coach_memberships
  for all
  to authenticated
  using (public.team_coach_role(team_id) = 'head_coach')
  with check (public.team_coach_role(team_id) = 'head_coach');

drop policy if exists "Team coaches can manage guardians" on public.guardian_contacts;
create policy "Team coaches can manage guardians"
  on public.guardian_contacts
  for all
  to authenticated
  using (public.is_team_coach(team_id))
  with check (public.is_team_coach(team_id));

drop policy if exists "Team coaches can manage runner guardians" on public.runner_guardians;
create policy "Team coaches can manage runner guardians"
  on public.runner_guardians
  for all
  to authenticated
  using (
    exists (
      select 1
      from public.guardian_contacts
      where guardian_contacts.id = runner_guardians.guardian_id
        and public.is_team_coach(guardian_contacts.team_id)
    )
  )
  with check (
    exists (
      select 1
      from public.guardian_contacts
      where guardian_contacts.id = runner_guardians.guardian_id
        and public.is_team_coach(guardian_contacts.team_id)
    )
  );

commit;
