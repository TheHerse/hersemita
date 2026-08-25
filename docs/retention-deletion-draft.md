# Retention and Deletion Schedule — Draft

Status: Requires school requirements and legal approval before production

| Record | Proposed retention | Trigger/action |
|---|---|---|
| Unused invitations | 7 days active; delete within 30 days | Expiration or cancellation |
| One-time credential reveal | 5 minutes | Cookie expiry; credential itself is never recoverable |
| Runner sessions | Maximum 30 days currently; target 7 days plus inactivity limit | Logout, rotation, suspension, consent withdrawal, role/status change |
| Quarantined upload originals | Delete immediately after processing; failed originals within 1 hour | Processing completion/failure |
| Sanitized screenshots | Active season plus school-approved period | Runner/team deletion, school request, contract end |
| Activities and workout plans | Active season plus school-approved period | School DPA/season rule |
| Wellness, recovery and injury data | Shorter than ordinary activity history; proposed end of season plus 90 days | School-approved schedule or verified request |
| SMS consent evidence | Duration of messaging plus applicable limitations/defense period | Opt-out/relationship end |
| SMS message records | Proposed 12 months unless school requires less | Delivery date |
| Security/audit logs | Proposed 12–24 months | Event date, unless incident/legal hold |
| Consent events | Required legal/contract defense period; do not silently edit | Superseded/withdrawn event retained per counsel |
| Exports | Generate on demand; no server retention unless explicitly requested | Response completion |
| Rate-limit records | 48 hours | Automated cleanup |
| Backups | Provider-controlled rolling window, proposed 30 days | Automatic expiry; no restoration except recovery |
| Closed team/account | Export/return then primary deletion within 30 days; backups expire on schedule | Contract/account termination |

## Deletion requirements

- Verify requester identity and authority.
- Suspend access before destructive processing when appropriate.
- Delete or anonymize primary records, derived records, storage objects, caches and queued work.
- Do not delete another guardian's private account data merely because one guardian requests runner deletion.
- Record completion without retaining unnecessary deleted content.
- Apply documented legal holds narrowly and remove them when no longer required.
- Inform requesters that rolling backups expire rather than being selectively edited, if approved by counsel and contract.
- Test deletion with a synthetic runner before production and at least annually.
