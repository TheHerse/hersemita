-- Enforce a verified privacy restriction without deleting retained records.

alter table public.runners
  add column if not exists processing_restricted_at timestamptz,
  add column if not exists processing_restriction_request_id uuid references public.privacy_requests(id) on delete set null,
  add column if not exists processing_restriction_reason text;

create or replace function public.apply_privacy_restriction(
  p_request_id uuid,
  p_team_id uuid,
  p_actor_clerk_id text,
  p_note text
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
  if length(trim(coalesce(p_note, ''))) < 5 or length(p_note) > 2000 then
    raise exception 'restriction evidence is required';
  end if;
  select runner_id, status into target_runner_id, old_status
  from public.privacy_requests
  where id = p_request_id and team_id = p_team_id and request_type = 'restriction'
  for update;
  if target_runner_id is null or old_status not in ('in_review', 'approved') then
    raise exception 'restriction request is not ready';
  end if;

  update public.runners set
    processing_restricted_at = now(),
    processing_restriction_request_id = p_request_id,
    processing_restriction_reason = trim(p_note),
    portal_status = 'suspended',
    access_code = null,
    access_code_hash = null,
    credential_version = coalesce(credential_version, 1) + 1,
    session_version = coalesce(session_version, 1) + 1
  where id = target_runner_id and team_id = p_team_id;
  if not found then raise exception 'runner restriction failed'; end if;

  update public.privacy_requests set
    status = 'completed', completed_at = now(), updated_at = now()
  where id = p_request_id;
  insert into public.privacy_request_events (
    request_id, actor_clerk_id, event_type, from_status, to_status, note
  ) values (
    p_request_id, p_actor_clerk_id, 'processing_restricted', old_status, 'completed', trim(p_note)
  );
  return target_runner_id;
end;
$$;

revoke all on function public.apply_privacy_restriction(uuid, uuid, text, text) from public, anon, authenticated;
grant execute on function public.apply_privacy_restriction(uuid, uuid, text, text) to service_role;
