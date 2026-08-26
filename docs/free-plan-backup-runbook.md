# Free Plan Backup and Restore Runbook

Supabase Free does not include automatic database backups. Database dumps also do not contain Storage file contents, so both parts must succeed.

## Create an encrypted backup

1. In Supabase, select **Connect**, choose **Session pooler**, and copy the connection string. Replace the password placeholder locally when prompted; never paste it into chat or commit it.
2. Choose a destination on an encrypted external drive or another access-controlled location outside this repository.
3. From the repository in PowerShell, run:

   `powershell -ExecutionPolicy Bypass -File scripts/backup/backup-free-plan.ps1 -Destination "D:\HersemitaBackups"`

4. Use a unique passphrase of at least 16 characters and store it in a password manager. Losing it makes the archive unrecoverable.
5. Confirm that only the `.zip.enc` file remains. Do not upload an unencrypted dump or keep it in the repository.

## Verify restoration before the coach pilot

1. Copy one encrypted fake-data backup to an isolated machine/location.
2. Set `HERSEMITA_BACKUP_PASSPHRASE` only for the current PowerShell process and run `node scripts/backup/crypt-backup.mjs decrypt <archive.zip.enc> <archive.zip>`.
3. Extract the ZIP and verify that `roles.sql`, `schema.sql`, `data.sql`, and `storage/manifest.json` exist.
4. Restore into a local Supabase instance or a temporary empty project—not the live project—and verify table counts, consent events, privacy events, and private screenshot object counts.
5. Delete the decrypted files after verification and retain dated evidence of the tester, backup hash, restore target, counts and result.

## Operating schedule

- Before pilot: complete one successful encrypted backup and isolated restore test.
- During pilot: back up at least daily and before every schema migration or destructive operation.
- Keep at least two recent copies in separate controlled locations.
- Backups inherit the sensitivity and deletion schedule of the student data they contain.
- Upgrade to managed daily backups before broader production use when financially possible.
