param([Parameter(Mandatory = $true)][string]$Destination)

$ErrorActionPreference = "Stop"
$destinationPath = [System.IO.Path]::GetFullPath($Destination)
New-Item -ItemType Directory -Path $destinationPath -Force | Out-Null
$stamp = (Get-Date).ToUniversalTime().ToString("yyyyMMdd-HHmmssZ")
$workPath = Join-Path ([System.IO.Path]::GetTempPath()) ("hersemita-backup-" + [Guid]::NewGuid().ToString("N"))
$archivePath = Join-Path $destinationPath ("hersemita-" + $stamp + ".zip")
$encryptedPath = $archivePath + ".enc"
$connectionPointer = [IntPtr]::Zero
$passphrasePointer = [IntPtr]::Zero

try {
  New-Item -ItemType Directory -Path $workPath | Out-Null
  $connectionSecure = Read-Host "Paste the Supabase Session pooler connection string" -AsSecureString
  $connectionPointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($connectionSecure)
  $connection = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($connectionPointer)

  npx.cmd supabase@latest db dump --db-url $connection --file (Join-Path $workPath "roles.sql") --role-only
  if ($LASTEXITCODE -ne 0) { throw "Role dump failed" }
  npx.cmd supabase@latest db dump --db-url $connection --file (Join-Path $workPath "schema.sql")
  if ($LASTEXITCODE -ne 0) { throw "Schema dump failed" }
  npx.cmd supabase@latest db dump --db-url $connection --file (Join-Path $workPath "data.sql") --use-copy --data-only
  if ($LASTEXITCODE -ne 0) { throw "Data dump failed" }
  node scripts/backup/storage-export.mjs (Join-Path $workPath "storage")
  if ($LASTEXITCODE -ne 0) { throw "Storage export failed" }

  Compress-Archive -Path (Join-Path $workPath "*") -DestinationPath $archivePath -CompressionLevel Optimal
  $passphraseSecure = Read-Host "Create an archive passphrase of at least 16 characters" -AsSecureString
  $passphrasePointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($passphraseSecure)
  $env:HERSEMITA_BACKUP_PASSPHRASE = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($passphrasePointer)
  node scripts/backup/crypt-backup.mjs encrypt $archivePath $encryptedPath
  if ($LASTEXITCODE -ne 0) { throw "Backup encryption failed" }
  Remove-Item -LiteralPath $archivePath -Force
  Write-Host "Encrypted backup created: $encryptedPath"
} finally {
  $env:HERSEMITA_BACKUP_PASSPHRASE = $null
  if ($connectionPointer -ne [IntPtr]::Zero) { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($connectionPointer) }
  if ($passphrasePointer -ne [IntPtr]::Zero) { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($passphrasePointer) }
  $resolvedWork = Resolve-Path -LiteralPath $workPath -ErrorAction SilentlyContinue
  $tempRoot = [System.IO.Path]::GetFullPath([System.IO.Path]::GetTempPath())
  if ($resolvedWork -and $resolvedWork.Path.StartsWith($tempRoot) -and (Split-Path $resolvedWork.Path -Leaf).StartsWith("hersemita-backup-")) {
    Remove-Item -LiteralPath $resolvedWork.Path -Recurse -Force
  }
}
