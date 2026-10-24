param([Parameter(Mandatory=$true)][string]$BackupPath)
$ErrorActionPreference = 'Stop'
if (-not (Test-Path -LiteralPath $BackupPath -PathType Leaf)) { throw "Backup file not found: $BackupPath" }
$resolvedBackup = [System.IO.Path]::GetFullPath($BackupPath)
cmd.exe /d /c "docker compose exec -T postgres pg_restore -U governor -d governor --clean --if-exists < `"$resolvedBackup`""
if ($LASTEXITCODE -ne 0) { throw "pg_restore failed with exit code $LASTEXITCODE" }
Write-Output "Restore completed from $BackupPath"
