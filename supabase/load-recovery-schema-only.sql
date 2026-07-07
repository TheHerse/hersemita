-- Step 1 of the load/recovery engine migration.
-- Run this first in Supabase SQL Editor. After it succeeds, run:
-- select to_regclass('public.recovery_logs'), to_regclass('public.weekly_loads');
--
-- This file only creates columns, tables, and indexes. It does not create
-- functions, triggers, or RLS policies.

create extension if not exists pgcrypto;

alter table public.activities
  add column if not exists workout_type text check (workout_type in ('easy', 'tempo', 'interval', 'long', 'race', 'recovery', 'cross')),
  add column if not exists avg_hr integer,
  add column if not exists max_hr integer,
  add column if not exists training_load decimal(8,2),
  add column if not exists training_load_source text default 'manual' check (training_load_source in ('garmin', 'estimated_rpe', 'manual', 'ocr')),
  add column if not exists rpe integer check (rpe between 1 and 10),
  add column if not exists aerobic_te decimal(3,1),
  add column if not exists anaerobic_te decimal(3,1),
  add column if not exists elevation_gain_m integer,
  add column if not exists recovery_time_hr integer,
  add column if not exists raw_ocr_json jsonb,
  add column if not exists soreness integer check (soreness between 1 and 10),
  add column if not exists illness boolean default false;

alter table public.runners
  add column if not exists max_hr integer,
  add column if not exists resting_hr integer,
  add column if not exists threshold_pace_sec_per_km integer,
  add column if not exists weight_kg decimal(5,2),
  add column if not exists hrv_baseline_ms decimal(6,2),
  add column if not exists injury_history text[];

create table if not exists public.recovery_logs (
  id uuid primary key default gen_random_uuid(),
  runner_id uuid not null references public.runners(id) on delete cascade,
  log_date date not null,
  hrv_ms decimal(6,2),
  hrv_status text check (hrv_status in ('balanced', 'unbalanced', 'low', 'poor')),
  resting_hr integer,
  sleep_score integer,
  sleep_duration_min integer,
  body_battery integer,
  soreness integer check (soreness between 1 and 10),
  illness boolean default false,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (runner_id, log_date)
);

create table if not exists public.injuries (
  id uuid primary key default gen_random_uuid(),
  runner_id uuid not null references public.runners(id) on delete cascade,
  injury_type text,
  body_part text,
  severity integer check (severity between 1 and 10),
  onset_date date,
  status text default 'active' check (status in ('active', 'recovered', 'chronic')),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.weekly_loads (
  id uuid primary key default gen_random_uuid(),
  runner_id uuid not null references public.runners(id) on delete cascade,
  week_start date not null,
  acute_load decimal(10,2),
  chronic_load decimal(10,2),
  acwr_ratio decimal(4,2),
  monotony decimal(4,2),
  strain decimal(10,2),
  status text generated always as (
    case
      when acwr_ratio > 1.5 then 'high_load'
      when acwr_ratio > 1.3 then 'elevated_load'
      when acwr_ratio < 0.8 then 'detraining'
      else 'optimal'
    end
  ) stored,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (runner_id, week_start)
);

create table if not exists public.coach_alerts (
  id uuid primary key default gen_random_uuid(),
  runner_id uuid not null references public.runners(id) on delete cascade,
  coach_id uuid not null references public.coaches(id) on delete cascade,
  alert_type text not null check (alert_type in ('acwr_spike', 'hrv_drop', 'sleep_poor', 'injury_reported', 'missed_workout')),
  message text,
  severity text not null check (severity in ('medium', 'high', 'critical')),
  dedupe_key text not null unique,
  dismissed boolean default false,
  created_at timestamptz default now()
);

create index if not exists activities_runner_training_load_idx
  on public.activities(runner_id, start_time desc)
  where training_load is not null;

create index if not exists recovery_logs_runner_date_idx
  on public.recovery_logs(runner_id, log_date desc);

create index if not exists injuries_runner_status_idx
  on public.injuries(runner_id, status);

create index if not exists weekly_loads_runner_week_idx
  on public.weekly_loads(runner_id, week_start desc);

create index if not exists coach_alerts_coach_dismissed_idx
  on public.coach_alerts(coach_id, dismissed, created_at desc);

create index if not exists coach_alerts_runner_created_idx
  on public.coach_alerts(runner_id, created_at desc);
