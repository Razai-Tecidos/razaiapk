$ErrorActionPreference = 'Stop'
$env:Path = "$env:UserProfile\.cargo\bin;$env:Path"
Set-Location "$PSScriptRoot\..\app"
npm run dev:tauri
