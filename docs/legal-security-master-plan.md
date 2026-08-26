# Hersemita Legal, Privacy, and Security Master Plan

Status: Draft implementation roadmap  
Primary launch market: Texas high-school teams  
Business location: Tennessee  
Last updated: August 26, 2026

## Implementation status

Last implementation review: August 26, 2026

- Implemented and production-verified with fake data: private activity screenshot references, authorized short-lived signed URL delivery, and removal of public screenshot access.
- Implemented and production-verified with fake data: scrypt-hashed runner passcodes, password-gated encrypted coach reveal, dedicated runner session secret, versioned session revocation, and per-request portal-status/version revalidation.
- Added deployment migrations: `supabase/private-activity-screenshots.sql` and `supabase/runner-credential-session-hardening.sql`.
- Verification completed: ESLint, TypeScript, 21 local security tests, secret scanning, dependency auditing, and the full Next.js production build pass.
- Implemented in code, pending migration and counsel-approved version configuration: new runners are created in `pending_parent_consent`, cannot receive credentials or use runner APIs, linked verified guardians receive a separate-checkbox consent screen, and activation plus immutable consent evidence is performed atomically by a restricted database function.
- Parent consent production safeguard: the consent route refuses to run in production unless `PARENT_CONSENT_VERSION` identifies a non-draft, counsel-approved document version.
- Implemented in code, pending migration: parent withdrawal records an immutable event, revokes the runner, erases the passcode hash, and invalidates every session immediately.
- Implemented in code: JPEG/PNG allowlisting, magic-byte verification, 8 MB compressed limit, 25-megapixel decoded limit, animation/multi-page rejection, three-file request limit, strict Sharp decoding, metadata-stripping JPEG re-encoding, and a ten-second processing timeout.
- Implemented in code: baseline HSTS, frame denial, MIME sniffing protection, referrer and browser-permission headers; `/api/rls-debug` returns 404 in production.
- Still required before Gate A closes: final counsel-approved wording, backup/restore verification, monitoring-alert exercise, incident tabletop, independent penetration testing, and external operational/legal actions.
- Implemented in code, pending migrations and approved document version: minimized age-status attestation without birth dates, under-13 enrollment rejection, adult-transition credential revocation, verified-email adult self-consent, one-time adult credentials, and adult-controlled parent access.
- Implemented in code: exact-origin checks for browser-facing login, upload, recovery, runner-session, coach-upload, and calendar mutations.
- Implemented locally and in CI: 21 automated security tests covering credential hashing/vault binding/session behavior, consent choices, privacy restrictions, request bounds, CSV formula neutralization, upload signatures/size/truncation/decompression bombs/sanitization, cross-team authorization, and origin rejection.
- Engineering documentation completed: data/subprocessor inventory, draft retention/deletion schedule, incident-response runbook, security test matrix, and coordinated Gate A deployment checklist. Provider contracts, exact retention decisions, legal contacts, and live test evidence remain external actions.
- Implemented in code: screenshot decoding and sanitizing now runs in a separately packaged worker thread with bounded V8 memory/stack settings, parent and Sharp deadlines, structured failure handling, and forced termination. The production build contains the emitted worker asset. A future external queue/process can provide stronger infrastructure-level isolation if upload volume requires it.
- Implemented in code: strict per-request nonce Content Security Policy integrated with Clerk, restrictive object/base/frame rules, configured Supabase asset/connect origins, and production-only removal of `unsafe-eval`.
- Implemented in code: bounded JSON readers on runner and calendar mutations; calendar record/count/string/date/ID validation before destructive replacement; bounded export filters; and spreadsheet-formula neutralization in CSV files.
- Implemented in code and CI configuration: repository secret-pattern scan, high-severity production dependency audit, security tests, lint, TypeScript, production build, CycloneDX SBOM artifact, and Dependabot schedules.
- Dependency remediation completed locally: upgraded Clerk past the route-protection advisories, upgraded Next.js to 16.3.2, upgraded Sharp to 0.35.3, and replaced the vulnerable GPX parser dependency chain with a bounded local parser. `npm audit --omit=dev` reports zero vulnerabilities.
- Product constraint: Clerk MFA and production passkeys require a paid plan and are not current launch dependencies. Free-plan compensating controls include head-coach-only sensitive actions, typed destructive confirmation, rate limits, per-request authorization and audit logging. MFA remains a future security upgrade.
- Implemented in code, pending migration: authorized privacy-request intake for coaches, linked guardians and verified-email adult runners; bounded/rate-limited access, correction, export, restriction and deletion requests; and immutable request-event history.
- Implemented in code, pending migration and staging verification: head-coach privacy processing queue, authorized no-store JSON exports, immutable status transitions, request-specific deletion confirmation, private screenshot removal, and transactional runner deletion that preserves pseudonymous completion evidence.
- Implemented in code, pending migration and staging verification: end-of-season inventory snapshots, immediate runner credential/session revocation, archived-roster separation, optional approved retention dates, legal holds, audit-logged control changes, and retention-gated permanent cleanup with private-file removal.
- Implemented, migrated, and scheduled daily within Vercel Hobby limits: metadata-only security events with pseudonymous actor references, authentication/origin/upload/authorization/export coverage, threshold-generated alerts, head-coach monitoring dashboard, audited alert acknowledgement/resolution, and audit coverage for team exports and calendar replacement.

