param(
  [string]$BaseUrl = 'http://127.0.0.1:18080',
  [Parameter(Mandatory = $true)]
  [string]$Token,
  [int]$HealthRequests = 50
)

$ErrorActionPreference = 'Stop'
$health = 1..$HealthRequests | ForEach-Object {
  try { (Invoke-WebRequest -UseBasicParsing "$BaseUrl/health" -TimeoutSec 5).StatusCode } catch { 0 }
}
$headers = @{ Authorization = "Bearer $Token"; 'Content-Type' = 'application/json' }
$unauthorizedReady = try { (Invoke-WebRequest -UseBasicParsing "$BaseUrl/ready" -TimeoutSec 5).StatusCode } catch { $_.Exception.Response.StatusCode.value__ }
$authorizedReady = (Invoke-WebRequest -UseBasicParsing "$BaseUrl/ready" -Headers $headers -TimeoutSec 5).StatusCode
$traversal = try {
  (Invoke-WebRequest -UseBasicParsing "$BaseUrl/mcp" -Method Post -Headers $headers -Body '{"method":"retrieval/read","profile":"review","path":"../package.json","max_output_chars":4000}' -TimeoutSec 5).StatusCode
} catch { $_.Exception.Response.StatusCode.value__ }
$metrics = (Invoke-WebRequest -UseBasicParsing "$BaseUrl/metrics" -Headers $headers -TimeoutSec 5).Content
$healthPassed = @($health | Where-Object { $_ -eq 200 }).Count
if ($healthPassed -ne $HealthRequests -or $unauthorizedReady -ne 401 -or $authorizedReady -ne 200 -or $traversal -ne 403) {
  throw "staging smoke failed: health=$healthPassed/$HealthRequests unauthorized_ready=$unauthorizedReady authorized_ready=$authorizedReady traversal=$traversal"
}
if ($metrics -notmatch 'governor_(requests_total|auth_denied_total|http_5xx_total|provider_failures_total|request_duration_ms_sum)') {
  throw 'staging smoke failed: expected operational metrics are missing'
}
Write-Output "health=$healthPassed/$HealthRequests unauthorized_ready=$unauthorizedReady authorized_ready=$authorizedReady traversal=$traversal metrics=ok"
