#!/usr/bin/env powershell
# Prepare deployment package with tested installers
# Usage: powershell -NoProfile -ExecutionPolicy Bypass -File scripts/prepare-deployment.ps1

param(
  [string]$OutputPath = "c:\Users\Rafael\Desktop\Razai Tools\deployment-package",
  [switch]$IncludeRawExe,
  [switch]$IncludeMsi
)

$ErrorActionPreference = "Stop"

Write-Host "=== Razai Tools Deployment Package Builder ===" -ForegroundColor Cyan
Write-Host "Output: $OutputPath" -ForegroundColor Gray
Write-Host ""

# Create deployment directory
if (Test-Path $OutputPath) {
  Remove-Item $OutputPath -Recurse -Force
}
New-Item -ItemType Directory -Path $OutputPath -Force | Out-Null

$basePath = "c:\Users\Rafael\Desktop\Razai Tools"

# Copy recommended installers
Write-Host "[1/3] Copying Portable ZIP (recommended)..." -ForegroundColor Yellow
$portableZip = "$basePath\portable\razai-tools-portable-v0.1.4.zip"
if (Test-Path $portableZip) {
  Copy-Item -Path $portableZip -Destination "$OutputPath\razai-tools-portable-v0.1.4.zip"
  Write-Host "  [DONE] Portable ZIP copied" -ForegroundColor Green
} else {
  Write-Host "  [FAIL] Portable ZIP not found" -ForegroundColor Red
}

Write-Host "[2/3] Copying NSIS Setup (alternative)..." -ForegroundColor Yellow
$nsisSetup = "$basePath\src-tauri\target\release\bundle\nsis\Razai Tools_0.1.4_x64-setup.exe"
if (Test-Path $nsisSetup) {
  Copy-Item -Path $nsisSetup -Destination "$OutputPath\Razai-Tools-Setup-v0.1.4.exe"
  Write-Host "  [DONE] NSIS Setup copied" -ForegroundColor Green
} else {
  Write-Host "  [FAIL] NSIS Setup not found" -ForegroundColor Red
}

# Optional: Raw EXE
if ($IncludeRawExe) {
  Write-Host "[2a] Copying Raw EXE (optional)..." -ForegroundColor Yellow
  $rawExe = "$basePath\src-tauri\target\release\razai-tools.exe"
  if (Test-Path $rawExe) {
    Copy-Item -Path $rawExe -Destination "$OutputPath\razai-tools-raw.exe"
    Write-Host "  [DONE] Raw EXE copied" -ForegroundColor Green
  }
}

# Optional: MSI (not recommended)
if ($IncludeMsi) {
  Write-Host "[2b] Copying MSI (not recommended - known issues)..." -ForegroundColor Yellow
  $msiSetup = "$basePath\src-tauri\target\release\bundle\msi\Razai Tools_0.1.4_x64_en-US.msi"
  if (Test-Path $msiSetup) {
    Copy-Item -Path $msiSetup -Destination "$OutputPath\razai-tools-legacy.msi"
    Write-Host "  [WARN] MSI copied (has known installation issues)" -ForegroundColor Yellow
  }
}

# Copy documentation
Write-Host "[3/3] Copying documentation..." -ForegroundColor Yellow
@(
  "README.md",
  "FRESH_INSTALL_TEST_RESULTS.md"
) | ForEach-Object {
  $docPath = "$basePath\$_"
  if (Test-Path $docPath) {
    Copy-Item -Path $docPath -Destination "$OutputPath\$_"
  }
}

# Create deployment info file
$deploymentInfo = @"
# Razai Tools Deployment Package v0.1.4

## Installation Instructions

### Recommended Method: Portable ZIP
1. Download `razai-tools-portable-v0.1.4.zip`
2. Extract to desired location (e.g., C:\tools\razai-tools)
3. Run `razai-tools-v0.1.4.exe`
4. No installation or admin rights required

### Alternative Method: NSIS Setup Wizard
1. Run `Razai-Tools-Setup-v0.1.4.exe`
2. Follow installation wizard
3. Application will be installed to `C:\Program Files\Razai Tools`
4. Creates Start Menu shortcuts

### Advanced: Raw Executable (if included)
- Direct execution without any setup
- Run `razai-tools-raw.exe` from command line or terminal
- Requires no installation

## System Requirements
- Windows 10 or later (x64)
- 50 MB disk space
- WebView2 runtime (usually pre-installed on modern Windows)

## First Run
- On first launch, app will create local database and cache directories
- Allow approximately 5 seconds for initial startup
- Check browser console (F12) if issues occur

## Troubleshooting

### App Won't Start
1. Verify Windows is fully updated
2. Install WebView2 if not already present: https://developer.microsoft.com/microsoft-edge/webview2/
3. Try Portable ZIP instead of installer

### Portable ZIP Won't Extract
1. Ensure WinRAR, 7-Zip, or Windows built-in ZIP is available
2. Try right-click > Extract All
3. If permissions error occurs, extract to a different folder

### Database Issues
1. Delete `%APPDATA%\razai-tools` folder (contains cache/database)
2. Restart application - it will recreate clean database

## Version Information
- Application Version: 0.1.4
- Build Date: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')
- Distribution Formats: Portable ZIP, NSIS Installer
- Test Status: 3/4 installers passed fresh install tests

## Support
For issues or questions, refer to FRESH_INSTALL_TEST_RESULTS.md for technical details.
"@

$deploymentInfo | Out-File -FilePath "$OutputPath\INSTALLATION_GUIDE.txt" -Encoding UTF8

Write-Host ""
Write-Host "=== Deployment Package Ready ===" -ForegroundColor Cyan
Write-Host ""
Write-Host "Location: $OutputPath" -ForegroundColor Green
Get-ChildItem -Path $OutputPath | Format-Table -AutoSize

$totalSize = (Get-ChildItem -Path $OutputPath -Recurse | Measure-Object -Property Length -Sum).Sum / 1MB
Write-Host ""
Write-Host "Total size: $([math]::Round($totalSize, 2)) MB" -ForegroundColor Gray
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Cyan
Write-Host "1. Copy this folder to external drive or cloud storage"
Write-Host "2. Deploy to second PC via Portable ZIP or NSIS Setup"
Write-Host "3. Verify PWA cache-busting works correctly"
Write-Host "4. Confirm no 'frontend antigo' appears"
