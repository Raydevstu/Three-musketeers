param([string]$BaseUrl = 'http://127.0.0.1:18083', [int]$Count = 50)
$jobs = 1..$Count | ForEach-Object { Start-Job -ScriptBlock { param($Url) try { (Invoke-WebRequest -UseBasicParsing "$Url/health" -TimeoutSec 10).StatusCode } catch { 0 } } -ArgumentList $BaseUrl }
$results = $jobs | Wait-Job | Receive-Job
$jobs | Remove-Job
$passed = @($results | Where-Object { $_ -eq 200 }).Count
[pscustomobject]@{ requested = $Count; passed = $passed; failed = $Count - $passed; status = if ($passed -eq $Count) { 'passed' } else { 'failed' } } | ConvertTo-Json
