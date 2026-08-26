-- Adds a controlled rollback for a closeout that has not been permanently
-- cleaned. Restored runners require fresh consent and fresh credentials.

alter table public.season_closeouts
  add column if not exists reopened_by_clerk_id text,
  add column if not exists reopened_at timestamptz;

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
    portal_status = case when r.age_status = 'adult_18_plus'
      then 'pending_adult_consent' else 'pending_parent_consent' end,
    access_code = null,
    access_code_hash = null,
    credential_version = coalesce(r.credential_version, 1) + 1,
    session_version = coalesce(r.session_version, 1) + 1
  from public.season_closeout_runners scr
  where scr.closeout_id = p_closeout_id and scr.runner_id = r.id
    and r.team_id = p_team_id
    and r.archived_reason = 'season_closeout:' || p_closeout_id::text;
  get diagnostics restored_count = row_count;

  update public.season_closeouts set
    status = 'canceled', reopened_by_clerk_id = p_actor_clerk_id,
    reopened_at = now(), updated_at = now()
  where id = p_closeout_id;
  return restored_count;
end;
$$;

revoke all on function public.reopen_team_season(uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.reopen_team_season(uuid, uuid, text) to service_role;
