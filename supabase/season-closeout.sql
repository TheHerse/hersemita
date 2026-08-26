-- End-of-season access shutdown and retention-controlled cleanup.
-- Apply after runner-age-status.sql and privacy-requests.sql.

alter table public.runners
  add column if not exists archived_at timestamptz,
  add column if not exists archived_reason text;

create table if not exists public.season_closeouts (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade,
  season_label text not null,
  status text not null default 'closed' check (status in ('closed', 'cleanup_ready', 'completed', 'canceled')),
  retention_until date,
  legal_hold boolean not null default false,
  inventory jsonb not null default '{}'::jsonb,
  closed_by_clerk_id text not null,
  closed_at timestamptz not null default now(),
  completed_by_clerk_id text,
  completed_at timestamptz,
  reopened_by_clerk_id text,
  reopened_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (team_id, season_label)
);

create table if not exists public.season_closeout_runners (
  id uuid primary key default gen_random_uuid(),
  closeout_id uuid not null references public.season_closeouts(id) on delete cascade,
  runner_id uuid references public.runners(id) on delete set null,
  subject_reference text not null,
  created_at timestamptz not null default now(),
  unique (closeout_id, runner_id)
);

alter table public.season_closeouts enable row level security;
alter table public.season_closeout_runners enable row level security;
revoke all on table public.season_closeouts from anon, authenticated;
revoke all on table public.season_closeout_runners from anon, authenticated;

create or replace function public.close_team_season(
  p_team_id uuid,
  p_season_label text,
  p_retention_until date,
  p_actor_clerk_id text
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, extensions, public
as $$
declare
  closeout_id uuid;
  inventory jsonb;
begin
  if length(trim(p_season_label)) < 3 or length(trim(p_season_label)) > 80 then
    raise exception 'invalid season label';
  end if;
  if p_retention_until is not null and p_retention_until < current_date then
    raise exception 'retention date cannot be in the past';
  end if;
  if not exists (select 1 from public.teams where id = p_team_id) then
    raise exception 'team not found';
  end if;

  select jsonb_build_object(
    'runners', (select count(*) from public.runners where team_id = p_team_id and archived_at is null),
    'activities', (select count(*) from public.activities a join public.runners r on r.id = a.runner_id where r.team_id = p_team_id and r.archived_at is null),
    'recovery_logs', (select count(*) from public.recovery_logs x join public.runners r on r.id = x.runner_id where r.team_id = p_team_id and r.archived_at is null),
    'captured_at', now()
  ) into inventory;

  insert into public.season_closeouts (
    team_id, season_label, retention_until, inventory, closed_by_clerk_id
  ) values (p_team_id, trim(p_season_label), p_retention_until, inventory, p_actor_clerk_id)
  returning id into closeout_id;

  insert into public.season_closeout_runners (closeout_id, runner_id, subject_reference)
  select closeout_id, id, encode(digest(id::text, 'sha256'), 'hex')
  from public.runners where team_id = p_team_id and archived_at is null;

  update public.runners set
    portal_status = 'suspended',
    access_code = null,
    access_code_hash = null,
    credential_version = coalesce(credential_version, 1) + 1,
    session_version = coalesce(session_version, 1) + 1,
    archived_at = now(),
    archived_reason = 'season_closeout:' || closeout_id::text
  where team_id = p_team_id and archived_at is null;

  return closeout_id;
end;
$$;

create or replace function public.reopen_team_season(
  p_closeout_id uuid,
  p_team_id uuid,
  p_actor_clerk_id text
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  restored_count integer;
  closeout_status text;
begin
  select status into closeout_status
  from public.season_closeouts
  where id = p_closeout_id and team_id = p_team_id
  for update;

  if closeout_status is null or closeout_status not in ('closed', 'cleanup_ready') then
    raise exception 'closeout cannot be reopened';
  end if;

  update public.runners r set
    archived_at = null,
    archived_reason = null,
    portal_status = case
      when r.age_status = 'adult_18_plus' then 'pending_adult_consent'
      else 'pending_parent_consent'
    end,
    access_code = null,
    access_code_hash = null,
    credential_version = coalesce(r.credential_version, 1) + 1,
    session_version = coalesce(r.session_version, 1) + 1
  from public.season_closeout_runners scr
  where scr.closeout_id = p_closeout_id
    and scr.runner_id = r.id
    and r.team_id = p_team_id
    and r.archived_reason = 'season_closeout:' || p_closeout_id::text;
  get diagnostics restored_count = row_count;

  update public.season_closeouts set
    status = 'canceled',
    reopened_by_clerk_id = p_actor_clerk_id,
    reopened_at = now(),
    updated_at = now()
  where id = p_closeout_id;

  return restored_count;
end;
$$;

create or replace function public.complete_season_cleanup(
  p_closeout_id uuid,
  p_team_id uuid,
  p_actor_clerk_id text
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  deleted_count integer;
  closeout_record public.season_closeouts%rowtype;
begin
  select * into closeout_record from public.season_closeouts
  where id = p_closeout_id and team_id = p_team_id for update;
  if closeout_record.id is null or closeout_record.status not in ('closed', 'cleanup_ready') then
    raise exception 'closeout is not eligible';
  end if;
  if closeout_record.legal_hold then raise exception 'closeout has a legal hold'; end if;
  if closeout_record.retention_until is null or closeout_record.retention_until > current_date then
    raise exception 'retention period has not expired';
  end if;

  delete from public.runners r
  using public.season_closeout_runners scr
  where scr.closeout_id = p_closeout_id and scr.runner_id = r.id
    and r.team_id = p_team_id and r.archived_reason = 'season_closeout:' || p_closeout_id::text;
  get diagnostics deleted_count = row_count;

  update public.season_closeouts set
    status = 'completed', completed_by_clerk_id = p_actor_clerk_id,
    completed_at = now(), updated_at = now()
  where id = p_closeout_id;
  return deleted_count;
end;
$$;

create or replace function public.set_season_closeout_controls(
  p_closeout_id uuid,
  p_team_id uuid,
  p_retention_until date,
  p_legal_hold boolean
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_retention_until is not null and p_retention_until < current_date then
    raise exception 'retention date cannot be in the past';
  end if;
  update public.season_closeouts set
    retention_until = p_retention_until,
    legal_hold = p_legal_hold,
    status = case
      when status = 'closed' and not p_legal_hold and p_retention_until is not null and p_retention_until <= current_date then 'cleanup_ready'
      when status = 'cleanup_ready' and (p_legal_hold or p_retention_until is null or p_retention_until > current_date) then 'closed'
      else status
    end,
    updated_at = now()
  where id = p_closeout_id and team_id = p_team_id and status in ('closed', 'cleanup_ready');
  if not found then raise exception 'closeout not found'; end if;
end;
$$;

revoke all on function public.close_team_season(uuid, text, date, text) from public, anon, authenticated;
revoke all on function public.complete_season_cleanup(uuid, uuid, text) from public, anon, authenticated;
revoke all on function public.set_season_closeout_controls(uuid, uuid, date, boolean) from public, anon, authenticated;
revoke all on function public.reopen_team_season(uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.close_team_season(uuid, text, date, text) to service_role;
grant execute on function public.complete_season_cleanup(uuid, uuid, text) to service_role;
grant execute on function public.set_season_closeout_controls(uuid, uuid, date, boolean) to service_role;
grant execute on function public.reopen_team_season(uuid, uuid, text) to service_role;
