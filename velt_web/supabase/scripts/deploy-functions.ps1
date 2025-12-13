<#
Supabase Functions deploy helper (PowerShell)

Usage (PowerShell):
  $Env:SUPABASE_PROJECT_REF = "your-project-ref"
  $Env:PAYSTACK_SECRET_KEY = "sk_test_..."
  $Env:SUPABASE_SERVICE_ROLE_KEY = "service_role_..."
  $Env:SUPABASE_URL = "https://xyz.supabase.co"

  # Deploy functions
  ./deploy-functions.ps1

Notes:
- Requires the Supabase CLI to be installed and you to be logged in (supabase login).
- This script will set secrets for the project and deploy functions named `paystack-init` and `paystack-complete`.
#>

param(
  [string]$ProjectRef = $Env:SUPABASE_PROJECT_REF,
  [string]$FunctionsPath = "../functions"
)

if (-not (Get-Command supabase -ErrorAction SilentlyContinue)) {
  Write-Error "Supabase CLI not found. Install it from https://supabase.com/docs/guides/cli and log in (supabase login)"
  exit 1
}

if (-not $ProjectRef) {
  Write-Host "Please set SUPABASE_PROJECT_REF environment variable or pass -ProjectRef <ref>"
  exit 1
}

if (-not $Env:PAYSTACK_SECRET_KEY) {
  Write-Host "PAYSTACK_SECRET_KEY not set; please set it in environment before running."
  exit 1
}

if (-not $Env:SUPABASE_SERVICE_ROLE_KEY) {
  Write-Host "SUPABASE_SERVICE_ROLE_KEY not set; please set it in environment before running."
  exit 1
}

if (-not $Env:SUPABASE_URL) {
  Write-Host "SUPABASE_URL not set; please set it in environment before running."
  exit 1
}

Write-Host "Setting secrets for project $ProjectRef"
supabase secrets set PAYSTACK_SECRET_KEY=$($Env:PAYSTACK_SECRET_KEY) --project-ref $ProjectRef
supabase secrets set SUPABASE_SERVICE_ROLE_KEY=$($Env:SUPABASE_SERVICE_ROLE_KEY) --project-ref $ProjectRef
supabase secrets set SUPABASE_URL=$($Env:SUPABASE_URL) --project-ref $ProjectRef

Write-Host "Deploying functions (paystack-init, paystack-complete)"
pushd $FunctionsPath\paystack-init
supabase functions deploy paystack-init --project-ref $ProjectRef
popd

pushd $FunctionsPath\paystack-complete
supabase functions deploy paystack-complete --project-ref $ProjectRef
popd

Write-Host "Deployment finished. Check function logs with: supabase functions logs paystack-init --project-ref $ProjectRef"
Write-Host "Also check paystack-complete logs: supabase functions logs paystack-complete --project-ref $ProjectRef"
