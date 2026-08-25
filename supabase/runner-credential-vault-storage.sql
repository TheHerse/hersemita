-- Allow the runner credential vault to store authenticated ciphertext.
-- Login verification continues to use access_code_hash; access_code contains
-- only the AES-256-GCM encrypted recovery copy used after coach reverification.

alter table public.runners
  alter column access_code type text;

comment on column public.runners.access_code is
  'AES-256-GCM encrypted runner access code for password-gated coach recovery; never plaintext.';
