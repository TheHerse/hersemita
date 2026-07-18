-- Durable team invitations for assistant coach onboarding.
--
-- Clerk sends the email and handles authentication. Supabase owns the invite
-- state so team access can be accepted automatically after sign-up/sign-in.

begin;

create table if not exists public.team_invitations (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade,
  email text not null,
  role text not null check (role in ('assistant_coach')),
  token_hash text not null unique,
  clerk_invitation_id text,
  invited_by_coach_id uuid references public.coaches(id) on delete set null,
  accepted_by_coach_id uuid references public.coaches(id) on delete set null,
  expires_at timestamptz not null,
  accepted_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint team_invitations_email_check
    check (email = lower(trim(email)))
);

create index if not exists team_invitations_team_id_idx
  on public.team_invitations(team_id);

create index if not exists team_invitations_email_idx
  on public.team_invitations(email);

create index if not exists team_invitations_pending_idx
  on public.team_invitations(team_id, expires_at)
  where accepted_at is null and revoked_at is null;

alter table public.team_invitations enable row level security;

drop policy if exists "Head coaches can manage team invitations" on public.team_invitations;
create policy "Head coaches can manage team invitations"
  on public.team_invitations
  for all
  to authenticated
  using (public.team_coach_role(team_id) = 'head_coach')
  with check (public.team_coach_role(team_id) = 'head_coach');

commit;
