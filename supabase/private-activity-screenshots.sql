-- Makes activity evidence private. Deploy the application code that serves
-- short-lived, authorized signed URLs at the same time as this migration.

begin;

update storage.buckets
set public = false
where id = 'activity-screenshots';

-- Browser clients no longer need direct storage access. Uploads, signed URL
-- creation, and deletion are performed by server-side service-role routes.
do $$
declare
  policy_record record;
begin
  for policy_record in
    select policyname
    from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and (
        coalesce(qual, '') ilike '%activity-screenshots%'
        or coalesce(with_check, '') ilike '%activity-screenshots%'
      )
  loop
    execute format('drop policy if exists %I on storage.objects', policy_record.policyname);
  end loop;
end $$;

commit;
