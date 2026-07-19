-- Phase 0 read-only load / flag / analytics checks.
-- Safe to run any time. This does not modify production data.

-- Activity values outside normal youth/high-school training ranges.
-- These are review flags, not automatic corrections.
select
  activities.id,
  runners.first_name || ' ' || runners.last_name as runner,
  activities.start_time,
  activities.distance_miles,
  activities.duration_seconds,
  activities.pace_per_mile,
  activities.training_load,
  activities.rpe,
  case
    when activities.distance_miles is null or activities.distance_miles <= 0 then 'distance_missing_or_zero'
    when activities.distance_miles > 40 then 'distance_unusually_high'
    when activities.duration_seconds is not null and activities.duration_seconds < 120 then 'duration_unusually_short'
    when activities.pace_per_mile is not null and activities.pace_per_mile < 180 then 'pace_too_fast'
    when activities.pace_per_mile is not null and activities.pace_per_mile > 1800 then 'pace_too_slow'
    when activities.training_load is not null and activities.training_load > 1200 then 'load_unusually_high'
    when activities.rpe is not null and (activities.rpe < 1 or activities.rpe > 10) then 'rpe_out_of_range'
    else 'review'
  end as review_reason
from public.activities
join public.runners on runners.id = activities.runner_id
where activities.distance_miles is null
   or activities.distance_miles <= 0
   or activities.distance_miles > 40
   or (activities.duration_seconds is not null and activities.duration_seconds < 120)
   or (activities.pace_per_mile is not null and (activities.pace_per_mile < 180 or activities.pace_per_mile > 1800))
   or (activities.training_load is not null and activities.training_load > 1200)
   or (activities.rpe is not null and (activities.rpe < 1 or activities.rpe > 10))
order by activities.start_time desc nulls last;

-- Training load rows with ACWR risk values. ACWR above 1.5 is generally a
-- high-load review flag, especially for runners with recovery issues.
select
  weekly_loads.runner_id,
  runners.first_name || ' ' || runners.last_name as runner,
  weekly_loads.week_start,
  weekly_loads.acute_load,
  weekly_loads.chronic_load,
  weekly_loads.acwr_ratio,
  weekly_loads.monotony,
  weekly_loads.strain,
  weekly_loads.status
from public.weekly_loads
join public.runners on runners.id = weekly_loads.runner_id
where weekly_loads.acwr_ratio >= 1.3
   or weekly_loads.monotony >= 2.0
   or weekly_loads.strain >= 600
order by weekly_loads.week_start desc, weekly_loads.acwr_ratio desc nulls last;

-- Recovery risk inputs that should generate coach attention when paired with load.
select
  recovery_logs.runner_id,
  runners.first_name || ' ' || runners.last_name as runner,
  recovery_logs.log_date,
  recovery_logs.sleep_score,
  recovery_logs.sleep_duration_min,
  recovery_logs.hrv_ms,
  recovery_logs.soreness,
  recovery_logs.hrv_status,
  recovery_logs.illness,
  recovery_logs.notes
from public.recovery_logs
join public.runners on runners.id = recovery_logs.runner_id
where recovery_logs.hrv_status in ('low', 'poor')
   or recovery_logs.sleep_score <= 40
   or recovery_logs.sleep_duration_min < 300
   or recovery_logs.soreness >= 8
   or recovery_logs.illness = true
order by recovery_logs.log_date desc;

-- Open coach alerts by team so you can compare flags with the alert UI.
select
  coalesce(teams.school_name, teams.name) as team,
  runners.first_name || ' ' || runners.last_name as runner,
  coach_alerts.alert_type,
  coach_alerts.severity,
  coach_alerts.message,
  coach_alerts.created_at
from public.coach_alerts
left join public.teams on teams.id = coach_alerts.team_id
left join public.runners on runners.id = coach_alerts.runner_id
where coalesce(coach_alerts.dismissed, false) = false
order by coach_alerts.created_at desc;
