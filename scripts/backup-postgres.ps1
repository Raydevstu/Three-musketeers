param(
  [string]$Output = "backups/governor-$(Get-Date -Format yyyyMMdd-HHmmss).dump"
)
$ErrorActionPreference = 'Stop'
New-Item -ItemType Directory -Force (Split-Path $Output) | Out-Null
docker compose exec -T postgres pg_dump -U governor -d governor -Fc > $Output
Write-Output "Backup written to $Output"
