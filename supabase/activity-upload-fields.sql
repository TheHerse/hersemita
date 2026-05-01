-- Activity screenshot proof fields.
-- Run this in Supabase SQL Editor if runner screenshot uploads fail at the activities insert.

alter table public.activities
  add column if not exists uploaded_by text not null default 'runner',
  add column if not exists file_type text,
  add column if not exists original_filename text,
  add column if not exists screenshot_urls text[] not null default '{}',
  add column if not exists detected_app text,
  add column if not exists raw_distance text,
  add column if not exists raw_pace text,
  add column if not exists notes text;

create index if not exists activities_runner_id_start_time_idx
  on public.activities(runner_id, start_time desc);

-- If Row Level Security is enabled on public.activities, the app also needs
-- policies that allow runner PIN uploads and coach dashboard access.
-- Keep these policies only if this table already uses RLS.

do $$
begin
  if exists (
    select 1
    from pg_tables
    where schemaname = 'public'
      and tablename = 'activities'
      and rowsecurity = true
  ) then
    create policy "Runner screenshot uploads can create pending activities"
      on public.activities
      for insert
      to anon
      with check (
        uploaded_by = 'runner'
        and verified = false
        and file_type = 'screenshot'
        and array_length(screenshot_urls, 1) >= 1
      );
  end if;
exception
  when duplicate_object then null;
end $$;
