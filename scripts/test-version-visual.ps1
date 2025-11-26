param()

Write-Host ""
Write-Host "TESTE DE VERSAO DO FRONTEND" -ForegroundColor Cyan
Write-Host ""

Write-Host "BUILD ATUAL EMBARCADA:" -ForegroundColor Yellow
Write-Host "  Build Hash: 45ab20812473af6d" -ForegroundColor Green
Write-Host "  Marker: BUILD_HASH_NEW" -ForegroundColor Green
Write-Host "  Color: Verde" -ForegroundColor Green
Write-Host ""

Write-Host "O QUE PROCURAR:" -ForegroundColor Cyan
Write-Host "- No header do app (canto superior esquerdo)" -ForegroundColor Gray
Write-Host "- Um badge VERDE com 'BUILD_HASH_NEW'" -ForegroundColor Gray
Write-Host ""

Write-Host "RESULTADO:" -ForegroundColor Cyan
Write-Host "SE VER O BADGE VERDE - frontend novo foi carregado!" -ForegroundColor Green
Write-Host "SE NAO VER - frontend antigo esta em cache" -ForegroundColor Red
Write-Host ""

Start-Sleep -Seconds 2

$rawExePath = "C:\Users\Rafael\Desktop\Razai Tools\src-tauri\target\release\razai-tools.exe"

if (Test-Path $rawExePath) {
    Write-Host "Abrindo app..." -ForegroundColor Green
    & $rawExePath
    Write-Host "App aberto. Verifique o header!" -ForegroundColor Green
} else {
    Write-Host "Erro: EXE nao encontrado" -ForegroundColor Red
}
