# Security Test Matrix

Status: Local pure-function tests implemented; authenticated staging tests pending deployment

## Automated locally

- Scrypt hashes are salted and do not contain the passcode.
- Correct passcodes verify and incorrect/malformed hashes fail.
- Parent consent exposes every required choice independently.
- Adult authority is separate from adult data-consent choices.
- JPEG MIME/signature mismatch is rejected.
- SVG/executable-like upload types are rejected.
- Accepted images are re-encoded as JPEG and metadata is removed.
- Cross-site and missing request origins are rejected.
- Oversized or incorrectly typed JSON bodies are rejected before parsing.
- CSV cells beginning with spreadsheet formula markers are neutralized.
- Repository secret-pattern scanning passes.
- Production dependency audit reports zero known vulnerabilities.
- ESLint, TypeScript and production build pass.

Run with:

```text
npm run test:security
npm run security:secrets
npm run security:audit
npm run lint
npx tsc --noEmit
npm run build
```

## Required authenticated staging matrix

Create Team A and Team B, two coaches, two guardians, one minor runner per team, one adult runner, and one suspended/revoked runner.

| Test | Expected result |
|---|---|
| Anonymous coach page/API request | 401/redirect; no data |
| Coach A requests Team B runner/activity/file ID | 404/denied; no existence disclosure |
| Assistant attempts head-coach membership/invitation action | Denied |
| Removed coach reuses old Clerk session | No team access |
| Parent A requests Parent B runner by UUID and username | Redirect/404 |
| Parent consent request for an unlinked runner | Denied; no consent event |
| Parent withdraws linked minor consent | Runner becomes revoked; hash erased; old runner cookie fails immediately |
| Pending minor tries every runner API | 401 |
| Pending adult tries every runner API | 401 |
| Adult consent using nonmatching/unverified email | Denied |
| Minor changes to adult | Existing hash erased; sessions invalidated; parent access disabled |
| Adult grants/revokes parent access | Parent visibility changes immediately; immutable event recorded |
| Runner A changes IDs/paths to Runner B | 404/denied |
| Public requests screenshot object or old public URL | Denied |
| Signed screenshot URL after expiry | Denied |
| Hostile Origin sends login/upload/recovery/calendar mutation | 403 |
| Oversized, corrupt, SVG, animated, excessive-pixel or 4-file upload | Rejected without web-process crash |
| Export requests include foreign runner IDs | Foreign runners excluded/denied |
| RLS queried directly with Coach A JWT for Team B | Zero rows/denied |
| Service-role route receives foreign object ID | Explicit application authorization denies it |

## Launch rule

Gate A cannot close until every staging row above has dated evidence, tester identity, environment/release identifier, and a passing result. Critical/high failures block launch.
