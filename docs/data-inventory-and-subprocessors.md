# Hersemita Data Inventory and Subprocessor Register

Status: Engineering inventory; legal review pending  
Last reviewed: August 24, 2026

## Data subjects

- Minor runners age 13–17
- Adult runners age 18+
- Parents and legal guardians
- Head and assistant coaches
- School/team personnel
- Support and administrative personnel

Hersemita does not intentionally support children under 13 and does not store birth dates. Age is represented only as `unknown`, `under_13`, `minor_13_to_17`, or `adult_18_plus`; application enrollment accepts only the latter two applicable high-school states.

## Data categories and purposes

| Category | Examples | Source | Purpose | Classification |
|---|---|---|---|---|
| Runner identity | Name, grade, username, age-status category, runner email for adults | Coach, runner | Roster, authentication, consent | Student confidential |
| Guardian identity | Name, verified email, phone, relationship, Clerk ID | Coach, guardian, Clerk | Consent, parent access, communication | Student-family confidential |
| Coach identity | Name, email, Clerk ID, team role | Coach, Clerk | Authentication and team administration | Confidential |
| School/team | School name, team name, groups, membership | Coach/school | Team operations and authorization | Confidential |
| Authentication | Passcode hash, credential/session versions, signed cookies, invitation-token hashes | System | Access control and revocation | Restricted secret/security |
| Consent | Choices, document versions, verified email, authority attestation, timestamps, minimized IP evidence hash, user agent | Parent/adult runner/system | Legal evidence and access gating | Restricted legal record |
| Activity | Distance, pace, duration, dates, source, workout type, notes, verification | Runner/coach/file | Coaching and progress tracking | Student confidential |
| Wellness/recovery | HRV, heart rate, sleep, soreness, illness, body battery, RPE, injuries, training load | Runner/coach/integration | Recovery and coaching decisions | Restricted sensitive wellness |
| Uploaded proof | Sanitized JPEG workout screenshots | Runner/coach | Workout verification | Restricted student file |
| Communications | Phone, message body/type, delivery status, opt-out state | Coach, guardian, Twilio | Team informational SMS | Confidential communications |
| Audit/security | Actor, action, target, timestamp, authorization failures, rate-limit keyed hashes | System | Security, incident response, accountability | Restricted security log |
| Exports | Selected runner/activity summaries | Coach | Authorized school/team use | Restricted transient export |

## Primary stores

| Store | Data | Access boundary |
|---|---|---|
| Supabase Postgres | Coaches, teams, runners, guardians, activities, wellness, consent, messages, audit data | RLS for authenticated coach operations; explicit service-role authorization for runner/parent/adult flows |
| Supabase Storage | Sanitized activity screenshots | Private bucket; short-lived signed URLs after server authorization |
| Clerk | Coach, guardian, and adult-runner account identity, verified emails, sessions, MFA configuration | Clerk tenant and server SDK |
| Vercel | Application runtime, environment variables, deployment/runtime logs | Project roles and production controls |
| Twilio | SMS recipients, content, delivery/opt-out state | Twilio account roles and messaging configuration |
| Browser cookies | Clerk session, signed runner session, short-lived encrypted credential reveal | HTTP-only, Secure in production, scoped SameSite cookies |

## Database table inventory

- `coaches`, `teams`, `team_coach_memberships`, `team_invitations`
- `runners`, `guardian_contacts`, `runner_guardians`
- `runner_groups`, `runner_group_members`
- `activities`, `weekly_loads`, `recovery_logs`, `injuries`, `coach_alerts`
- `workout_templates`, `workout_assignments`
- `runner_consent_events`, `adult_runner_consent_events`
- `parent_message_batches`, `parent_message_recipients`
- `audit_logs`, rate-limit records
- Supabase `storage.objects` in the private `activity-screenshots` bucket

## Data flows

1. Coach authenticates with Clerk and is resolved to an active team membership.
2. Coach creates a minimal runner record with age status. Minor runners enter parent-consent pending state; adult runners enter adult-consent pending state.
3. Verified guardian email is linked through Clerk. Consent is recorded atomically before a minor runner becomes active.
4. Verified adult runner email is linked through Clerk. Adult self-consent is recorded atomically and parent access defaults to disabled.
5. Runner uses a separate random passcode. Only a scrypt hash is stored; signed runner sessions are revalidated against database status and versions on every request.
6. Files are validated, decoded under limits, stripped of metadata, re-encoded to JPEG, and stored privately. Authorized viewers receive short-lived signed URLs.
7. Coaches use team-scoped records. Parents see only linked active minors or adult runners who explicitly enable parent access.
8. Authorized exports are generated on demand and sent with `no-store` caching.

## Subprocessor register

| Provider | Current purpose | Data likely received | Required owner action |
|---|---|---|---|
| Clerk | Identity, verified email, session, optional MFA | Account identity, email, authentication telemetry | Execute/review DPA; require MFA; configure retention and breach contacts |
| Supabase | Database, object storage, server functions | All application records and sanitized screenshots | Execute/review DPA; verify region, backups, RLS, storage policy, PITR, breach contacts |
| Vercel | Hosting and server execution | Requests, IPs, runtime logs, environment secrets | Execute/review DPA; minimize logs; restrict project roles; confirm region and retention |
| Twilio | Team informational SMS | Phone numbers, message contents, delivery and opt-out data | Verify consent evidence, STOP suppression, DPA, messaging policy and retention |
| Garmin or fitness source | Optional activity source | Fitness/activity identifiers and measurements | Do not enable until data flow, contract, consent, retention, and deletion are approved |
| Google Fonts | Build-time font retrieval only | Build-system request metadata | Prefer self-hosted font to remove runtime ambiguity and improve build reliability |

No advertising, behavioral analytics, data-broker, or sale use is approved. Adding any provider requires updating this register, the privacy notice, threat model, retention schedule, and contracts before production use.

## Environment secrets and configuration

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- Clerk publishable/secret configuration
- `RUNNER_SESSION_SECRET`
- `RUNNER_CREDENTIAL_REVEAL_SECRET`
- `PARENT_CONSENT_VERSION`
- `ADULT_CONSENT_VERSION`
- Twilio credentials and sending number/service
- Cron/maintenance secrets
- Rate-limit secret
- Public application URL

Secrets must be unique per environment, stored only in the deployment secret manager, excluded from logs and client bundles, and rotated after suspected exposure or personnel changes.

## Open verification items

- Confirm every provider actually enabled in production.
- Record provider contract/DPA dates, regions, retention, deletion and breach contacts.
- Verify live Supabase tables, RLS policies, functions, bucket settings and applied migrations.
- Confirm production log fields and retention in Vercel, Clerk, Supabase and Twilio.
- Confirm whether Garmin or any OCR/monitoring provider will be enabled.
- Obtain legal approval for purposes, notices, consent versions and retention.
