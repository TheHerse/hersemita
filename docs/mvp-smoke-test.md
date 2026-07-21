# Hersemita MVP Smoke Test

Use this after each Phase 5 deploy and before inviting a real pilot coach.

## Coach Portal

- Sign in as a coach and open `/dashboard`.
- Confirm team totals load and no page shows an auth or Supabase error.
- Confirm `Training Load & Recovery` ranks current risk clearly.
- Open `/analytics` and confirm `Coach Action Queue` has useful follow-ups.
- Export `Activity CSV` and `Runner Summary` from `/analytics`.
- Open `/activities`, view screenshot proof, close it, and verify filters still work.
- Open `/calendar` and confirm month stats reflect the viewed month.
- Open `/runners/message`, confirm recipient counts, and confirm SMS blocks links and phone numbers.
- Open `/runners/message/history` and confirm sent/mock/error entries are readable.
- Open `/settings/audit` and confirm recent high-impact actions are readable.

## Runner Portal

- Sign in with a runner username and passcode.
- Confirm `/runner/dashboard` shows totals, recent verified runs, and friendly source labels.
- Confirm `/runner/upload` loads and allows screenshot upload or manual entry.
- Confirm upload helper text explains RPE and Garmin load.
- Confirm `/runner/recovery` saves a check-in and shows recent check-ins.
- Confirm `/runner/calendar` shows only current/future assigned workouts.
- Log out and confirm protected runner pages redirect to `/runner/login`.

## Parent Portal

- Sign in as a parent/guardian.
- Confirm `/parent/dashboard` only shows linked runners.
- Open each linked runner and confirm training, coach notes, and recovery are readable.
- Confirm effort labels are parent-friendly: Easy, Steady, Hard, Very hard.
- Try an unlinked runner URL and confirm it redirects back to `/parent/dashboard`.
- Try a raw runner UUID URL and confirm it redirects back to `/parent/dashboard`.

## Data Hygiene

- Confirm fake/demo seed data is only present while testing.
- Before a real pilot, either remove demo seed data or keep it on a separate test team.
- Confirm no public page requires authentication when Twilio reviewers need to inspect it: `/privacy`, `/terms`, `/sms-consent`.
