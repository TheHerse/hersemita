-- Metadata-only security events and actionable monitoring alerts.

create table if not exists public.security_events (
  id uuid primary key default gen_random_uuid(),
  team_id uuid references public.teams(id) on delete set null,
  actor_type text not null check (actor_type in ('anonymous', 'runner', 'coach', 'parent', 'adult', 'service')),
  actor_reference text,
  event_type text not null,
  severity text not null check (severity in ('info', 'warning', 'high', 'critical')),
  route text,
  outcome text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists security_events_team_time_idx on public.security_events(team_id, created_at desc);
create index if not exists security_events_type_time_idx on public.security_events(event_type, created_at desc);

create table if not exists public.security_alerts (
  id uuid primary key default gen_random_uuid(),
  team_id uuid references public.teams(id) on delete set null,
  alert_type text not null,
  severity text not null check (severity in ('warning', 'high', 'critical')),
  title text not null,
  event_count integer not null,
  window_started_at timestamptz not null,
  fingerprint text not null unique,
  status text not null default 'open' check (status in ('open', 'acknowledged', 'resolved')),
  created_at timestamptz not null default now(),
  acknowledged_at timestamptz,
  resolved_at timestamptz
);
create index if not exists security_alerts_team_status_idx on public.security_alerts(team_id, status, created_at desc);

alter table public.security_events enable row level security;
alter table public.security_alerts enable row level security;
revoke all on table public.security_events from anon, authenticated;
revoke all on table public.security_alerts from anon, authenticated;

create or replace function public.generate_security_alerts(p_window_minutes integer default 15)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare inserted_count integer;
begin
  if p_window_minutes < 5 or p_window_minutes > 1440 then raise exception 'invalid monitoring window'; end if;
  with grouped as (
    select team_id, event_type, count(*)::integer as event_count,
      date_trunc('hour', now()) as bucket
    from public.security_events
    where created_at >= now() - make_interval(mins => p_window_minutes)
      and event_type in ('auth.failed', 'auth.rate_limited', 'origin.rejected', 'upload.rejected', 'authorization.denied', 'export.rate_limited')
    group by team_id, event_type
    having count(*) >= case event_type
      when 'auth.failed' then 10 when 'upload.rejected' then 8 else 5 end
  )
  insert into public.security_alerts (team_id, alert_type, severity, title, event_count, window_started_at, fingerprint)
  select team_id, event_type,
    case when event_count >= 25 then 'critical' when event_count >= 10 then 'high' else 'warning' end,
    'Security threshold exceeded: ' || event_type, event_count,
    now() - make_interval(mins => p_window_minutes),
    encode(digest(coalesce(team_id::text, 'global') || ':' || event_type || ':' || bucket::text, 'sha256'), 'hex')
  from grouped on conflict (fingerprint) do nothing;
  get diagnostics inserted_count = row_count;
  return inserted_count;
end;
$$;
revoke all on function public.generate_security_alerts(integer) from public, anon, authenticated;
grant execute on function public.generate_security_alerts(integer) to service_role;
