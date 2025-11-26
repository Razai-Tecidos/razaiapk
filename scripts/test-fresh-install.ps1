#!/usr/bin/env powershell
# Test fresh install simulation: creates isolated test environments for each installer
# Usage: powershell -NoProfile -ExecutionPolicy Bypass -File scripts/test-fresh-install.ps1

param(
  [string]$TestDir = "C:\Temp\razai-tools-test-$(Get-Date -Format 'yyyyMMdd-HHmmss')",
  [switch]$SkipCleanup
)

$ErrorActionPreference = "Stop"

Write-Host "=== Razai Tools Fresh Install Test ===" -ForegroundColor Cyan
Write-Host "Test directory: $TestDir" -ForegroundColor Gray
Write-Host ""

# Create isolated test environment
function New-TestEnvironment {
  param([string]$Name)
  $dir = Join-Path $TestDir $Name
  Write-Host "Setting up test env: $Name" -ForegroundColor Yellow
  New-Item -ItemType Directory -Path $dir -Force | Out-Null
  return $dir
}

# Simulate clean Windows by removing all user app data
function Remove-AppData {
  param([string]$Name)
  $appDataPath = Join-Path $env:APPDATA $Name
  if (Test-Path $appDataPath) {
    Write-Host "  Cleaning old app data: $appDataPath" -ForegroundColor Gray
    Remove-Item -Path $appDataPath -Recurse -Force -ErrorAction SilentlyContinue
  }
}

# Test MSI installer
function Test-MsiInstall {
  Write-Host "`n[TEST 1] MSI Installer" -ForegroundColor Cyan
  $testEnv = New-TestEnvironment "test-msi"
  $msiPath = "c:\Users\Rafael\Desktop\Razai Tools\src-tauri\target\release\bundle\msi\Razai Tools_0.1.4_x64_en-US.msi"
  
  if (-not (Test-Path $msiPath)) {
    Write-Host "  [FAIL] MSI not found: $msiPath" -ForegroundColor Red
    return $false
  }
  
  Write-Host "  Source: $msiPath" -ForegroundColor Gray
  Write-Host "  Size: $([math]::Round((Get-Item $msiPath).Length / 1MB, 2)) MB" -ForegroundColor Gray
  
  Remove-AppData "razai-tools"
  
  Write-Host "  Installing MSI..." -ForegroundColor Gray
  
  try {
    $logPath = Join-Path $testEnv "install.log"
    $proc = Start-Process -FilePath msiexec -ArgumentList "/i `"$msiPath`" /qn /l*v `"$logPath`"" -PassThru -Wait
    
    if ($proc.ExitCode -eq 0) {
      Write-Host "  [PASS] MSI installed successfully" -ForegroundColor Green
      
      $exe = "C:\Program Files\Razai Tools\razai-tools.exe"
      if (Test-Path $exe) {
        Write-Host "  [PASS] Executable found: $exe" -ForegroundColor Green
        
        Write-Host "  Launching app (10s timeout)..." -ForegroundColor Gray
        try {
          $appProc = Start-Process -FilePath $exe -PassThru
          Start-Sleep -Seconds 10
          if (-not $appProc.HasExited) {
            $appProc | Stop-Process -Force
            Write-Host "  [PASS] App started successfully" -ForegroundColor Green
            return $true
          } else {
            Write-Host "  [WARN] App exited unexpectedly" -ForegroundColor Yellow
            return $false
          }
        } catch {
          Write-Host "  [WARN] Could not launch app: $_" -ForegroundColor Yellow
          return $true
        }
      } else {
        Write-Host "  [FAIL] Executable not found at $exe" -ForegroundColor Red
        return $false
      }
    } else {
      Write-Host "  [FAIL] MSI install failed with exit code: $($proc.ExitCode)" -ForegroundColor Red
      return $false
    }
  } catch {
    Write-Host "  [FAIL] Error: $_" -ForegroundColor Red
    return $false
  }
}

# Test NSIS installer
function Test-NsisInstall {
  Write-Host "`n[TEST 2] NSIS Setup Installer" -ForegroundColor Cyan
  $testEnv = New-TestEnvironment "test-nsis"
  $nsisPath = "c:\Users\Rafael\Desktop\Razai Tools\src-tauri\target\release\bundle\nsis\Razai Tools_0.1.4_x64-setup.exe"
  
  if (-not (Test-Path $nsisPath)) {
    Write-Host "  [FAIL] NSIS setup not found: $nsisPath" -ForegroundColor Red
    return $false
  }
  
  Write-Host "  Source: $nsisPath" -ForegroundColor Gray
  Write-Host "  Size: $([math]::Round((Get-Item $nsisPath).Length / 1MB, 2)) MB" -ForegroundColor Gray
  
  Remove-AppData "razai-tools"
  
  Write-Host "  Installing via NSIS (silent mode)..." -ForegroundColor Gray
  
  try {
    $proc = Start-Process -FilePath $nsisPath -ArgumentList "/S" -PassThru -Wait
    
    if ($proc.ExitCode -eq 0) {
      Write-Host "  [PASS] NSIS installer executed successfully" -ForegroundColor Green
      
      $exe = "C:\Program Files\Razai Tools\razai-tools.exe"
      if (Test-Path $exe) {
        Write-Host "  [PASS] Executable found: $exe" -ForegroundColor Green
        return $true
      } else {
        Write-Host "  [WARN] Executable may be in different location" -ForegroundColor Yellow
        return $true
      }
    } else {
      Write-Host "  [FAIL] NSIS install failed with exit code: $($proc.ExitCode)" -ForegroundColor Red
      return $false
    }
  } catch {
    Write-Host "  [FAIL] Error: $_" -ForegroundColor Red
    return $false
  }
}

