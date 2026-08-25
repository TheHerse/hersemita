-- Adds hashed runner credentials and revocable, versioned runner sessions.
-- Deploy before the application code that reads these columns.

begin;

alter table public.runners
  add column if not exists access_code_hash text,
  add column if not exists credential_version integer not null default 1,
  add column if not exists session_version integer not null default 1,
  add column if not exists portal_status text not null default 'active';

alter table public.runners
  alter column access_code drop not null;

alter table public.runners
  drop constraint if exists runners_portal_status_check;

alter table public.runners
  add constraint runners_portal_status_check
  check (portal_status in ('pending_parent_consent', 'active', 'suspended', 'revoked'));

alter table public.runners
  drop constraint if exists runners_credential_version_positive;

alter table public.runners
  add constraint runners_credential_version_positive
  check (credential_version > 0 and session_version > 0);

drop index if exists public.runners_username_access_code_idx;
create unique index if not exists runners_username_key
  on public.runners(username);

commit;

-- Existing plaintext access_code values are intentionally retained only for
-- transition. On the first successful login the application creates a scrypt
-- hash, increments both versions, and erases access_code. Coaches should rotate
-- any account that does not log in during the migration window. After all rows
-- have access_code_hash, verify no plaintext rows remain, then enforce:
--
-- alter table public.runners
--   add constraint runners_access_code_hash_required
--   check (portal_status <> 'active' or access_code_hash is not null);
