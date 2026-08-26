# Security and Privacy Incident Response Runbook

Status: Engineering draft; legal contacts and notification matrix pending

## Immediate priorities

1. Protect people, especially minor students.
2. Contain unauthorized access without destroying evidence.
3. Preserve timestamps, logs, affected identifiers and configuration state.
4. Notify the privacy/security owner and counsel.
5. Determine affected data, people, schools, states and providers.
6. Meet the shortest applicable contractual or legal notice deadline.

## Severity

- Critical: Confirmed cross-team/family access, public student files, stolen service-role/Clerk/Twilio secrets, mass export, active compromise, or material service destruction.
- High: Likely unauthorized access, lost privileged device/session, bypassed consent, malware/resource attack affecting availability, or provider breach involving student data.
- Medium: Contained attempted access, limited accidental disclosure, repeated upload abuse, or security-control failure without confirmed acquisition.
- Low: Unsuccessful scanning, policy violation without data access, or minor configuration drift.

## First-hour checklist

- Open an incident record with UTC discovery time and incident lead.
- Do not include sensitive record contents in ordinary chat/email.
- Preserve relevant Vercel, Supabase, Clerk, Twilio, audit and access logs.
- Revoke affected sessions and rotate exposed credentials.
- Disable affected route, account, integration or storage access.
- If files became public, make the bucket private and invalidate signed/public paths.
- If authorization failed, suspend affected accounts/teams while preserving evidence.
- Record every containment action and exact time.
- Contact counsel before making conclusions or notification promises.

## Playbooks

### Public screenshot or file

- Make bucket/object private immediately.
- Identify every URL, access log, activity and affected runner/team.
- Rotate object keys if prior URLs existed.
- Determine whether unauthorized acquisition is known or reasonably possible.
- Notify school/provider/counsel under the approved matrix.

### Cross-team or cross-family access

- Disable the affected route or feature.
- Preserve request, actor, target and policy state.
- Test whether the issue is systematic.
- Revoke relevant sessions and service credentials.
- Patch both application authorization and RLS/storage policy.
- Run negative tests across all roles before restoration.

### Credential or provider-secret exposure

- Revoke/rotate immediately; do not wait for proof of misuse.
- Search build artifacts, logs, git history and provider access logs.
- Rotate dependent secrets and invalidate sessions.
- Restore with least privilege and document the exposure window.

### Malicious upload or availability attack

- Block abusive account/IP signals and pause uploads if needed.
- Preserve the rejected file hash and processing error; do not redistribute the file.
- Reduce worker concurrency/queue intake and protect core authenticated functions.
- Patch parser/library or limits and regression-test before reopening.

### Consent or age-status failure

- Suspend runner access and revoke all sessions.
- Preserve consent/version/audit events.
- Stop new enrollment if the flaw is systemic.
- Correct status only through a new auditable event.
- Evaluate affected data collection and deletion obligations with counsel.

## Recovery

- Confirm vulnerability/root cause is removed.
- Verify RLS, storage, authentication and consent boundaries.
- Restore from known-good backups only when necessary.
- Monitor enhanced signals after restoration.
- Provide accurate notices approved by counsel.
- Complete a post-incident report with root cause, impact, timeline, fixes, owner and deadline.

## Required owner inputs

- Named incident lead and backup
- Texas/Tennessee privacy counsel contact
- Cyber-insurance carrier and notice procedure
- School/district emergency contacts
- Clerk, Supabase, Vercel and Twilio security contacts
- Approved breach-notification decision matrix
- Independent forensic support contact

## Incident record template

- Incident ID:
- UTC discovery time:
- Reporter and incident lead:
- Severity and current status:
- Systems, teams and runner records potentially affected:
- Categories of data potentially affected:
- Earliest/latest possible exposure:
- Evidence preserved and storage location:
- Containment actions with UTC timestamps:
- Secrets/sessions revoked or rotated:
- Counsel, insurer, school and provider contacts made:
- Notification decision, authority and deadline:
- Recovery validation performed:
- Root cause and permanent corrective actions:
- Post-incident owner and due date:

## Pre-pilot tabletop exercise

Use fake identifiers only. Scenario: a coach reports that a runner screenshot URL opened for the wrong team, and security monitoring shows repeated authorization failures from the same source.

1. Record the discovery time, assign severity and name the incident lead.
2. Identify the route, storage object, affected fake runners/teams and relevant logs without copying student content into chat or email.
3. Explain the exact containment actions: disable viewing if needed, preserve evidence, revoke sessions, and keep the bucket private.
4. Identify which contacts would be called and who decides whether legal or contractual notice is required.
5. Demonstrate the authorization and storage tests required before restoration.
6. Complete the incident template, including timestamps, gaps, corrective actions and owners.

Passing evidence: a dated record showing the exercise participants, decisions, elapsed times, missing contacts, remediation owners and a scheduled retest. Do not mark the tabletop complete merely because this written scenario exists.
