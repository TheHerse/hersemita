# Runner Portal Plan

## Recommendation

Keep Clerk for coaches only. Do not create Clerk accounts for runners or parents yet.

At 100 teams, student accounts would add invite flows, forgotten passwords, school email issues, support requests, and parent questions. A coach-controlled runner portal credential is simpler and fits the current Hersemita workflow.

The runner portal should use:

- A generated username.
- A 6-digit access code.
- A signed HTTP-only session cookie after login.
- Server-side API routes for reading runner data and submitting uploads.
- Coach-only credential rotation.

Parents should continue receiving summaries by text from the coach. A parent portal can wait until there is clear demand for parents to log in.

## Access Model

Coach access:

- Clerk-authenticated.
- Supabase RLS uses `auth.jwt()->>'sub'` matched against `coaches.email`.
- Coaches can manage only their own runners, activities, groups, calendar templates, and assignments.

Runner access:

- No Clerk account.
- Runner enters username and access code.
- `/api/runner-login` validates credentials on the server.
- Server sets a signed HTTP-only cookie.
- Runner-facing API routes derive `runner_id` from that cookie.
- The browser never decides which runner it is allowed to act as.

## Database Work

Run these SQL files in Supabase SQL Editor:

1. `supabase/runner-upload-username.sql`
2. `supabase/runner-portal-calendar.sql`

Do not add anonymous read policies for `runners`, `activities`, or calendar tables. Runner access should go through server routes.

## Pages To Build

Keep:

- `/runner/login`
- `/runner/upload`

Add next:

- `/runner/dashboard`: personal stats and recent uploads.
- `/runner/calendar`: read-only workouts visible to that runner.

The server should expose runner-safe API routes:

- `GET /api/runner-session`
- `POST /api/runner-login`
- `DELETE /api/runner-session`
- `POST /api/runner-activities`
- `GET /api/runner-analytics`
- `GET /api/runner-calendar`

## Security Rules

- Never trust `runner_id` from browser localStorage, query params, form fields, or request bodies.
- Always derive runner identity from the signed runner session cookie.
- Rotate runner credentials if a code is shared.
- Keep RLS enabled on Supabase tables.
- Keep `SUPABASE_SERVICE_ROLE_KEY` server-only.
- Do not expose service-role logic in client components.

## Scaling Notes

For 100 teams:

- Coach onboarding matters more than student account management.
- Token-based runner upload keeps support light.
- Monthly or weekly parent SMS summaries are enough until parents ask for direct login.
- Calendar assignments should be stored in Supabase, not browser `localStorage`, so all devices see the same plan.
