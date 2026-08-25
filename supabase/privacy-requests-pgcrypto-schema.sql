-- Supabase installs pgcrypto in the extensions schema. Keep the
-- security-definer function's search path explicit and trusted so digest()
-- resolves without allowing an untrusted schema to shadow built-ins.

alter function public.submit_privacy_request(uuid, uuid, text, text, text, text)
  set search_path = pg_catalog, extensions, public;
