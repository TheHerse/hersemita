-- Coach/team distance unit preference.
-- Canonical storage remains public.activities.distance_miles.

alter table public.coaches
  add column if not exists preferred_distance_unit text not null default 'miles';

alter table public.coaches
  drop constraint if exists coaches_preferred_distance_unit_check;

alter table public.coaches
  add constraint coaches_preferred_distance_unit_check
  check (preferred_distance_unit in ('miles', 'kilometers'));