Deployment order for the completed code slices:

1. Configure strong random `RUNNER_SESSION_SECRET` and `RUNNER_CREDENTIAL_REVEAL_SECRET` production secrets.
2. Apply `supabase/runner-credential-session-hardening.sql`.
3. Apply `supabase/parent-consent-ledger.sql`.
4. Configure the counsel-approved `PARENT_CONSENT_VERSION`.
5. Deploy the application code.
6. Apply `supabase/private-activity-screenshots.sql` in the same maintenance window, then verify authorized screenshot viewing.
7. Rotate runner credentials that do not complete automatic legacy upgrade during the migration window.
8. Confirm all active runners have `access_code_hash` and `access_code` is null before adding the final hash-required database constraint.

## Purpose

This is the controlling roadmap for preparing Hersemita to handle minor students' identity, contact, training, wellness, recovery, screenshot, school, and team information. It is intended to remain useful even when implementation order changes.

This document is not legal advice. Final policies, consent language, school contracts, retention rules, and interpretations of Texas, Tennessee, federal student-privacy, children's-privacy, communications, and breach-notification law must be approved by qualified counsel.

## Non-negotiable launch rules

Hersemita must not onboard minor runners into production until all Gate A requirements are complete.

1. A minor runner cannot access the portal or submit data until a verified and authorized parent or guardian completes the required consent process.
2. An adult runner must consent for themselves. Parent access to an adult runner requires the runner's authorization.
3. Every sensitive request must revalidate identity, account status, current consent, role, team or guardian relationship, object ownership, and permitted action.
4. Runner credentials must never be stored in plaintext.
5. Student screenshots and files must never be public objects.
6. Uploaded originals must never be served directly.
7. Hersemita must collect only data required for a documented coaching purpose.
8. No student data may be sold, used for targeted advertising, or used to build an unrelated profile.
9. Production security claims must be accurate and supportable. Do not claim that the service is "unhackable," "HIPAA compliant," "FERPA certified," or uses "the highest security" without a documented basis.
10. A school, parent, or adult runner must have a defined method to request access, correction, export, revocation, and deletion.

## Roles and authority model

The product and database must use these explicit roles:

- Head coach: Manages the team, assistant coaches, roster, invitations, team exports, and team-level deletion requests.
- Assistant coach: Uses only permissions explicitly granted by the head coach and school. Cannot manage legal terms, team ownership, or other coaches unless authorized.
- Parent or guardian: May see only runners linked through a verified guardian relationship. May consent, revoke consent, manage runner access, and request privacy actions for a minor.
- Minor runner: May use only the runner portal functions authorized by current parental consent. Cannot alter consent, guardian links, team membership, or access controls.
- Adult runner: Controls their own consent and determines whether parent access remains active.
- Hersemita administrator: Uses a separate, strongly authenticated support role. Access must be time-limited, justified, and audited. There must be no ordinary hidden superuser UI.
- Scheduled service: Uses narrowly scoped credentials for a single documented maintenance operation.

## Required request authorization sequence

Every sensitive server action and API route must enforce this sequence on the server:

1. Authenticate the caller or validate the runner session.
2. Confirm the account is enabled and not suspended or deleted.
3. Confirm required consent is current and not withdrawn.
4. Resolve the caller's current team, guardian links, or runner identity from trusted server-side records.
5. Confirm the requested record belongs to that allowed team or runner.
6. Confirm the role permits the requested action.
7. Validate and normalize the input.
8. Perform the operation through row-level security or an equally restrictive server-side query.
9. Write an audit event for sensitive changes, exports, consent changes, and support access.

Client-supplied `runnerId`, `teamId`, `coachId`, `guardianId`, or role values must never establish authority.

## Phase 0 — Governance and data inventory

Priority: Immediate  
Blocks: Legal drafting, consent implementation, retention, incident response

### Work

