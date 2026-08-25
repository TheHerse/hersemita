-- Adds immutable parent-consent evidence and makes new runner accounts pending
-- until a linked, authenticated guardian completes the approved consent flow.

begin;

alter table public.runners
  alter column portal_status set default 'pending_parent_consent',
  add column if not exists parent_consent_version text,
  add column if not exists parent_consented_at timestamptz;

create table if not exists public.runner_consent_events (
  id uuid primary key default gen_random_uuid(),
  runner_id uuid not null references public.runners(id) on delete cascade,
  guardian_id uuid not null references public.guardian_contacts(id) on delete restrict,
  clerk_user_id text not null,
  team_id uuid not null references public.teams(id) on delete cascade,
  event_type text not null check (event_type in ('granted', 'withdrawn', 'superseded')),
  document_version text not null,
  choices jsonb not null,
  relationship_attestation text not null,
  verified_email text not null,
  user_agent text,
  ip_evidence_hash text,
  created_at timestamptz not null default now()
);

create index if not exists runner_consent_events_runner_created_idx
  on public.runner_consent_events(runner_id, created_at desc);

create index if not exists runner_consent_events_guardian_created_idx
  on public.runner_consent_events(guardian_id, created_at desc);

alter table public.runner_consent_events enable row level security;

-- Consent events are written and reviewed through server-side, explicitly
-- authorized service-role functions. No browser role receives direct access.

create or replace function public.grant_runner_parent_consent(
  p_runner_id uuid,
  p_guardian_id uuid,
  p_clerk_user_id text,
  p_document_version text,
  p_choices jsonb,
  p_relationship_attestation text,
  p_verified_email text,
  p_user_agent text default null,
  p_ip_evidence_hash text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  consent_event_id uuid;
  runner_team_id uuid;
begin
  select runners.team_id into runner_team_id
  from public.runners
  where runners.id = p_runner_id
    and runners.portal_status = 'pending_parent_consent'
  for update;

  if runner_team_id is null then
    raise exception 'Runner is not awaiting parent consent';
  end if;

  if not exists (
    select 1
    from public.guardian_contacts
    join public.runner_guardians
      on runner_guardians.guardian_id = guardian_contacts.id
    where guardian_contacts.id = p_guardian_id
      and guardian_contacts.clerk_id = p_clerk_user_id
      and guardian_contacts.portal_enabled = true
      and guardian_contacts.team_id = runner_team_id
      and runner_guardians.runner_id = p_runner_id
  ) then
    raise exception 'Guardian is not authorized for this runner';
  end if;

  insert into public.runner_consent_events (
    runner_id,
    guardian_id,
    clerk_user_id,
    team_id,
    event_type,
    document_version,
    choices,
    relationship_attestation,
    verified_email,
    user_agent,
    ip_evidence_hash
  ) values (
    p_runner_id,
    p_guardian_id,
    p_clerk_user_id,
    runner_team_id,
    'granted',
    p_document_version,
    p_choices,
    p_relationship_attestation,
    lower(p_verified_email),
    p_user_agent,
    p_ip_evidence_hash
  )
  returning id into consent_event_id;

  update public.runners
  set portal_status = 'active',
      parent_consent_version = p_document_version,
      parent_consented_at = now(),
      session_version = session_version + 1
  where id = p_runner_id;

  return consent_event_id;
end;
$$;

revoke all on function public.grant_runner_parent_consent(uuid, uuid, text, text, jsonb, text, text, text, text) from public;
grant execute on function public.grant_runner_parent_consent(uuid, uuid, text, text, jsonb, text, text, text, text) to service_role;

create or replace function public.withdraw_runner_parent_consent(
  p_runner_id uuid,
  p_guardian_id uuid,
  p_clerk_user_id text,
  p_verified_email text,
  p_user_agent text default null,
  p_ip_evidence_hash text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  consent_event_id uuid;
  runner_team_id uuid;
  current_document_version text;
begin
  select runners.team_id, runners.parent_consent_version
    into runner_team_id, current_document_version
  from public.runners
  where runners.id = p_runner_id
    and runners.portal_status = 'active'
  for update;

  if runner_team_id is null then
    raise exception 'Runner is not active';
  end if;

  if not exists (
    select 1
    from public.guardian_contacts
    join public.runner_guardians
      on runner_guardians.guardian_id = guardian_contacts.id
    where guardian_contacts.id = p_guardian_id
      and guardian_contacts.clerk_id = p_clerk_user_id
      and guardian_contacts.portal_enabled = true
      and guardian_contacts.team_id = runner_team_id
      and runner_guardians.runner_id = p_runner_id
  ) then
    raise exception 'Guardian is not authorized for this runner';
  end if;

  insert into public.runner_consent_events (
    runner_id,
    guardian_id,
    clerk_user_id,
    team_id,
    event_type,
    document_version,
    choices,
    relationship_attestation,
    verified_email,
    user_agent,
    ip_evidence_hash
  ) values (
    p_runner_id,
    p_guardian_id,
    p_clerk_user_id,
    runner_team_id,
    'withdrawn',
    coalesce(current_document_version, 'legacy-or-unknown'),
    '{}'::jsonb,
    'withdrawal_by_linked_guardian',
    lower(p_verified_email),
    p_user_agent,
    p_ip_evidence_hash
  )
  returning id into consent_event_id;

  update public.runners
  set portal_status = 'revoked',
      access_code = null,
      access_code_hash = null,
      credential_version = credential_version + 1,
      session_version = session_version + 1
  where id = p_runner_id;

  return consent_event_id;
end;
$$;

revoke all on function public.withdraw_runner_parent_consent(uuid, uuid, text, text, text, text) from public;
grant execute on function public.withdraw_runner_parent_consent(uuid, uuid, text, text, text, text) to service_role;

commit;
