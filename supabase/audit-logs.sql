-- Structured audit logs for high-impact Hersemita actions.
--
-- Run before deploying code that writes to public.audit_logs.
-- The app writes audit rows through the service-role Supabase client.

begin;

create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  team_id uuid references public.teams(id) on delete set null,
  actor_coach_id uuid references public.coaches(id) on delete set null,
  actor_clerk_id text,
  action text not null,
  entity_type text not null,
  entity_id text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists audit_logs_team_created_at_idx
  on public.audit_logs(team_id, created_at desc);

create index if not exists audit_logs_actor_created_at_idx
  on public.audit_logs(actor_coach_id, created_at desc);

create index if not exists audit_logs_action_created_at_idx
  on public.audit_logs(action, created_at desc);

alter table public.audit_logs enable row level security;

revoke all on table public.audit_logs from anon, authenticated;

commit;
