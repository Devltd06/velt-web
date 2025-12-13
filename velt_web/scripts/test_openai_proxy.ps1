param(
  [string]$Token,
  [string]$Prompt = "Write a 2-line friendly greeting"
)

if (-not $Token) {
  $Token = $env:TEST_OPENAI_TOKEN
}

if (-not $Token) {
  Write-Error "No token provided. Pass as param or set TEST_OPENAI_TOKEN env var."
  exit 2
}

$headers = @{ Authorization = "Bearer $Token"; "Content-Type" = "application/json" }
$body = @{ prompt = $Prompt } | ConvertTo-Json

try {
  $resp = Invoke-RestMethod -Uri 'https://jgcjndmqyzyslcupgjab.supabase.co/functions/v1/openai-proxy' -Method Post -Headers $headers -Body $body -TimeoutSec 60
  Write-Output "--- RESPONSE ---"
  $resp | ConvertTo-Json -Depth 5
} catch {
  Write-Output "Request failed: $_"
  exit 1
}
