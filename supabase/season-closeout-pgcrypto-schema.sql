-- Supabase installs pgcrypto in the extensions schema. Keep the
-- security-definer closeout function's lookup path explicit and trusted so
-- the pseudonymous runner snapshot can resolve digest().

alter function public.close_team_season(uuid, text, date, text)
  set search_path = pg_catalog, extensions, public;
