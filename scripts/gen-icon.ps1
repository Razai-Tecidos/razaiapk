$ErrorActionPreference = 'Stop'
$iconsDir = Join-Path $PSScriptRoot '..\src-tauri\icons' | Resolve-Path -ErrorAction SilentlyContinue
if (-not $iconsDir) {
  $iconsDir = Join-Path $PSScriptRoot '..\src-tauri\icons'
  New-Item -ItemType Directory -Path $iconsDir -Force | Out-Null
}
$icoPath = Join-Path $iconsDir 'icon.ico'
if (-not (Test-Path $icoPath)) {
  Write-Host 'Generating minimal icon.ico for Windows bundling...'
  $bytes = [byte[]](0,0,1,0,1,0,1,1,0,0,1,0,32,0,48,0,0,0,22,0,0,0,40,0,0,0,1,0,0,0,2,0,0,0,1,0,32,0,0,0,0,0,4,0,0,0,0,0,0,0,0,0,0,0,255,255,255,255,0,0,0,0)
  [IO.File]::WriteAllBytes($icoPath, $bytes)
}
