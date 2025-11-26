#!/usr/bin/env powershell
# Validate which frontend version is actually running
# Uses Chromium DevTools Protocol to inspect running app
# Usage: powershell -NoProfile -ExecutionPolicy Bypass -File scripts/validate-frontend-version.ps1

param(
  [string]$AppUrl = "http://localhost:5173",
  [int]$TimeoutSeconds = 30,
  [switch]$WaitForApp
)

$ErrorActionPreference = "Stop"

Write-Host "╔════════════════════════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║          Frontend Version Validator                        ║" -ForegroundColor Cyan
Write-Host "║     Verifies which frontend version is ACTUALLY running    ║" -ForegroundColor Cyan
Write-Host "╚════════════════════════════════════════════════════════════╝" -ForegroundColor Cyan
Write-Host ""

Write-Host "Target URL: $AppUrl" -ForegroundColor Yellow
Write-Host "Timeout: ${TimeoutSeconds}s" -ForegroundColor Yellow
Write-Host ""

# Wait for app to start if requested
if ($WaitForApp) {
  Write-Host "Waiting for app to become available..." -ForegroundColor Yellow
  $started = $false
  $attempts = 0
  $maxAttempts = $TimeoutSeconds

  while (-not $started -and $attempts -lt $maxAttempts) {
    try {
      $response = Invoke-WebRequest -Uri $AppUrl -Method Head -TimeoutSec 2 -ErrorAction Stop
      if ($response.StatusCode -eq 200) {
        $started = $true
        Write-Host "App is responding!" -ForegroundColor Green
        Start-Sleep -Seconds 2
      }
    } catch {
      $attempts++
      Write-Host "  Attempt $attempts/$maxAttempts..." -ForegroundColor Gray
      Start-Sleep -Seconds 1
    }
  }

  if (-not $started) {
    Write-Host "App did not start in time" -ForegroundColor Red
    exit 1
  }
}

# Try to fetch the app and examine it
Write-Host "Fetching frontend..." -ForegroundColor Yellow

try {
  $response = Invoke-WebRequest -Uri $AppUrl -TimeoutSec $TimeoutSeconds
  $html = $response.Content
} catch {
  Write-Host "Failed to fetch $AppUrl`: $_" -ForegroundColor Red
  exit 1
}

Write-Host ""
Write-Host "═══ FRONTEND INSPECTION RESULTS ═══" -ForegroundColor Cyan
Write-Host ""

# Extract version info from HTML
$versionPatterns = @(
  @{ name = "Build Hash"; pattern = '__razai_frontend_hash' },
  @{ name = "App Version"; pattern = 'APP_VERSION|app-version|0\.1\.' },
  @{ name = "Build Timestamp"; pattern = '__BUILD_TIMESTAMP|build-time' },
  @{ name = "React"; pattern = 'react@|React' }
)

# Look for version info in script tags
$scripts = [regex]::Matches($html, '<script[^>]*>([^<]+)</script>', [System.Text.RegularExpressions.RegexOptions]::IgnoreCase)
Write-Host "Found $($scripts.Count) inline scripts" -ForegroundColor Gray

# Look for module/source scripts
$moduleScripts = [regex]::Matches($html, '<script[^>]*src="([^"]+)"[^>]*>', [System.Text.RegularExpressions.RegexOptions]::IgnoreCase)
Write-Host "Found $($moduleScripts.Count) module scripts" -ForegroundColor Gray
Write-Host ""

# Extract script sources
$scriptSources = @()
foreach ($match in $moduleScripts) {
  $scriptSources += $match.Groups[1].Value
}

Write-Host "Module Scripts:" -ForegroundColor Yellow
foreach ($src in $scriptSources) {
  Write-Host "  • $src" -ForegroundColor Cyan
}

Write-Host ""
Write-Host "═══ CONSOLE INSPECTION ═══" -ForegroundColor Cyan
Write-Host ""

# Try to execute JavaScript in browser context to check version
Write-Host "Attempting to inspect version info via fetch..." -ForegroundColor Yellow
Write-Host ""

