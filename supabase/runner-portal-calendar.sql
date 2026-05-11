-- Runner portal calendar foundation.
-- This keeps Clerk for coaches only. Runners do not authenticate with Supabase.
-- Runner-facing calendar reads should go through server API routes that validate
-- the signed runner session cookie.

create table if not exists public.workout_templates (
  id uuid primary key default gen_random_uuid(),
  coach_id uuid not null references public.coaches(id) on delete cascade,
  title text not null,
  kind text not null default 'run',
  miles text,
  pace text,
  warmup text,
  main_set text,
  cooldown text,
  strength text,
  location text,
  notes text,
  tags text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.workout_assignments (
  id uuid primary key default gen_random_uuid(),
  coach_id uuid not null references public.coaches(id) on delete cascade,
  template_id uuid not null references public.workout_templates(id) on delete cascade,
  assigned_date date not null,
  target_type text not null check (target_type in ('team', 'group', 'runner')),
  target_id text not null,
  target_label text,
  created_at timestamptz not null default now()
);

alter table public.workout_assignments
  add column if not exists target_label text;

create index if not exists workout_templates_coach_id_idx
  on public.workout_templates(coach_id);

create index if not exists workout_assignments_coach_date_idx
  on public.workout_assignments(coach_id, assigned_date desc);

create index if not exists workout_assignments_target_idx
  on public.workout_assignments(target_type, target_id, assigned_date desc);

alter table public.workout_templates enable row level security;
alter table public.workout_assignments enable row level security;

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
        and coaches.email = (select auth.jwt()->>'sub')
    )
  )
  with check (
    exists (
      select 1
      from public.coaches
      where coaches.id = workout_templates.coach_id
        and coaches.email = (select auth.jwt()->>'sub')
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
        and coaches.email = (select auth.jwt()->>'sub')
    )
  )
  with check (
    exists (
      select 1
      from public.coaches
      where coaches.id = workout_assignments.coach_id
        and coaches.email = (select auth.jwt()->>'sub')
    )
  );

-- No runner-facing Supabase policies are added here on purpose.
-- Runner portal APIs should use the server-side service-role client after
-- validating the signed runner session cookie.
