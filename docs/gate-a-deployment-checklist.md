# Gate A Coordinated Deployment Checklist

Status: Technical verification in progress with fake data in the production project; legal approval remains required before coach pilot

## Before maintenance window

- [ ] Take and verify a Supabase backup/restore point.
- [x] Record the owner's decision to use only fake data in the production project until the coach pilot; no separate staging Supabase project will be created at this stage.
- [ ] Generate independent high-entropy production secrets for `RUNNER_SESSION_SECRET` and `RUNNER_CREDENTIAL_REVEAL_SECRET`.
- [x] Generate `SECURITY_EVENT_HASH_SECRET`; secure maintenance routes with `CRON_SECRET`; schedule the security monitor daily with a 1,440-minute lookback to match Vercel Hobby limits.
- [ ] Configure counsel-approved `PARENT_CONSENT_VERSION` and `ADULT_CONSENT_VERSION`; draft values intentionally fail in production.
- [ ] Confirm `NEXT_PUBLIC_APP_URL` is the canonical HTTPS origin so origin checks behave consistently.
- [ ] Inventory existing runners with plaintext `access_code`, missing usernames, missing team IDs, and existing public screenshot URLs.
- [ ] Notify pilot users of the maintenance window and possible runner credential rotation.

## Migration order

1. Existing foundation/team/RLS migrations required by the repository.
2. `supabase/runner-credential-session-hardening.sql`
3. `supabase/runner-age-status.sql`
4. `supabase/parent-consent-ledger.sql`
5. `supabase/adult-runner-consent.sql`
6. `supabase/privacy-requests.sql`
7. `supabase/season-closeout.sql`
8. `supabase/security-monitoring.sql`
9. Deploy the matching application release.
10. `supabase/private-activity-screenshots.sql` in the same window.

Do not deploy code that reads new columns before the corresponding migrations. Do not make the bucket private before the signed-delivery route is deployed.

## Immediate verification

- [ ] Application health check and authenticated coach sign-in pass.
- [ ] Existing coach remains restricted to their active team.
- [ ] New minor runner is `pending_parent_consent` with no hash and cannot log in.
- [ ] Linked verified guardian can consent; immutable event is present; runner becomes active.
- [ ] Coach rotates active minor credentials; plaintext remains null; hash is present.
- [ ] Parent withdrawal erases hash, increments versions and invalidates an existing runner cookie.
- [ ] New adult runner is `pending_adult_consent`; parent cannot activate or view the adult.
- [ ] Verified adult runner consents, receives a one-time passcode and controls parent access.
- [ ] Unauthenticated screenshot storage request fails.
- [ ] Authorized screenshot viewer receives a short-lived signed URL.
- [ ] Old public screenshot URLs no longer retrieve objects.
- [ ] `/api/rls-debug` returns 404 in production.
- [ ] Hostile Origin mutation returns 403.
- [ ] Security headers are present.
- [ ] Confirm head-coach-only sensitive actions, typed deletion confirmation, rate limits and audit logging work. Clerk MFA remains a documented future upgrade because it is unavailable on the Hobby plan.
- [ ] Authorized parent, adult runner and coach can submit a privacy request; an unrelated account cannot select the runner.
- [ ] Head coach can process a request; assistant coach cannot access the processing queue.
- [ ] Authorized JSON export excludes credential hashes and records an audit event.
- [ ] Synthetic deletion removes runner-linked database rows and private screenshots while retaining pseudonymous request history.
- [ ] Synthetic season closeout suspends and archives the active roster, invalidates runner sessions, and hides archived runners from operational views.
- [ ] Blank retention date and legal hold each block cleanup; an elapsed approved date permits typed-confirmation cleanup.
- [ ] Failed login, hostile origin, rejected upload and unauthorized export attempts create metadata-only security events.
- [ ] Threshold monitor creates one deduplicated alert; head coach can acknowledge and resolve it.

## Legacy credential cleanup

- [ ] Monitor legacy successful logins that automatically replace plaintext with scrypt hashes.
- [ ] Rotate credentials for remaining legacy runners during the approved window.
- [ ] Verify: active runners have `access_code_hash is not null` and `access_code is null`.
- [ ] Add the final database constraint requiring hashes for active runner accounts.
- [ ] Remove transition code and plaintext column in a later reviewed migration after rollback risk has passed.

## Rollback principles

- Do not make screenshots public as a rollback shortcut.
- If signed delivery fails, temporarily disable screenshot viewing while preserving private storage.
- If consent activation fails, keep runners pending rather than bypassing consent.
- If runner login fails, keep accounts locked and restore the prior application only with schema compatibility verified.
- Preserve consent and audit records throughout rollback.

## Evidence to retain

- Applied migration/version list
- Release/commit identifier
- Verification tester and UTC timestamps
- Staging and production security-test results
- RLS and storage policy snapshots
- Backup/restore-point identifier
- Exceptions, compensating controls and owners
