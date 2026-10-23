param([Parameter(Mandatory=$true)][string]$Input)
$ErrorActionPreference = 'Stop'
Get-Content -Raw -Encoding Byte $Input | docker compose exec -T postgres pg_restore -U governor -d governor --clean --if-exists
Write-Output "Restore completed from $Input"
