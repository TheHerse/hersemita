-- Coach profile fields for official team/school display.
-- Run this in Supabase SQL Editor before using the Coach Settings page.

alter table public.coaches
  add column if not exists school_name text;
