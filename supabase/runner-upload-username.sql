-- Adds a second upload credential for the code-based runner portal.
-- Run this before deploying the username + access-code login change.

alter table public.runners
  add column if not exists username text;

update public.runners
set username = lower(
  regexp_replace(coalesce(last_name, 'runner'), '[^a-zA-Z0-9]+', '', 'g')
  || '_'
  || left(regexp_replace(coalesce(first_name, 'x'), '[^a-zA-Z0-9]+', '', 'g'), 1)
  || floor(1000 + random() * 9000)::int::text
)
where username is null;

alter table public.runners
  alter column username set not null;

create unique index if not exists runners_username_key
  on public.runners(username);

create index if not exists runners_username_access_code_idx
  on public.runners(username, access_code);

-- The app checks upload credentials through /api/runner-login with the
-- service-role Supabase client. Do not add an anon select policy for runners
-- just to support runner login.

-- Once /api/runner-activities is deployed, remove the old anonymous activity
-- insert policy so browsers cannot submit activity rows for arbitrary runner ids.
drop policy if exists "Runner screenshot uploads can create pending activities"
  on public.activities;

-- Once /api/runner-screenshots is deployed, remove old anonymous storage upload
-- policies for activity-screenshots. Names vary by project, so inspect first:
--
-- select policyname, cmd, qual, with_check
-- from pg_policies
-- where schemaname = 'storage'
--   and tablename = 'objects'
--   and (qual ilike '%activity-screenshots%' or with_check ilike '%activity-screenshots%');
