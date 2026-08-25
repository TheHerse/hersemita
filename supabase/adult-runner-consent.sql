-- Adds immutable adult-runner self-consent evidence. Run after
-- runner-age-status.sql and runner-credential-session-hardening.sql.

begin;

create table if not exists public.adult_runner_consent_events (
  id uuid primary key default gen_random_uuid(),
  runner_id uuid not null references public.runners(id) on delete cascade,
  clerk_user_id text not null,
  team_id uuid not null references public.teams(id) on delete cascade,
  event_type text not null check (event_type in ('granted', 'withdrawn', 'superseded', 'parent_access_granted', 'parent_access_revoked')),
  document_version text not null,
  choices jsonb not null,
  verified_email text not null,
  user_agent text,
  ip_evidence_hash text,
  created_at timestamptz not null default now()
);

create index if not exists adult_runner_consent_events_runner_created_idx
  on public.adult_runner_consent_events(runner_id, created_at desc);

alter table public.adult_runner_consent_events enable row level security;

create or replace function public.grant_adult_runner_consent(
  p_runner_id uuid,
  p_clerk_user_id text,
  p_verified_email text,
  p_document_version text,
  p_choices jsonb,
  p_access_code_hash text,
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
    and runners.age_status = 'adult_18_plus'
    and runners.portal_status = 'pending_adult_consent'
    and lower(runners.runner_email) = lower(p_verified_email)
  for update;

  if runner_team_id is null then
    raise exception 'Adult runner is not eligible for consent';
  end if;

  insert into public.adult_runner_consent_events (
    runner_id, clerk_user_id, team_id, event_type, document_version,
    choices, verified_email, user_agent, ip_evidence_hash
  ) values (
    p_runner_id, p_clerk_user_id, runner_team_id, 'granted',
    p_document_version, p_choices, lower(p_verified_email),
    p_user_agent, p_ip_evidence_hash
  ) returning id into consent_event_id;

  update public.runners
  set portal_status = 'active',
      access_code = null,
      access_code_hash = p_access_code_hash,
      parent_consent_version = null,
      parent_consented_at = null,
      credential_version = credential_version + 1,
      session_version = session_version + 1
  where id = p_runner_id;

  return consent_event_id;
end;
$$;

revoke all on function public.grant_adult_runner_consent(uuid, text, text, text, jsonb, text, text, text) from public;
grant execute on function public.grant_adult_runner_consent(uuid, text, text, text, jsonb, text, text, text) to service_role;

create or replace function public.set_adult_runner_parent_access(
  p_runner_id uuid,
  p_clerk_user_id text,
  p_enabled boolean,
  p_document_version text,
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
  event_id uuid;
  runner_team_id uuid;
begin
  select runners.team_id into runner_team_id
  from public.runners
  where runners.id = p_runner_id
    and runners.age_status = 'adult_18_plus'
    and runners.portal_status = 'active'
    and exists (
      select 1 from public.adult_runner_consent_events
      where adult_runner_consent_events.runner_id = runners.id
        and adult_runner_consent_events.clerk_user_id = p_clerk_user_id
        and adult_runner_consent_events.event_type = 'granted'
    )
  for update;

  if runner_team_id is null then
    raise exception 'Adult runner authority not found';
  end if;

  update public.runners
  set adult_parent_access_enabled = p_enabled
  where id = p_runner_id;

  insert into public.adult_runner_consent_events (
    runner_id, clerk_user_id, team_id, event_type, document_version,
    choices, verified_email, user_agent, ip_evidence_hash
  ) values (
    p_runner_id, p_clerk_user_id, runner_team_id,
    case when p_enabled then 'parent_access_granted' else 'parent_access_revoked' end,
    p_document_version,
    jsonb_build_object('adult_parent_access_enabled', p_enabled),
    lower(p_verified_email), p_user_agent, p_ip_evidence_hash
  ) returning id into event_id;

  return event_id;
end;
$$;

revoke all on function public.set_adult_runner_parent_access(uuid, text, boolean, text, text, text, text) from public;
grant execute on function public.set_adult_runner_parent_access(uuid, text, boolean, text, text, text, text) to service_role;

commit;