- Assign one person as privacy and security owner.
- Create a complete data inventory covering database columns, storage objects, authentication providers, logs, analytics, email, SMS, backups, exports, support tools, and local development data.
- Create a data-flow map from collection through processing, disclosure, storage, backup, export, and deletion.
- Classify each field as public, internal, confidential, student personal information, authentication secret, or sensitive wellness/health information.
- Record the purpose and legal/contractual basis for every collected field.
- Remove fields without a necessary and documented coaching purpose.
- Inventory every subprocessor, including Clerk, Supabase, Vercel, Twilio, email delivery, monitoring, analytics, error tracking, and any Garmin or fitness integration.
- Record each subprocessor's purpose, data received, region, retention, deletion process, breach obligation, and contract/DPA status.
- Decide whether Hersemita will prohibit all under-13 runner accounts. For a high-school-only product, prohibition is preferred unless a verified COPPA process is deliberately implemented.
- Decide the authoritative age states: `under_13`, `minor_13_to_17`, and `adult_18_plus`. Store a full birth date only if counsel and product requirements establish a need.
- Product decision (August 2026): Hersemita will not store a birth date or the exact date a runner turns 18. Age handling will use a minimized status attestation (`under_13`, `minor_13_to_17`, or `adult_18_plus`), seasonal reconfirmation, and an explicit manual transition. A runner marked as becoming an adult must be suspended until the adult runner accepts the current terms and privacy/consent notices for themselves. Parent access must then remain disabled unless the adult runner affirmatively reauthorizes it.
- Define supported customer types: Texas public schools, charter schools, private schools, independent clubs, or individual coaches. Legal and contractual requirements may differ.
- Establish a policy register with policy owner, version, approval date, effective date, and next review date.

### Deliverables

- Data inventory
- Data-flow diagram
- Subprocessor register
- Field-level data classification
- Product age policy
- Supported-customer policy
- Legal requirements matrix for Texas, Tennessee, and applicable federal law

### Acceptance criteria

- Every production data field and third-party transfer has a documented purpose, owner, classification, retention period, and deletion method.
- No unknown analytics, logging, or subprocessors receive student data.

## Phase 1 — Emergency technical risk reduction

Priority: Critical  
Blocks: Any production use by minors

### 1.1 Make evidence files private

- Change the `activity-screenshots` bucket to private.
- Stop using `getPublicUrl` for student or team files.
- Issue short-lived signed URLs only after a current authorization check.
- Use opaque random object keys rather than runner IDs and timestamps in public-facing paths.
- Separate original quarantine storage from sanitized delivery storage.
- Migrate existing objects and invalidate or remove prior public access.
- Review logs, messages, and database rows for previously generated public URLs.

Acceptance criteria:

- An unauthenticated request cannot retrieve any student upload.
- A coach from Team A cannot obtain a signed URL for Team B.
- A parent can obtain a URL only for a currently linked runner.
- A runner can obtain a URL only for their own allowed record.
- Signed URLs expire and cannot be reused after the intended period.

### 1.2 Replace plaintext runner credentials

- Hash runner passcodes with Argon2id or scrypt using a unique salt.
- Generate at least 12–16 random human-enterable characters.
- Show a newly generated code once; never display or recover the stored credential later.
- Provide reset rather than reveal.
- Redact credentials from logs, audit events, URLs, analytics, email previews, and support tools.
- Migrate every existing runner credential and force a reset where the original cannot be safely transformed.

Acceptance criteria:

- No database column, log, export, or admin response contains a usable runner passcode.
- A database-only compromise does not reveal runner credentials.

### 1.3 Implement revocable runner sessions

- Add runner portal status, consent version, credential version, and session version.
- Use a dedicated `RUNNER_SESSION_SECRET`; production startup must fail if it is missing.
- Do not reuse Clerk or Supabase secrets to sign runner sessions.
- Revalidate runner existence, portal status, consent state, credential/session version, and expiration on every request.
- Shorten session lifetime and implement inactivity expiration.
- Rotate the session after login and privilege-relevant changes.
- Provide logout, logout-all-devices, parent revocation, coach suspension, and administrator emergency revocation.
- Store only the minimum session payload required.

Acceptance criteria:

- Changing a passcode, withdrawing consent, disabling the portal, unlinking a guardian, or removing the runner immediately invalidates existing sessions.
- A hardcoded development fallback cannot run in production.

### 1.4 Verify production database isolation

- Create a migration ledger and record which SQL migrations are applied to each environment.
- Verify RLS is enabled on every table containing coach, guardian, runner, activity, recovery, injury, alert, message, invitation, audit, or team information.
- Verify hardened team policies are installed and permissive legacy policies are removed.
- Verify service-role access is never exposed to a client bundle.
- Minimize service-role usage; prefer authenticated RLS clients where possible.
- Add database tests for cross-team, cross-parent, and cross-runner access.
- Verify storage policies separately from database RLS.

