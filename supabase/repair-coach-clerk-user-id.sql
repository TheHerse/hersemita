-- Repair a Hersemita coach row after switching to Clerk-backed Supabase RLS.
--
-- Your app currently stores the Clerk user id in public.coaches.email.
-- The debug endpoint showed this Clerk user id:
--   user_38fDNVAstwshF8ThHC4o4uZJOja
--
-- Run the select first, find the coach row that owns your existing runners,
-- then run exactly one of the update statements below.

select
  coaches.id,
  coaches.email,
  coaches.name,
  count(runners.id) as runner_count
from public.coaches
left join public.runners on runners.coach_id = coaches.id
group by coaches.id, coaches.email, coaches.name
order by runner_count desc, coaches.name;

-- Option A: if the row with your runners is obvious, update by id.
-- Replace 00000000-0000-0000-0000-000000000000 with that coach id.
--
-- update public.coaches
-- set email = 'user_38fDNVAstwshF8ThHC4o4uZJOja'
-- where id = '00000000-0000-0000-0000-000000000000';

-- Option B: if there is only one coach row, update it directly.
--
-- update public.coaches
-- set email = 'user_38fDNVAstwshF8ThHC4o4uZJOja';

-- Confirm the row now matches the Clerk user id.
select id, email, name
from public.coaches
where email = 'user_38fDNVAstwshF8ThHC4o4uZJOja';
