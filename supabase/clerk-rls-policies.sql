-- Clerk-backed RLS policies for Hersemita coach data.
-- Run this in the Supabase SQL Editor after enabling Clerk as a Supabase
-- third-party auth provider and adding role = "authenticated" to Clerk tokens.
--
-- These policies assume public.coaches.email stores Clerk's user id.
-- In Clerk/Supabase RLS, that value is available as auth.jwt()->>'sub'.

alter table public.coaches enable row level security;
alter table public.runners enable row level security;
alter table public.activities enable row level security;
alter table public.runner_groups enable row level security;
alter table public.runner_group_members enable row level security;

drop policy if exists "Coaches can read own profile" on public.coaches;
create policy "Coaches can read own profile"
  on public.coaches
  for select
  to authenticated
  using (email = (select auth.jwt()->>'sub'));

drop policy if exists "Coaches can create own profile" on public.coaches;
create policy "Coaches can create own profile"
  on public.coaches
  for insert
  to authenticated
  with check (email = (select auth.jwt()->>'sub'));

drop policy if exists "Coaches can update own profile" on public.coaches;
create policy "Coaches can update own profile"
  on public.coaches
  for update
  to authenticated
  using (email = (select auth.jwt()->>'sub'))
  with check (email = (select auth.jwt()->>'sub'));

drop policy if exists "Coaches can read own runners" on public.runners;
create policy "Coaches can read own runners"
  on public.runners
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.coaches
      where coaches.id = runners.coach_id
        and coaches.email = (select auth.jwt()->>'sub')
    )
  );

drop policy if exists "Coaches can create own runners" on public.runners;
create policy "Coaches can create own runners"
  on public.runners
  for insert
  to authenticated
  with check (
    exists (
      select 1
      from public.coaches
      where coaches.id = runners.coach_id
        and coaches.email = (select auth.jwt()->>'sub')
    )
  );

drop policy if exists "Coaches can update own runners" on public.runners;
create policy "Coaches can update own runners"
  on public.runners
  for update
  to authenticated
  using (
    exists (
      select 1
      from public.coaches
      where coaches.id = runners.coach_id
        and coaches.email = (select auth.jwt()->>'sub')
    )
  )
  with check (
    exists (
      select 1
      from public.coaches
      where coaches.id = runners.coach_id
        and coaches.email = (select auth.jwt()->>'sub')
    )
  );

drop policy if exists "Coaches can delete own runners" on public.runners;
create policy "Coaches can delete own runners"
  on public.runners
  for delete
  to authenticated
  using (
    exists (
      select 1
      from public.coaches
      where coaches.id = runners.coach_id
        and coaches.email = (select auth.jwt()->>'sub')
    )
  );

drop policy if exists "Coaches can read own activities" on public.activities;
create policy "Coaches can read own activities"
  on public.activities
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.runners
      join public.coaches on coaches.id = runners.coach_id
      where runners.id = activities.runner_id
        and coaches.email = (select auth.jwt()->>'sub')
    )
  );

drop policy if exists "Coaches can create own activities" on public.activities;
create policy "Coaches can create own activities"
  on public.activities
  for insert
  to authenticated
  with check (
    exists (
      select 1
      from public.runners
      join public.coaches on coaches.id = runners.coach_id
      where runners.id = activities.runner_id
        and coaches.email = (select auth.jwt()->>'sub')
    )
  );

drop policy if exists "Coaches can update own activities" on public.activities;
create policy "Coaches can update own activities"
  on public.activities
  for update
  to authenticated
  using (
    exists (
      select 1
      from public.runners
      join public.coaches on coaches.id = runners.coach_id
      where runners.id = activities.runner_id
        and coaches.email = (select auth.jwt()->>'sub')
    )
  )
  with check (
    exists (
      select 1
      from public.runners
      join public.coaches on coaches.id = runners.coach_id
      where runners.id = activities.runner_id
        and coaches.email = (select auth.jwt()->>'sub')
    )
  );

drop policy if exists "Coaches can delete own activities" on public.activities;
create policy "Coaches can delete own activities"
  on public.activities
  for delete
  to authenticated
  using (
    exists (
      select 1
      from public.runners
      join public.coaches on coaches.id = runners.coach_id
      where runners.id = activities.runner_id
        and coaches.email = (select auth.jwt()->>'sub')
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
        and coaches.email = (select auth.jwt()->>'sub')
    )
  )
  with check (
    exists (
      select 1
      from public.coaches
      where coaches.id = runner_groups.coach_id
        and coaches.email = (select auth.jwt()->>'sub')
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
        and coaches.email = (select auth.jwt()->>'sub')
    )
  )
  with check (
    exists (
      select 1
      from public.runner_groups
      join public.coaches on coaches.id = runner_groups.coach_id
      where runner_groups.id = runner_group_members.group_id
        and coaches.email = (select auth.jwt()->>'sub')
    )
  );