Acceptance criteria:

- Automated negative tests prove that changing an identifier cannot cross a team or family boundary.
- The deployed policy list matches the repository's approved policy baseline.

### 1.5 Disable unnecessary production diagnostics

- Remove or production-disable `/api/rls-debug`.
- Ensure error responses do not expose SQL, policy, storage, token, stack, or provider details.
- Review source maps and build output for secret or internal-path exposure.

## Phase 2 — Parent consent and age-gated activation

Priority: Critical  
Blocks: Any minor runner portal access

### 2.1 Pending enrollment state

- Coaches may create only a minimal pending runner record.
- Pending runners cannot log in, upload, enter recovery data, or receive a usable runner credential.
- Invitation tokens must be random, hashed at rest, single-use, scoped to one guardian/runner relationship, and expire quickly.
- A coach cannot mark consent as completed on the parent's behalf.

### 2.2 Parent identity and authority

- Require Clerk authentication and an explicitly verified email.
- Require the verified email to match the guardian invitation or school record.
- Require an attestation of parent/legal-guardian authority and relationship.
- Use coach or school confirmation for ambiguous or changed relationships.
- Provide a documented process for custody disputes and access challenges; freeze access rather than choosing a side without verified authority.

### 2.3 Consent presentation

Present separate, unchecked decisions for:

- Agreement to Terms of Service
- Acknowledgment of the Privacy Notice
- Attestation of parental/legal authority
- Authorization for the minor to use the runner portal
- Authorization to process identity, school/team, training, screenshot, and wellness/recovery information
- Authorization for parent portal display of wellness/recovery information
- Optional SMS consent with phone number, message categories, frequency, rates, STOP, and HELP terms
- Any genuinely optional integration or secondary use

Do not bundle optional SMS, optional integrations, marketing, or unnecessary processing into required service consent.

### 2.4 Consent evidence

Store an immutable consent event containing:

- Parent user and guardian IDs
- Runner and team IDs
- Verified email and asserted relationship
- Exact policy and consent document versions or cryptographic hashes
- Each separate choice
- UTC timestamp
- Invitation source and initiating coach/school
- Minimized IP and user-agent evidence
- Effective date, withdrawal date, and superseding event

Send the parent a durable copy. Consent records must not be editable in place; corrections and withdrawals create new events.

### 2.5 Activation and lifecycle

- Activate the runner only after all required consent checks pass.
- Generate the runner credential after activation.
- Notify the parent of activation and provide immediate revocation controls.
- Require new consent when a material policy, purpose, data category, or recipient changes.
- When the school, coach, parent, or runner reports that the runner is now 18, suspend minor-authority assumptions and runner access until the runner accepts adult terms. Because Hersemita will not retain an exact birth date, the status must be reconfirmed at least once per season and the reporting/transition event must be audited. Parent access becomes an explicit adult-runner choice.
- If the service ever permits an under-13 user, block activation unless the separately designed COPPA verifiable-parental-consent process succeeds.

Acceptance criteria:

- There is no route, server action, API, or database path that lets a pending or revoked runner use the portal.
- Consent history proves exactly who agreed to what language and when.
- Withdrawal immediately stops new processing except necessary security, legal, and deletion operations.

## Phase 3 — Legal documents and school contracting

Priority: Critical  
Blocks: Production school onboarding

### 3.1 Terms of Service

Counsel-approved Terms should address at least:

- Contracting business identity and contact information
- Eligibility, age, and authority to agree
- Coach, parent, guardian, minor-runner, and adult-runner responsibilities
- School authorization and approved-use requirements
- Account and credential security
- Acceptable use and prohibited activity
- Student-data restrictions
- Uploaded-content ownership and limited service license
- Feedback and product intellectual property
- Third-party services and integrations
- Availability, changes, suspension, and termination
- Export and deletion following termination
- Warranty disclaimers
- Carefully drafted limitation of liability
- Indemnification where appropriate
- Governing law, venue, dispute process, and any arbitration/class-waiver decision
- Notices, changes, assignment, severability, waiver, and entire agreement

### 3.2 Privacy Notice

The notice must accurately describe:

- Every category of information collected
- Sources, including coach, school, parent, runner, uploaded files, devices, and integrations
- Purpose for each category
- Sensitive wellness/health and student-data treatment
- Cookies, sessions, IP/rate-limit data, security logs, and analytics
- Service providers and disclosures
- No sale, targeted advertising, or unrelated profiling of student data
- Retention periods or clear criteria
- Security practices described without guarantees
- Parent, student, school, and adult-runner rights and request methods
- Consent withdrawal and account deletion
- Children's and under-13 policy
- Texas and other state privacy disclosures where applicable
- Breach and incident communications
- International or cross-border processing if applicable
- Policy changes, effective date, and contact details

