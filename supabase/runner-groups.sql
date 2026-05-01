-- Runner groups/tags for coach-owned roster filtering.
-- Run this in Supabase SQL Editor before using the Groups page.

create table if not exists public.runner_groups (
  id uuid primary key default gen_random_uuid(),
  coach_id uuid not null references public.coaches(id) on delete cascade,
  name text not null,
  color text not null default '#00a7ff',
  created_at timestamptz not null default now(),
  unique (coach_id, name)
);

create table if not exists public.runner_group_members (
  group_id uuid not null references public.runner_groups(id) on delete cascade,
  runner_id uuid not null references public.runners(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (group_id, runner_id)
);

create index if not exists runner_groups_coach_id_idx
  on public.runner_groups(coach_id);

create index if not exists runner_group_members_runner_id_idx
  on public.runner_group_members(runner_id);

-- Optional helper for future seed scripts and documentation:
-- default coach groups are 9th, 10th, 11th, 12th, Boys, and Girls.
