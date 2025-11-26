import fs from 'node:fs'
import fsp from 'node:fs/promises'
import path from 'node:path'
import crypto from 'node:crypto'
import { execSync } from 'node:child_process'

const root = path.resolve(process.cwd())
const cargoToml = await fsp.readFile(path.join(root, 'src-tauri', 'Cargo.toml'), 'utf8')
const m = cargoToml.match(/version\s*=\s*"([0-9]+\.[0-9]+\.[0-9]+)"/)
if (!m) {
  console.error('[portable] Could not determine version from Cargo.toml')
  process.exit(1)
}
const version = m[1]
console.log(`[portable] Version = ${version}`)

// Skip build, assume exe exists
let exeSrc = path.join(root, 'src-tauri', 'target', 'release', 'razai-tools.exe')
if (!fs.existsSync(exeSrc)) {
  console.error('[portable] Executable not found at expected path:', exeSrc)
  process.exit(1)
}

const portableDir = path.join(root, 'portable')
await fsp.mkdir(portableDir, { recursive: true })
const distDir = path.join(portableDir, `razai-tools-portable-v${version}`)
await fsp.rm(distDir, { recursive: true, force: true })
await fsp.mkdir(distDir, { recursive: true })

const exeDest = path.join(distDir, `razai-tools-v${version}.exe`)
await fsp.copyFile(exeSrc, exeDest)
console.log('[portable] Copied exe to', exeDest)

// Compute SHA256
const hash = crypto.createHash('sha256').update(await fsp.readFile(exeDest)).digest('hex')
console.log('[portable] SHA256:', hash)

// Create README
const readme = `Razai Tools Portable\n\nVersão: v${version}\nArquivo: ${path.basename(exeDest)}\nSHA256: ${hash}\n\nRequisitos:\n- Windows 10+\n- Runtime WebView2 (se não instalado, o Windows deve baixar automaticamente; caso contrário instalar manualmente: https://developer.microsoft.com/en-us/microsoft-edge/webview2/ )\n\nUso:\n1. Extraia o zip em qualquer pasta.\n2. Dê duplo clique no executável.\n3. Para atualizar, substitua o exe por uma versão mais recente.\n\nObservações:\n- Dados locais ficam em %APPDATA%/razai-tools (SQLite).\n- Faça backup via tela Exportações / Configurações antes de trocar a versão se necessário.\n\n`;
await fsp.writeFile(path.join(distDir, 'README-portable.txt'), readme, 'utf8')

// Create checksum file
await fsp.writeFile(path.join(distDir, 'SHA256.txt'), hash + '\n', 'utf8')

// Create zip (PowerShell Compress-Archive)
try {
  const zipName = `razai-tools-portable-v${version}.zip`
  const zipPath = path.join(portableDir, zipName)
  if (fs.existsSync(zipPath)) await fsp.rm(zipPath, { force: true })
  console.log('[portable] Creating zip:', zipPath)
  execSync(`powershell -NoProfile -Command Compress-Archive -Path '${distDir}/*' -DestinationPath '${zipPath}'`, { stdio: 'inherit' })
  console.log('[portable] Zip created at', zipPath)
} catch (e) {
  console.warn('[portable] Failed to zip via PowerShell:', e.message)
}

console.log('[portable] DONE')