### 3.3 School Data Processing Agreement

Create a school/district DPA addressing:

- FERPA school-official requirements where relied upon
- Texas Education Code Chapter 32 student-information restrictions
- Purpose limitation and school control
- Data ownership
- Confidentiality and personnel access
- Security safeguards
- Subprocessor approval and flow-down terms
- Incident notification deadline shorter than the school's legal deadline
- Cooperation with investigations and notifications
- Parent/student access, correction, export, and deletion
- Data return/deletion at contract end
- Backup deletion schedule
- Audit evidence and security documentation
- Prohibition on sale, targeted advertising, unrelated profiling, and unauthorized redisclosure
- Records retention and legal holds
- Allocation of responsibilities between Hersemita, school, coaches, parents, and providers

### 3.4 SMS compliance package

- Maintain separate SMS terms and consent language.
- Capture the phone owner, number, exact disclosure, timestamp, source, and consent method.
- Confirm Twilio STOP/START/HELP handling and suppression behavior.
- Suppress opted-out numbers across every coach and team workflow.
- Separate informational team messages from marketing.
- Do not describe messages as manual if automation changes.
- Periodically reconcile application records with provider opt-out status.

### 3.5 Clickwrap and versioning

- Add conspicuous policy links at sign-up and consent.
- Require affirmative unchecked acceptance.
- Store document version and acceptance evidence.
- Prevent use when required current terms have not been accepted.
- Maintain archived copies of every effective version.

Acceptance criteria:

- Texas education/privacy counsel approves the production documents and consent flow.
- Tennessee counsel confirms business-level terms, venue, breach, and operational obligations.
- No public statement contradicts actual data handling or security.

## Phase 4 — Secure upload and file-processing architecture

Priority: Critical for screenshots  
Blocks: Production uploads

Absolute prevention of denial of service is impossible. The goal is to reject hostile input early, isolate expensive work, prevent uploaded content from executing, and preserve service availability.

### 4.1 Edge and request controls

- Enforce content-length limits before the application reads the body.
- Limit files per request, requests per hour/day, bytes per runner/team/day, and total storage.
- Use account, team, IP, and abuse-signal rate limits.
- Reject requests when the processing queue is full.
- Stream uploads; do not buffer an unbounded request in the main web process.
- Use generic client errors and detailed private security logs.

### 4.2 Image-only allowlist

- Initially permit only JPEG and PNG.
- Reject SVG, HTML, XML, PDF, archives, executables, office files, and unknown formats.
- Verify magic bytes and decoded format; never trust filename extension or browser MIME type.
- Enforce compressed-byte, width, height, total-pixel, frame-count, and metadata limits.
- Reject animation and malformed/truncated files.
- Sanitize filenames and ignore client-provided storage paths.

Suggested initial limits, subject to testing:

- 8 MB compressed input per image
- 3 images per activity
- 25 megapixels decoded per image
- 20 uploads per runner per hour
- Explicit daily byte and object quotas

### 4.3 Isolated processing

- Upload originals to non-public quarantine storage.
- Process images in a separate bounded worker, not the request-serving process.
- Apply per-job memory, CPU, wall-clock, concurrency, and output-size limits.
- Decode, auto-rotate, strip EXIF/GPS/comments/profiles, resize, and re-encode to a fresh JPEG.
- Store only the sanitized output in the private delivery bucket.
- Delete quarantined originals promptly after success or failure.
- Treat repeated malformed inputs as an abuse signal.
- Keep image-processing dependencies patched and regression-test known decompression-bomb cases.

### 4.4 Safe delivery

- Authorize before generating a signed URL.
- Use a media origin that receives no application authentication cookies.
- Set a fixed safe `Content-Type` and `X-Content-Type-Options: nosniff`.
- Use `Content-Disposition: attachment` for any future non-image documents.
- Use random server-generated object identifiers.
- Never interpolate uploaded content into HTML.
- Never execute, import, shell-open, or pass uploaded data to a command constructed from user input.

### 4.5 Future file formats

- Do not add PDF, FIT, GPX, CSV, ZIP, or office-document support to the image pipeline.
- Create a separate sandbox and strict parser policy for each format.
- Antivirus is supplemental, not a replacement for allowlisting, isolation, resource limits, and safe rendering.
- Store and serve only normalized outputs when possible.

Acceptance criteria:

