<#
Combined convenience script that runs DB migration instructions (manual) and deploys functions.
This script calls deploy-functions.ps1. Keep in mind DB migrations must be run either via Supabase CLI or by pasting SQL into the Dashboard SQL editor.
#>

param(
  [string]$ProjectRef = $Env:SUPABASE_PROJECT_REF
)

if (-not $ProjectRef) {
  Write-Host "set SUPABASE_PROJECT_REF or pass -ProjectRef <ref>"
  exit 1
}

Write-Host "1) Ensure DB migrations have been applied (see supabase/scripts/deploy-db-instructions.md)"
Write-Host "2) Deploying functions"
.
./deploy-functions.ps1 -ProjectRef $ProjectRef
