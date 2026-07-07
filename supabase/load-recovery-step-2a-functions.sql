-- Step 2a: functions only.
-- Run after supabase/load-recovery-schema-only.sql succeeds.

create or replace function public.touch_updated_at()
returns trigger
as $function$
begin
  new.updated_at = now();
  return new;
end;
$function$
language plpgsql;

create or replace function public.recalculate_runner_load(p_runner_id uuid, p_activity_date date)
returns void
as $function$
declare
  v_week_start date;
  v_acute_load numeric;
  v_chronic_load numeric;
  v_acwr_ratio numeric;
  v_daily_avg numeric;
  v_daily_stddev numeric;
  v_monotony numeric;
  v_strain numeric;
begin
  if p_runner_id is null or p_activity_date is null then
    return;
  end if;

  v_week_start := date_trunc('week', p_activity_date)::date;

  select coalesce(sum(training_load), 0)
    into v_acute_load
  from public.activities
  where runner_id = p_runner_id
    and training_load is not null
    and start_time::date between p_activity_date - interval '6 days' and p_activity_date;

  select coalesce(sum(training_load), 0) / 4.0
    into v_chronic_load
  from public.activities
  where runner_id = p_runner_id
    and training_load is not null
    and start_time::date between p_activity_date - interval '27 days' and p_activity_date;

  v_acwr_ratio := v_acute_load / nullif(v_chronic_load, 0);

  with daily_loads as (
    select
      day::date as load_date,
      coalesce(sum(a.training_load), 0) as daily_load
    from generate_series(p_activity_date - interval '6 days', p_activity_date, interval '1 day') as day
    left join public.activities a
      on a.runner_id = p_runner_id
      and a.training_load is not null
      and a.start_time::date = day::date
    group by day::date
  )
  select avg(daily_load), stddev_samp(daily_load)
    into v_daily_avg, v_daily_stddev
  from daily_loads;

  v_monotony := coalesce(v_daily_avg / nullif(v_daily_stddev, 0), 0);
  v_strain := v_acute_load * v_monotony;

  insert into public.weekly_loads (
    runner_id,
    week_start,
    acute_load,
    chronic_load,
    acwr_ratio,
    monotony,
    strain
  )
  values (
    p_runner_id,
    v_week_start,
    round(v_acute_load, 2),
    round(v_chronic_load, 2),
    round(v_acwr_ratio, 2),
    round(v_monotony, 2),
    round(v_strain, 2)
  )
  on conflict (runner_id, week_start)
  do update set
    acute_load = excluded.acute_load,
    chronic_load = excluded.chronic_load,
    acwr_ratio = excluded.acwr_ratio,
    monotony = excluded.monotony,
    strain = excluded.strain;
end;
$function$
language plpgsql
security definer
set search_path = public;

create or replace function public.recalculate_runner_load_from_activity()
returns trigger
as $function$
begin
  if new.training_load is not null then
    perform public.recalculate_runner_load(new.runner_id, new.start_time::date);
  end if;
  return new;
end;
$function$
language plpgsql
security definer
set search_path = public;

create or replace function public.check_recovery_alerts(p_runner_id uuid)
returns void
as $function$
declare
  v_coach_id uuid;
  v_has_low_hrv boolean;
  v_current_acwr numeric;
  v_today date := current_date;
begin
  if p_runner_id is null then
    return;
  end if;

  select coach_id
    into v_coach_id
  from public.runners
  where id = p_runner_id;

  if v_coach_id is null then
    return;
  end if;

  select exists (
    select 1
    from public.recovery_logs
    where runner_id = p_runner_id
      and log_date between v_today - interval '2 days' and v_today
      and hrv_status = 'low'
  )
    into v_has_low_hrv;

  select acwr_ratio
    into v_current_acwr
  from public.weekly_loads
  where runner_id = p_runner_id
    and week_start = date_trunc('week', v_today)::date
  order by week_start desc
  limit 1;

  if v_has_low_hrv and coalesce(v_current_acwr, 0) > 1.2 then
    insert into public.coach_alerts (
      runner_id,
      coach_id,
      alert_type,
      message,
      severity,
      dedupe_key
    )
    values (
      p_runner_id,
      v_coach_id,
      'hrv_drop',
      'Recovery concern: low HRV status with elevated recent load. Needs coach review.',
      'critical',
      p_runner_id::text || ':hrv_drop:' || v_today::text
    )
    on conflict (dedupe_key) do nothing;
  end if;
end;
$function$
language plpgsql
security definer
set search_path = public;

create or replace function public.check_recovery_alerts_from_log()
returns trigger
as $function$
begin
  perform public.check_recovery_alerts(new.runner_id);
  return new;
end;
$function$
language plpgsql
security definer
set search_path = public;
