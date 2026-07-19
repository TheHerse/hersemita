-- Parent message history for coach-facing sent/prepared SMS records.
--
-- Run this before deploying code that writes to parent_message_batches.
-- Full parent phone numbers are not stored here; recipients keep only a
-- runner snapshot and the last 4 digits of the phone number used.

begin;

create table if not exists public.parent_message_batches (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade,
  coach_id uuid references public.coaches(id) on delete set null,
  message_type text not null default 'general',
  body text not null,
  status text not null default 'mock',
  provider text not null default 'twilio',
  mock boolean not null default true,
  runner_count integer not null default 0,
  recipient_count integer not null default 0,
  error_message text,
  created_at timestamptz not null default now(),
  constraint parent_message_batches_status_check
    check (status in ('sent', 'mock', 'error'))
);

create table if not exists public.parent_message_recipients (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid not null references public.parent_message_batches(id) on delete cascade,
  team_id uuid not null references public.teams(id) on delete cascade,
  runner_id uuid references public.runners(id) on delete set null,
  runner_name text not null,
  phone_last4 text,
  status text not null default 'queued',
  created_at timestamptz not null default now(),
  constraint parent_message_recipients_status_check
    check (status in ('queued', 'sent', 'mock', 'error'))
);

create index if not exists parent_message_batches_team_created_idx
  on public.parent_message_batches(team_id, created_at desc);

create index if not exists parent_message_recipients_batch_idx
  on public.parent_message_recipients(batch_id);

create index if not exists parent_message_recipients_runner_idx
  on public.parent_message_recipients(runner_id);

alter table public.parent_message_batches enable row level security;
alter table public.parent_message_recipients enable row level security;

drop policy if exists "team coaches can read parent message batches" on public.parent_message_batches;
create policy "team coaches can read parent message batches"
  on public.parent_message_batches
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.team_coach_memberships m
      join public.coaches c on c.id = m.coach_id
      where m.team_id = parent_message_batches.team_id
        and m.status = 'active'
        and c.clerk_id = auth.jwt()->>'sub'
    )
  );

drop policy if exists "team coaches can read parent message recipients" on public.parent_message_recipients;
create policy "team coaches can read parent message recipients"
  on public.parent_message_recipients
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.team_coach_memberships m
      join public.coaches c on c.id = m.coach_id
      where m.team_id = parent_message_recipients.team_id
        and m.status = 'active'
        and c.clerk_id = auth.jwt()->>'sub'
    )
  );

revoke all on table public.parent_message_batches from anon;
revoke all on table public.parent_message_recipients from anon;

grant select on table public.parent_message_batches to authenticated;
grant select on table public.parent_message_recipients to authenticated;

commit;
