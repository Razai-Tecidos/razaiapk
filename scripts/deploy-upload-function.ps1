# Deploy the Supabase Edge Function 'upload_backup' with CORS support
# REQUIREMENTS:
#  - Supabase CLI installed (https://supabase.com/docs/guides/cli)
#  - Logged in: supabase login
#  - Linked project: supabase link --project-ref <your-project-ref>
#  - Environment variables set in the function dashboard or via CLI config:
#       SERVICE_ROLE_KEY (service role key of the project)
#       UPLOAD_TOKEN     (the token you configure in app Settings)
#       BACKUP_BUCKET    (e.g. backups)
#       MANIFEST_ID      (id or primary key for the single manifest row if needed)
#
# USAGE:
#   powershell -ExecutionPolicy Bypass -File .\scripts\deploy-upload-function.ps1
#
# This script only wraps the CLI call for convenience.

Write-Host "Deploying 'upload_backup' Edge Function..." -ForegroundColor Cyan

# Run deployment (will zip and upload function code under supabase/functions/upload_backup)
$deploy = supabase functions deploy upload_backup 2>&1
Write-Host $deploy

if ($LASTEXITCODE -ne 0) {
  Write-Host "Deployment failed (exit code $LASTEXITCODE)." -ForegroundColor Red
  Write-Host "Ensure you ran 'supabase link' in the repository root and have the CLI installed." -ForegroundColor Yellow
  exit $LASTEXITCODE
}

Write-Host "Deployment completed." -ForegroundColor Green
Write-Host "Verify in dashboard: Functions > upload_backup. Test OPTIONS + POST via browser." -ForegroundColor Green

Write-Host "If CORS still fails, confirm headers returned:" -ForegroundColor Yellow
Write-Host "  Access-Control-Allow-Origin: *" -ForegroundColor Yellow
Write-Host "  Access-Control-Allow-Methods: POST, OPTIONS" -ForegroundColor Yellow
Write-Host "  Access-Control-Allow-Headers: authorization, x-upload-token, apikey, content-type, accept" -ForegroundColor Yellow