- Tests cover oversized bodies, false extensions, MIME mismatches, decompression bombs, excessive dimensions, animation, corrupt images, multiple files, rate-limit bypass attempts, queue saturation, and unauthorized retrieval.
- A worker crash does not crash the web application.
- Uploaded bytes cannot be interpreted as executable web content.

## Phase 5 — Application and infrastructure hardening

Priority: High  
Blocks: Broad production rollout

### Authentication and privileged access

- Require MFA for head coaches and Hersemita administrators.
- Strongly encourage or require MFA for assistant coaches and parents.
- Separate production administration from ordinary coach accounts.
- Use least-privilege provider roles and separate development, staging, and production projects.
- Rotate secrets on a schedule and after personnel or incident changes.
- Prohibit shared accounts.

### Web security

- Add a tested Content Security Policy.
- Add HSTS, `X-Content-Type-Options`, Referrer-Policy, Permissions-Policy, and appropriate frame protections.
- Set `Cache-Control: no-store` on sensitive pages and APIs where appropriate.
- Validate Origin/CSRF protections for state-changing requests.
- Use schema validation and explicit maximum lengths for all inputs.
- Escape spreadsheet exports to prevent CSV/formula injection.
- Restrict redirects to approved local destinations.
- Remove provider and database error details from responses.

### API and business logic

- Maintain a route-by-route authorization matrix.
- Apply bounded pagination and result limits.
- Validate dates and physiological/activity values against reasonable ranges.
- Prevent duplicate/replayed submissions with idempotency controls where needed.
- Ensure exports are authorized, audited, rate-limited, and not cached.
- Require recent authentication for high-risk changes and exports.
- Add abuse protections to invitations, SMS, login, exports, and deletion.

### Secrets and dependencies

- Add secret scanning, dependency auditing, static analysis, and linting to CI.
- Generate and retain an SBOM for production releases.
- Pin and routinely update critical dependencies.
- Protect production environment variables and prevent them from entering previews or logs.
- Establish patch deadlines by severity.

### Availability and recovery

- Add database connection, request, job, and storage quotas.
- Configure timeouts, retry limits, circuit breakers, and backpressure.
- Protect expensive analytics and OCR operations with queues and concurrency limits.
- Maintain encrypted backups and test restoration.
- Define recovery-time and recovery-point objectives.
- Establish a status and emergency communication method independent of the application.

Acceptance criteria:

- Threat-model review is complete.
- Automated security tests pass in CI.
- Backup restoration is demonstrated.
- Privileged access is inventoried and MFA-protected.

## Phase 6 — Retention, deletion, and privacy rights

Priority: High  
Blocks: Broad production rollout

### Retention schedule

Counsel and product owners must assign a retention period to:

- Pending invitations
- Consent records
- Runner and guardian accounts
- Activities and screenshots
- Recovery, injury, illness, heart-rate, HRV, sleep, and soreness data
- SMS consent and message records
- Exports
- Audit and security logs
- Rate-limit records
- Support records
- Backups
- Deleted-account tombstones and legal holds

Default to the shortest operationally and legally supportable period.

### Rights workflow

- Provide authenticated parent, adult-runner, and school request channels.
- Verify identity and authority before disclosure or deletion.
- Support access, correction, export, consent withdrawal, account closure, and deletion.
- Track deadlines and request status.
- Export in a readable, secure format.
- Avoid disclosing another guardian's private information during a response.
- Apply deletion across primary storage, derived data, caches, search indexes, and scheduled backup expiry.
- Document exceptions for security records, legal claims, and valid legal holds.

### End-of-season and contract termination

- Ask the school whether accounts roll forward or close.
- Disable stale runner access automatically.
- Reconfirm guardian links and consent for each new season when appropriate.
- Return or delete school data under the DPA.
- Produce a deletion completion record.

## Phase 7 — Logging, monitoring, and incident response

Priority: High  
Blocks: Broad production rollout

### Audit logging

Record:

- Consent, withdrawal, and policy-version changes
- Runner activation, suspension, credential reset, and session revocation
- Guardian linking and unlinking
- Coach invitations, role changes, and removals
- Sensitive record creation, update, deletion, and export
- Signed-file URL issuance
- Support/admin access
- Repeated login, upload, and authorization failures

Do not log passwords, passcodes, session cookies, full tokens, sensitive notes, full phone numbers, or raw student uploads.

### Monitoring

- Alert on authentication spikes, cross-boundary authorization failures, upload rejections, queue saturation, unexpected exports, mass deletion, new administrator access, and provider configuration changes.
- Monitor dependency advisories, storage permissions, RLS drift, expired certificates/secrets, backup failures, and email/SMS delivery anomalies.
- Protect logs from ordinary application users and unauthorized modification.

### Incident-response plan

Create playbooks for:

