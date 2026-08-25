-- Adds minimized age-status handling without collecting a birth date or the
-- exact date a runner turns 18.

begin;

alter table public.runners
  add column if not exists age_status text not null default 'unknown',
  add column if not exists age_status_attested_at timestamptz,
  add column if not exists age_status_attested_by text,
  add column if not exists age_status_season text,
  add column if not exists runner_email text,
  add column if not exists adult_parent_access_enabled boolean not null default false;

alter table public.runners
  drop constraint if exists runners_age_status_check;

alter table public.runners
  add constraint runners_age_status_check
  check (age_status in ('unknown', 'under_13', 'minor_13_to_17', 'adult_18_plus'));

alter table public.runners
  drop constraint if exists runners_portal_status_check;

alter table public.runners
  add constraint runners_portal_status_check
  check (portal_status in (
    'pending_parent_consent',
    'pending_adult_consent',
    'active',
    'suspended',
    'revoked'
  ));

create index if not exists runners_runner_email_idx
  on public.runners(lower(runner_email))
  where runner_email is not null;

commit;