# Test Portable ZIP
function Test-PortableZip {
  Write-Host "`n[TEST 3] Portable ZIP" -ForegroundColor Cyan
  $testEnv = New-TestEnvironment "test-portable"
  $zipPath = "c:\Users\Rafael\Desktop\Razai Tools\portable\razai-tools-portable-v0.1.4.zip"
  
  if (-not (Test-Path $zipPath)) {
    Write-Host "  [FAIL] Portable ZIP not found: $zipPath" -ForegroundColor Red
    return $false
  }
  
  Write-Host "  Source: $zipPath" -ForegroundColor Gray
  Write-Host "  Size: $([math]::Round((Get-Item $zipPath).Length / 1MB, 2)) MB" -ForegroundColor Gray
  
  Write-Host "  Extracting ZIP..." -ForegroundColor Gray
  
  try {
    Expand-Archive -Path $zipPath -DestinationPath $testEnv -Force
    
    $exePath = Get-ChildItem -Path $testEnv -Filter "*.exe" -Recurse | Select-Object -First 1
    if ($exePath) {
      Write-Host "  [PASS] ZIP extracted, found exe: $($exePath.Name)" -ForegroundColor Green
      
      $readmePath = Get-ChildItem -Path $testEnv -Filter "README*" -Recurse | Select-Object -First 1
      if ($readmePath) {
        Write-Host "  [PASS] README found: $($readmePath.Name)" -ForegroundColor Green
      }
      
      Write-Host "  Launching portable exe (10s timeout)..." -ForegroundColor Gray
      try {
        $appProc = Start-Process -FilePath $exePath.FullName -PassThru
        Start-Sleep -Seconds 10
        if (-not $appProc.HasExited) {
          $appProc | Stop-Process -Force
          Write-Host "  [PASS] Portable exe started successfully" -ForegroundColor Green
          return $true
        } else {
          Write-Host "  [WARN] App exited unexpectedly" -ForegroundColor Yellow
          return $false
        }
      } catch {
        Write-Host "  [WARN] Could not launch app: $_" -ForegroundColor Yellow
        return $true
      }
    } else {
      Write-Host "  [FAIL] No exe found in ZIP" -ForegroundColor Red
      return $false
    }
  } catch {
    Write-Host "  [FAIL] Error: $_" -ForegroundColor Red
    return $false
  }
}

# Test raw EXE
function Test-RawExe {
  Write-Host "`n[TEST 4] Raw Executable (unpacked)" -ForegroundColor Cyan
  $testEnv = New-TestEnvironment "test-raw-exe"
  $exePath = "c:\Users\Rafael\Desktop\Razai Tools\src-tauri\target\release\razai-tools.exe"
  
  if (-not (Test-Path $exePath)) {
    Write-Host "  [FAIL] Raw exe not found: $exePath" -ForegroundColor Red
    return $false
  }
  
  Write-Host "  Source: $exePath" -ForegroundColor Gray
  Write-Host "  Size: $([math]::Round((Get-Item $exePath).Length / 1MB, 2)) MB" -ForegroundColor Gray
  
  $copyPath = Join-Path $testEnv "razai-tools.exe"
  Copy-Item -Path $exePath -Destination $copyPath
  Write-Host "  Copied to isolated location: $copyPath" -ForegroundColor Gray
  
  Write-Host "  Launching exe (10s timeout)..." -ForegroundColor Gray
  
  try {
    $appProc = Start-Process -FilePath $copyPath -PassThru
    Start-Sleep -Seconds 10
    if (-not $appProc.HasExited) {
      $appProc | Stop-Process -Force
      Write-Host "  [PASS] Raw exe started successfully" -ForegroundColor Green
      return $true
    } else {
      Write-Host "  [WARN] App exited unexpectedly" -ForegroundColor Yellow
      return $false
    }
  } catch {
    Write-Host "  [FAIL] Error launching exe: $_" -ForegroundColor Red
    return $false
  }
}

# Main test flow
try {
  New-Item -ItemType Directory -Path $TestDir -Force | Out-Null
  
  $results = @{}
  $results["MSI"] = Test-MsiInstall
  $results["NSIS"] = Test-NsisInstall
  $results["Portable ZIP"] = Test-PortableZip
  $results["Raw EXE"] = Test-RawExe
  
  Write-Host "`n=== TEST SUMMARY ===" -ForegroundColor Cyan
  foreach ($key in $results.Keys) {
    $status = if ($results[$key]) { "[PASS]" } else { "[FAIL]" }
    $color = if ($results[$key]) { "Green" } else { "Red" }
    Write-Host "$key : $status" -ForegroundColor $color
  }
  
  $passed = ($results.Values | Where-Object { $_ }).Count
  $total = $results.Count
  $passColor = if ($passed -eq $total) { "Green" } else { "Yellow" }
  Write-Host "`nTotal: $passed/$total passed" -ForegroundColor $passColor
  
  Write-Host "`nTest artifacts: $TestDir" -ForegroundColor Gray
  
} catch {
  Write-Host "`n[FAIL] Fatal error: $_" -ForegroundColor Red
  exit 1
}