- Lost or stolen credentials/session
- Public file exposure
- Cross-team or cross-family access
- Database or provider compromise
- Malicious upload or availability attack
- Accidental disclosure by coach or support staff
- SMS sent after opt-out
- Compromised subprocessor
- Lost administrator device

Each playbook must cover containment, evidence preservation, legal assessment, notification, remediation, credential rotation, communications, and post-incident review.

Maintain current contact details for counsel, insurers, schools, subprocessors, forensic support, and affected-user communications. Design the process to satisfy the shortest potentially applicable notification deadline rather than waiting for the outer legal limit.

Acceptance criteria:

- Conduct and document a tabletop exercise before broad launch and at least annually.
- Test emergency session revocation, bucket lockdown, key rotation, and restoration.

## Phase 8 — Verification and independent testing

Priority: Critical validation  
Blocks: Broad production rollout

### Automated security test matrix

Create at least two teams, two coaches, two parents, and two runners and verify:

- Coach A cannot read or mutate Team B.
- Assistant-coach permissions cannot become head-coach permissions.
- Parent A cannot enumerate or access Parent B's runner.
- Runner A cannot access Runner B by changing URLs, bodies, filenames, or cookies.
- A pending, disabled, deleted, consent-withdrawn, or version-stale runner cannot use any route.
- A removed coach immediately loses access.
- Public/anonymous requests cannot retrieve student information or files.
- Service-role operations reproduce the same authorization boundary explicitly.
- Exports cannot include unselected or unauthorized runners.
- Signed URLs are scoped and expire.
- Rate limits work across application instances.

### Security reviews

- Perform static application review after the major authorization and upload changes.
- Perform dynamic authenticated testing against staging.
- Commission an independent penetration test before district-wide adoption.
- Remediate critical and high findings before launch; document risk acceptance for anything deferred.
- Repeat testing annually and after major authentication, storage, integration, or role changes.

### Legal verification

- Have Texas education/privacy counsel review the actual screens and data flows, not only policy text.
- Have Tennessee counsel review business formation, contracts, governing law, insurance, breach, and operational exposure.
- Re-review when entering another state or adding a materially different customer type.

## Phase 9 — Operational readiness and launch

Priority: Final launch gate

### Internal readiness

- Train coaches and support personnel on student confidentiality, consent, exports, screenshots, custody disputes, incident reporting, phishing, and account security.
- Create a coach onboarding checklist and prohibited-use summary.
- Create parent-facing explanations in plain language.
- Establish support identity-verification procedures.
- Obtain appropriate cyber/privacy and technology errors-and-omissions insurance.
- Confirm business contact, legal notice, privacy request, and security report channels are monitored.

### School onboarding packet

- Signed service agreement and DPA
- Current Terms and Privacy Notice
- Parent consent materials
- Subprocessor list
- Security overview with accurate, measured claims
- Retention/deletion schedule
- Incident contact process
- Access and deletion request procedure
- Coach/admin training material

### Launch gates

#### Gate A — No minor production use before all are complete

- Private screenshot storage and authorized signed delivery
- Hashed runner credentials
- Revocable and revalidated runner sessions
- Verified production RLS/storage policies
- Parent-gated activation and immutable consent evidence
- Under-13 handling and adult-runner transition
- Counsel-approved Terms, Privacy Notice, consent, and school DPA
- Safe isolated upload processing with hard limits
- Incident-response plan and monitored security contact
- MFA for head coaches and administrators
- Successful cross-role authorization test suite

#### Gate B — One-team controlled pilot

- Written school authorization
- One trained head coach
- All participating parents properly consented
- Daily monitoring during onboarding
- Verified backups and emergency revocation
- No unresolved critical or high security finding
- Defined pilot end date and review

#### Gate C — Multiple teams or district rollout

- Independent penetration test completed
- Counsel signs off on any pilot changes
- Incident-response tabletop completed
- Restore test completed
- Subprocessor and DPA review completed
- Support and privacy-request capacity demonstrated
- Metrics show no unresolved authorization, upload, consent, or deletion failure

## Phase 10 — UI redesign after the critical foundation

The planned UI redesign should follow the legal and authorization model rather than precede it.

Safe UI work that may proceed early:

- Visual design system
- Public marketing pages that make no unsupported claims
- Component accessibility
- Non-sensitive navigation prototypes
- Consent and enrollment wireframes reviewed by counsel before implementation

UI work that should wait for the underlying model:

- Runner onboarding
- Parent onboarding
- Role-specific navigation
- Privacy controls
- Account and session management
- Upload flows
- Data exports
- Deletion flows
- Adult-runner transition

The UI must never imply that a hidden control is a security boundary. Authorization remains server-side.

## Change-control rules for deviations

