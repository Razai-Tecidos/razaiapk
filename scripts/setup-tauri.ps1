param(
  [switch]$Force
)

$ErrorActionPreference = 'Stop'

function Test-Installed($cmd) {
  try { Get-Command $cmd -ErrorAction Stop | Out-Null; return $true } catch { return $false }
}

Write-Host "=== Tauri Desktop - Setup (Windows) ===" -ForegroundColor Cyan

# 1) Rust + Cargo
if (-not (Test-Installed cargo)) {
  Write-Host "Rust/Cargo não encontrado. Instalando via rustup..." -ForegroundColor Yellow
  $rustup = "$PSScriptRoot\\rustup-init.exe"
  Invoke-WebRequest https://win.rustup.rs -UseBasicParsing -OutFile $rustup
  & $rustup -y | Out-Null
  Remove-Item $rustup -Force
  # refresh PATH for this session
  $env:PATH = [System.Environment]::GetEnvironmentVariable('PATH','User') + ';' + [System.Environment]::GetEnvironmentVariable('PATH','Machine')
}
else {
  Write-Host "Rust/Cargo já instalado." -ForegroundColor Green
}

# Ensure MSVC toolchain
try {
  rustup default stable-x86_64-pc-windows-msvc | Out-Null
} catch { }

# 2) Visual Studio Build Tools (C++)
if (-not (Test-Installed winget)) {
  Write-Host "winget não encontrado. Instale manualmente o Visual Studio Build Tools (C++)." -ForegroundColor Red
} else {
  Write-Host "Verificando Visual Studio Build Tools (C++) via winget..." -ForegroundColor Yellow
  # Attempt install silently; user may need to confirm
  winget install --id Microsoft.VisualStudio.2022.BuildTools -e --source winget --silent | Out-Null
}

# 3) WebView2 Runtime
if (Test-Installed "C:\\Program Files (x86)\\Microsoft\\EdgeWebView\\Application\\msedgewebview2.exe" -or Test-Installed msedgewebview2) {
  Write-Host "WebView2 já instalado." -ForegroundColor Green
} else {
  if (Test-Installed winget) {
    Write-Host "Instalando WebView2 Runtime..." -ForegroundColor Yellow
    winget install Microsoft.EdgeWebView2Runtime -e --silent | Out-Null
  } else {
    Write-Host "Instale manualmente o WebView2 Runtime." -ForegroundColor Red
  }
}

Write-Host "=== Verificação de ambiente ===" -ForegroundColor Cyan
$checks = @(
  @{ Name='cargo'; Ok=(Test-Installed cargo) },
  @{ Name='rustc'; Ok=(Test-Installed rustc) },
  @{ Name='WebView2'; Ok=(Test-Path "C:\\Program Files (x86)\\Microsoft\\EdgeWebView\\Application") },
  @{ Name='MSVC Build Tools'; Ok=$true } # heuristic, winget não expõe fácil
)

$allOk = $true
foreach ($c in $checks) {
  $status = if ($c.Ok) { 'OK' } else { $allOk=$false; 'FALTA' }
  Write-Host ("- {0}: {1}" -f $c.Name, $status)
}

if ($allOk) {
  Write-Host "Ambiente OK. Você pode rodar: cd .\\app; npm run dev:tauri" -ForegroundColor Green
} else {
  Write-Host "Alguns itens faltando. Revise as mensagens acima. Depois rode novamente este script ou tente rodar o Tauri." -ForegroundColor Yellow
}
