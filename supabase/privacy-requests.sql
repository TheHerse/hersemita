-- Privacy-rights request intake and immutable status history.
-- Apply after team-parent-foundation.sql and runner-age-status.sql.

create extension if not exists pgcrypto;

create table if not exists public.privacy_requests (
  id uuid primary key default gen_random_uuid(),
  runner_id uuid references public.runners(id) on delete set null,
  team_id uuid references public.teams(id) on delete set null,
  subject_reference text not null,
  requester_clerk_id text not null,
  requester_role text not null check (requester_role in ('coach', 'parent_guardian', 'adult_runner')),
  request_type text not null check (request_type in ('access', 'export', 'correction', 'deletion', 'restriction')), 
  details text,
  status text not null default 'submitted' check (status in ('submitted', 'identity_verification', 'in_review', 'approved', 'denied', 'completed', 'canceled')),
  submitted_at timestamptz not null default now(),
  due_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists privacy_requests_requester_idx
  on public.privacy_requests(requester_clerk_id, submitted_at desc);
create index if not exists privacy_requests_team_status_idx
  on public.privacy_requests(team_id, status, submitted_at asc);

create table if not exists public.privacy_request_events (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.privacy_requests(id) on delete cascade,
  actor_clerk_id text not null,
  event_type text not null,
  from_status text,
  to_status text,
  note text,
  created_at timestamptz not null default now()
);

create index if not exists privacy_request_events_request_idx
  on public.privacy_request_events(request_id, created_at asc);

alter table public.privacy_requests enable row level security;
alter table public.privacy_request_events enable row level security;
revoke all on table public.privacy_requests from anon, authenticated;
revoke all on table public.privacy_request_events from anon, authenticated;

create or replace function public.prevent_privacy_request_event_mutation()
returns trigger
language plpgsql
as $$
begin
  raise exception 'privacy request events are immutable';
end;
$$;

drop trigger if exists privacy_request_events_immutable_update on public.privacy_request_events;
create trigger privacy_request_events_immutable_update
before update or delete on public.privacy_request_events
for each row execute function public.prevent_privacy_request_event_mutation();

create or replace function public.submit_privacy_request(
  p_runner_id uuid,
  p_team_id uuid,
  p_requester_clerk_id text,
  p_requester_role text,
  p_request_type text,
  p_details text
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, extensions, public
as $$
declare
  request_id uuid;
begin
  if p_requester_role not in ('coach', 'parent_guardian', 'adult_runner') or
     p_request_type not in ('access', 'export', 'correction', 'deletion', 'restriction') or
     length(coalesce(p_details, '')) > 4000 then
    raise exception 'invalid privacy request';
  end if;
  if not exists (select 1 from public.runners where id = p_runner_id and team_id = p_team_id) then
    raise exception 'runner not found';
  end if;

  insert into public.privacy_requests (
    runner_id, team_id, subject_reference, requester_clerk_id, requester_role,
    request_type, details, due_at
  ) values (
    p_runner_id, p_team_id, encode(digest(p_runner_id::text, 'sha256'), 'hex'),
    p_requester_clerk_id, p_requester_role, p_request_type, nullif(trim(p_details), ''),
    now() + interval '30 days'
  ) returning id into request_id;

  insert into public.privacy_request_events (
    request_id, actor_clerk_id, event_type, to_status
  ) values (request_id, p_requester_clerk_id, 'submitted', 'submitted');
  return request_id;
end;
$$;

create or replace function public.transition_privacy_request(
  p_request_id uuid,
  p_team_id uuid,
  p_actor_clerk_id text,
  p_to_status text,
  p_note text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  old_status text;
begin
  if p_to_status not in ('identity_verification', 'in_review', 'approved', 'denied', 'completed', 'canceled') or
     length(coalesce(p_note, '')) > 2000 then
    raise exception 'invalid privacy request transition';
  end if;

  select status into old_status from public.privacy_requests
    where id = p_request_id and team_id = p_team_id for update;
  if old_status is null or old_status in ('denied', 'completed', 'canceled') then
    raise exception 'privacy request cannot be transitioned';
  end if;
  if p_to_status = 'completed' and exists (
    select 1 from public.privacy_requests where id = p_request_id and request_type = 'deletion'
  ) then
    raise exception 'deletion requests require the deletion completion function';
  end if;

  update public.privacy_requests set
    status = p_to_status,
    completed_at = case when p_to_status in ('completed', 'denied', 'canceled') then now() else null end,
    updated_at = now()
  where id = p_request_id;
  insert into public.privacy_request_events (
    request_id, actor_clerk_id, event_type, from_status, to_status, note
  ) values (p_request_id, p_actor_clerk_id, 'status_changed', old_status, p_to_status, nullif(trim(p_note), ''));
end;
$$;

create or replace function public.complete_privacy_deletion(
  p_request_id uuid,
  p_team_id uuid,
  p_actor_clerk_id text,
  p_note text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  target_runner_id uuid;
  old_status text;
begin
  select runner_id, status into target_runner_id, old_status
  from public.privacy_requests
  where id = p_request_id and team_id = p_team_id and request_type = 'deletion'
  for update;
  if target_runner_id is null or old_status not in ('in_review', 'approved') then
    raise exception 'deletion request is not ready';
  end if;

  update public.privacy_requests set
    runner_id = null,
    status = 'completed',
    completed_at = now(),
    updated_at = now()
  where id = p_request_id;
  delete from public.runners where id = target_runner_id and team_id = p_team_id;
  if not found then raise exception 'runner deletion failed'; end if;

  insert into public.privacy_request_events (
    request_id, actor_clerk_id, event_type, from_status, to_status, note
  ) values (p_request_id, p_actor_clerk_id, 'runner_deleted', old_status, 'completed', nullif(trim(p_note), ''));
  return target_runner_id;
end;
$$;

revoke all on function public.submit_privacy_request(uuid, uuid, text, text, text, text) from public, anon, authenticated;
revoke all on function public.transition_privacy_request(uuid, uuid, text, text, text) from public, anon, authenticated;
revoke all on function public.complete_privacy_deletion(uuid, uuid, text, text) from public, anon, authenticated;
grant execute on function public.submit_privacy_request(uuid, uuid, text, text, text, text) to service_role;
grant execute on function public.transition_privacy_request(uuid, uuid, text, text, text) to service_role;
grant execute on function public.complete_privacy_deletion(uuid, uuid, text, text) to service_role;