When work deviates from this sequence:

1. Record the deviation, owner, reason, affected requirements, and expected return date.
2. Determine whether it weakens a launch gate.
3. Do not mark a gate complete while a requirement is deferred.
4. Record compensating controls and residual risk.
5. Require privacy/security owner approval for sensitive-data changes.
6. Require counsel review for new data categories, purposes, states, customer types, integrations, advertising, or sharing.
7. Update the data inventory, threat model, policies, tests, and retention schedule in the same release as the product change.

## Definition of done for every sensitive feature

A feature touching student, guardian, coach, school, authentication, file, message, or wellness information is not done until:

- Purpose and data minimization are documented.
- Applicable consent and policy effects are reviewed.
- Authorization rules are defined and enforced server-side.
- RLS or equivalent isolation is tested.
- Inputs, sizes, rates, and outputs are bounded.
- Audit and monitoring requirements are implemented.
- Retention and deletion behavior are implemented.
- Error handling avoids sensitive disclosure.
- Automated positive and negative tests pass.
- Documentation and data inventory are updated.
- Legal/security review is completed when required.

## Master completion checklist

### Legal and privacy

- [ ] Texas education/privacy counsel retained
- [ ] Tennessee business/privacy counsel consulted
- [ ] Data inventory and flow map complete
- [ ] Terms approved
- [ ] Privacy Notice approved
- [ ] Parent/minor consent approved
- [ ] Adult-runner transition approved
- [ ] Under-13 policy implemented
- [ ] School agreement and DPA approved
- [ ] SMS consent and opt-out process verified
- [ ] Subprocessor contracts and list complete
- [ ] Retention/deletion policy approved
- [ ] Privacy request process operational
- [ ] Incident/breach legal matrix complete
- [ ] Clickwrap and version archive operational

### Identity and authorization

- [ ] Coach/admin MFA required
- [ ] Parent verified-email requirement enforced
- [ ] Parent authority confirmation implemented
- [ ] Pending runner cannot access any runner function
- [ ] Runner credentials hashed
- [ ] Dedicated session secret required
- [ ] Runner sessions revocable and versioned
- [ ] Consent revalidated on every runner request
- [ ] Adult transition enforced
- [ ] Coach team membership revalidated
- [ ] Parent guardian link revalidated
- [ ] Service-role usage minimized and explicitly authorized
- [ ] Cross-team/family/runner tests pass

### Data and storage

- [ ] Screenshot bucket private
- [ ] Existing public objects migrated
- [ ] Signed URLs authorized and short-lived
- [ ] Opaque object names used
- [ ] Retention jobs implemented
- [ ] Deletion reaches derived data and storage
- [ ] Backups encrypted and restore tested
- [ ] Production data prohibited from ordinary development use

### Upload security

- [ ] Edge body-size limits
- [ ] File-count and quota limits
- [ ] JPEG/PNG magic-byte allowlist
- [ ] Dimension and pixel limits
- [ ] Isolated bounded processing worker
- [ ] Metadata stripped
- [ ] Sanitized re-encoding
- [ ] Originals deleted from quarantine
- [ ] Queue backpressure and timeouts
- [ ] Safe response headers
- [ ] Malicious upload test suite passes

### Application and operations

- [ ] Production RLS/storage policies verified
- [ ] Debug endpoints disabled
- [ ] Security headers deployed
- [ ] CSRF/origin protection verified
- [ ] Inputs and exports hardened
- [ ] CI secret/dependency/static scanning
- [ ] Audit logging implemented and protected
- [ ] Monitoring and alerting operational
- [ ] Incident playbooks complete
- [ ] Tabletop exercise complete
- [ ] Independent penetration test complete
- [ ] Critical/high findings remediated
- [ ] Cyber/privacy insurance evaluated
- [ ] Coaches and support staff trained

## Immediate next implementation sequence

Unless a discovered dependency requires adjustment, implementation should begin in this order:

1. Complete the inventory and live Supabase policy audit.
2. Make screenshots private and migrate existing objects.
3. Add hashed runner credentials and revocable sessions.
4. Add pending/active/revoked runner state and consent-version enforcement.
5. Implement parent invitation, verification, consent ledger, activation, withdrawal, and adult transition.
6. Build isolated bounded upload processing.
7. Draft and obtain legal approval for policies, consent, and school DPA in parallel with steps 2–6.
8. Add security headers, debug removal, input limits, audit logging, and monitoring.
9. Implement retention, deletion, export, and privacy-request workflows.
10. Complete automated authorization/abuse tests and independent staging penetration test.
11. Run the one-team Gate B pilot.
12. Review pilot findings before beginning the full UI redesign or multi-team rollout.