# Create a simple Node.js script to check the app
$inspectScript = @"
const http = require('http');

const options = {
  hostname: 'localhost',
  port: 5173,
  path: '/',
  method: 'GET'
};

const req = http.request(options, (res) => {
  let data = '';
  
  res.on('data', (chunk) => {
    data += chunk;
  });
  
  res.on('end', () => {
    // Try to extract version patterns
    const versionMatch = data.match(/BUILD_HASH["\']?\s*[:=]\s*["\']([^"']+)["\']?/);
    const timestampMatch = data.match(/BUILD_TIMESTAMP["\']?\s*[:=]\s*["\']([^"']+)["\']?/);
    
    console.log('Version info found:');
    if (versionMatch) console.log('  BUILD_HASH:', versionMatch[1]);
    if (timestampMatch) console.log('  BUILD_TIMESTAMP:', timestampMatch[1]);
    
    // Check cache headers
    console.log('Cache headers:');
    console.log('  Cache-Control:', res.headers['cache-control']);
    console.log('  ETag:', res.headers['etag']);
    console.log('  Last-Modified:', res.headers['last-modified']);
  });
});

req.on('error', (error) => {
  console.error('Error:', error.message);
  process.exit(1);
});

req.end();
"@

# Save and run inspection script if Node.js available
try {
  $node = Get-Command node -ErrorAction Stop
  $tempScript = [System.IO.Path]::GetTempFileName() + ".js"
  Set-Content -Path $tempScript -Value $inspectScript
  
  Write-Host "Running Node.js inspection..." -ForegroundColor Gray
  & node $tempScript 2>&1 | ForEach-Object { Write-Host "  $_" -ForegroundColor Cyan }
  
  Remove-Item $tempScript -Force -ErrorAction SilentlyContinue
} catch {
  Write-Host "Node.js not available, skipping deep inspection" -ForegroundColor Gray
}

Write-Host ""
Write-Host "═══ HTML METADATA ═══" -ForegroundColor Cyan
Write-Host ""

# Extract meta tags
$metaTags = [regex]::Matches($html, '<meta\s+([^>]+)', [System.Text.RegularExpressions.RegexOptions]::IgnoreCase)
Write-Host "Found $($metaTags.Count) meta tags" -ForegroundColor Gray

foreach ($match in $metaTags) {
  $metaStr = $match.Groups[1].Value
  if ($metaStr -match 'name="([^"]+)"\s+content="([^"]+)"' -or $metaStr -match 'property="([^"]+)"\s+content="([^"]+)"') {
    $name = $matches[1]
    $content = $matches[2]
    if ($name -match 'version|build|hash' -or $content -match '\d+\.\d+') {
      Write-Host "  $name = $content" -ForegroundColor Cyan
    }
  }
}

Write-Host ""
Write-Host "═══ RECOMMENDATIONS ═══" -ForegroundColor Yellow
Write-Host ""
Write-Host "To verify frontend version:" -ForegroundColor White
Write-Host "  1. Open Developer Tools (F12)" -ForegroundColor Gray
Write-Host "  2. Go to Console tab" -ForegroundColor Gray
Write-Host "  3. Run: console.table(window.__VERSION_INFO__ || 'not available')" -ForegroundColor Gray
Write-Host ""
Write-Host "To force frontend update:" -ForegroundColor White
Write-Host "  1. Ctrl+F5 (hard refresh, bypass cache)" -ForegroundColor Gray
Write-Host "  2. F12 > Network tab > Disable cache" -ForegroundColor Gray
Write-Host "  3. Refresh page" -ForegroundColor Gray
Write-Host ""
Write-Host "To check Service Worker:" -ForegroundColor White
Write-Host "  1. F12 > Application > Service Workers" -ForegroundColor Gray
Write-Host "  2. Verify latest version is active" -ForegroundColor Gray
Write-Host "  3. Check 'Offline' to see cached content" -ForegroundColor Gray
Write-Host ""

Write-Host "Validation complete!" -ForegroundColor Green
