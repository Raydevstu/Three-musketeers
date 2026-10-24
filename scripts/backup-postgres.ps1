param(
  [string]$Output = "backups/governor-$(Get-Date -Format yyyyMMdd-HHmmss).dump"
)
$ErrorActionPreference = 'Stop'
New-Item -ItemType Directory -Force (Split-Path $Output) | Out-Null
$resolvedOutput = [System.IO.Path]::GetFullPath($Output)
cmd.exe /d /c "docker compose exec -T postgres pg_dump -U governor -d governor -Fc > `"$resolvedOutput`""
if ($LASTEXITCODE -ne 0) { throw "pg_dump failed with exit code $LASTEXITCODE" }
Write-Output "Backup written to $Output"
