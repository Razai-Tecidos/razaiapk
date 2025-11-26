#!/usr/bin/env powershell
# Automated Frontend Update Test
# Builds new version, checks if existing installation detects and loads it
# Usage: powershell -NoProfile -ExecutionPolicy Bypass -File scripts/test-frontend-update.ps1

param(
  [int]$WaitBetweenBuildSeconds = 5,
  [switch]$TestLocalhost
)

$ErrorActionPreference = "Stop"

Write-Host ""
Write-Host "╔════════════════════════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║        Frontend Update Detection Test                       ║" -ForegroundColor Cyan
Write-Host "║  Verifies that app detects new frontend after rebuild      ║" -ForegroundColor Cyan
Write-Host "╚════════════════════════════════════════════════════════════╝" -ForegroundColor Cyan
Write-Host ""

$projectRoot = "c:\Users\Rafael\Desktop\Razai Tools"
$appDir = Join-Path $projectRoot "app"

Write-Host "Step 1: Get current frontend hash" -ForegroundColor Yellow
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Gray

$versionMgmtFile = Join-Path $appDir "src\lib\version-mgmt.ts"
if (Test-Path $versionMgmtFile) {
  $content = Get-Content $versionMgmtFile -Raw
  $hashMatch = $content -match "const BUILD_HASH = '([a-f0-9]+)'"
  if ($hashMatch) {
    $originalHash = $matches[1]
    Write-Host "Current BUILD_HASH: $originalHash" -ForegroundColor Green
  } else {
    Write-Host "Could not extract BUILD_HASH from file" -ForegroundColor Yellow
    $originalHash = "(unknown)"
  }
} else {
  Write-Host "version-mgmt.ts not found" -ForegroundColor Red
  exit 1
}

Write-Host ""
Write-Host "Step 2: Rebuild frontend with new version" -ForegroundColor Yellow
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Gray

Push-Location $appDir
try {
  Write-Host "Running: npm run build" -ForegroundColor Gray
  npm run build 2>&1 | ForEach-Object { Write-Host "  $_" -ForegroundColor Gray }
  
  if ($LASTEXITCODE -ne 0) {
    Write-Host "Build failed!" -ForegroundColor Red
    exit 1
  }
  
  Write-Host "Build completed successfully" -ForegroundColor Green
} finally {
  Pop-Location
}

Write-Host ""
Write-Host "Step 3: Check new frontend hash" -ForegroundColor Yellow
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Gray

# Wait for file to be updated
Start-Sleep -Seconds 2

$newContent = Get-Content $versionMgmtFile -Raw
$newHashMatch = $newContent -match "const BUILD_HASH = '([a-f0-9]+)'"
if ($newHashMatch) {
  $newHash = $matches[1]
  Write-Host "New BUILD_HASH: $newHash" -ForegroundColor Green
  
  if ($originalHash -eq $newHash) {
    Write-Host "WARNING: Hash did not change after rebuild!" -ForegroundColor Yellow
  } else {
    Write-Host "Hash successfully changed!" -ForegroundColor Green
  }
} else {
  Write-Host "Could not extract new BUILD_HASH" -ForegroundColor Red
  $newHash = "(unknown)"
}

Write-Host ""
Write-Host "Step 4: Run dev server and check for update detection" -ForegroundColor Yellow
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Gray

if ($TestLocalhost) {
  Write-Host "Starting dev server..." -ForegroundColor Gray
  Write-Host "This will run in background. Check http://localhost:5173 for version info" -ForegroundColor Cyan
  
  Push-Location $projectRoot
  try {
    # Start dev server in background (if not already running)
    $devProcess = Start-Process -FilePath "npm" -ArgumentList "run dev:tauri" -PassThru -NoNewWindow -WindowStyle Hidden
    Write-Host "Dev server started (PID: $($devProcess.Id))" -ForegroundColor Green
    
    Write-Host ""
    Write-Host "Waiting ${WaitBetweenBuildSeconds}s for dev server to stabilize..." -ForegroundColor Gray
    Start-Sleep -Seconds $WaitBetweenBuildSeconds
    
    Write-Host ""
    Write-Host "Checking http://localhost:5173..." -ForegroundColor Gray
    
    try {
      $appResponse = Invoke-WebRequest -Uri "http://localhost:5173" -TimeoutSec 5 -ErrorAction Stop
      Write-Host "App is responding!" -ForegroundColor Green
      
      # Check if version detection script exists
      if ($appResponse.Content -match "initVersionManagement|getVersionHealthStatus") {
        Write-Host "Version management code detected in frontend" -ForegroundColor Green
      } else {
        Write-Host "Version management code NOT found in frontend" -ForegroundColor Yellow
      }
    } catch {
      Write-Host "Could not reach app at localhost:5173: $_" -ForegroundColor Yellow
    }
    
    Write-Host ""
    Write-Host "To complete the test:" -ForegroundColor Cyan
    Write-Host "  1. Open http://localhost:5173 in browser" -ForegroundColor Gray
    Write-Host "  2. Open DevTools (F12)" -ForegroundColor Gray
    Write-Host "  3. Go to Console tab" -ForegroundColor Gray
    Write-Host "  4. You should see '[version-mgmt]' log messages" -ForegroundColor Gray
    Write-Host "  5. Check for messages about version changes" -ForegroundColor Gray
    Write-Host ""
    Write-Host "Press Ctrl+C to stop dev server when done" -ForegroundColor Yellow
    
  } finally {
    Pop-Location
  }
}

Write-Host ""
Write-Host "═════════════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "Test Summary:" -ForegroundColor Cyan
Write-Host "  Original hash: $originalHash" -ForegroundColor Gray
Write-Host "  New hash:      $newHash" -ForegroundColor Gray
Write-Host "  Hashes match:  $(if ($originalHash -eq $newHash) { 'NO (problem!)' } else { 'YES (correct)' })" -ForegroundColor $(if ($originalHash -eq $newHash) { 'Red' } else { 'Green' })
Write-Host ""
Write-Host "Next step: Test in browser to verify version detection works" -ForegroundColor Yellow
Write-Host "═════════════════════════════════════════════════════════════" -ForegroundColor Cyan
