-- Rotate runner portal credentials from 6-digit numeric codes to
-- 10-character alphanumeric passcodes.
--
-- Run this in Supabase SQL Editor before deploying the app code that rejects
-- 6-digit numeric runner codes.

begin;

alter table public.runners
  alter column access_code type varchar(16);

create or replace function public.generate_runner_passcode()
returns text
language plpgsql
volatile
as $$
declare
  alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  bytes bytea := gen_random_bytes(10);
  passcode text := '';
  i int;
begin
  for i in 0..9 loop
    passcode := passcode || substr(alphabet, (get_byte(bytes, i) % length(alphabet)) + 1, 1);
  end loop;

  return passcode;
end;
$$;

update public.runners
set access_code = public.generate_runner_passcode();

alter table public.runners
  alter column access_code set not null;

drop function public.generate_runner_passcode();

commit;
