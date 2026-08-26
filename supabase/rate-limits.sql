-- Durable API rate limits for Hersemita.
--
-- Run this before deploying code that calls public.check_rate_limit.
-- The app uses the service-role Supabase client for this RPC. Raw identifiers
-- are HMAC-hashed in app code before they are stored here.

begin;

create table if not exists public.rate_limits (
  rate_key text primary key,
  window_start timestamptz not null default now(),
  window_seconds integer not null,
  count integer not null default 0,
  updated_at timestamptz not null default now()
);

create index if not exists rate_limits_updated_at_idx
  on public.rate_limits(updated_at);

alter table public.rate_limits enable row level security;

revoke all on table public.rate_limits from anon, authenticated;

create or replace function public.check_rate_limit(
  p_rate_key text,
  p_window_seconds integer,
  p_max_attempts integer
)
returns table (
  limited boolean,
  remaining integer,
  reset_at timestamptz,
  current_count integer
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_now timestamptz := now();
  v_window interval := make_interval(secs => p_window_seconds);
  v_count integer;
  v_window_start timestamptz;
begin
  if p_rate_key is null or length(trim(p_rate_key)) = 0 then
    raise exception 'rate key is required';
  end if;

  if p_window_seconds <= 0 then
    raise exception 'window seconds must be positive';
  end if;

  if p_max_attempts <= 0 then
    raise exception 'max attempts must be positive';
  end if;

  loop
    select rate_limits.count, rate_limits.window_start
      into v_count, v_window_start
    from public.rate_limits
    where rate_limits.rate_key = p_rate_key
    for update;

    if found then
      if v_window_start + v_window <= v_now then
        update public.rate_limits
        set
          window_start = v_now,
          window_seconds = p_window_seconds,
          count = 1,
          updated_at = v_now
        where rate_key = p_rate_key;

        limited := false;
        remaining := p_max_attempts - 1;
        reset_at := v_now + v_window;
        current_count := 1;
        return next;
        return;
      end if;

      v_count := v_count + 1;

      update public.rate_limits
      set
        count = v_count,
        window_seconds = p_window_seconds,
        updated_at = v_now
      where rate_key = p_rate_key;

      limited := v_count > p_max_attempts;
      remaining := greatest(0, p_max_attempts - v_count);
      reset_at := v_window_start + v_window;
      current_count := v_count;
      return next;
      return;
    end if;

    begin
      insert into public.rate_limits (
        rate_key,
        window_start,
        window_seconds,
        count,
        updated_at
      )
      values (
        p_rate_key,
        v_now,
        p_window_seconds,
        1,
        v_now
      );

      limited := false;
      remaining := p_max_attempts - 1;
      reset_at := v_now + v_window;
      current_count := 1;
      return next;
      return;
    exception
      when unique_violation then
        -- Another request created the row first. Retry with the row lock.
    end;
  end loop;
end;
$$;

revoke all on function public.check_rate_limit(text, integer, integer) from public;
revoke all on function public.check_rate_limit(text, integer, integer) from anon, authenticated;

create or replace function public.cleanup_rate_limits(
  p_older_than_hours integer default 48
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  deleted_count integer;
begin
  if p_older_than_hours < 1 then
    raise exception 'older-than hours must be at least 1';
  end if;

  delete from public.rate_limits
  where updated_at < now() - make_interval(hours => p_older_than_hours);

  get diagnostics deleted_count = row_count;
  return deleted_count;
end;
$$;

revoke all on function public.cleanup_rate_limits(integer) from public;
revoke all on function public.cleanup_rate_limits(integer) from anon, authenticated;
grant execute on function public.cleanup_rate_limits(integer) to service_role;

commit;
