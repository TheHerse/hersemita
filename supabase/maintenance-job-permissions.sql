-- Explicit permissions for service-role-only maintenance jobs.
-- Safe to run repeatedly in the Supabase SQL editor.

begin;

revoke all on function public.cleanup_rate_limits(integer) from public, anon, authenticated;
grant execute on function public.cleanup_rate_limits(integer) to service_role;

commit;
