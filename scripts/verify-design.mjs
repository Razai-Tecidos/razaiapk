#!/usr/bin/env node
// Verifies that dist assets use new Design System colors and not legacy dark theme.
import fs from 'node:fs'
import path from 'node:path'

const dist = path.resolve('app','dist')
if (!fs.existsSync(dist)) {
  console.error('[verify-design] dist folder missing. Run vite build first.')
  process.exit(1)
}

const NEW_COLORS = ['#FCFCFC','#FFFFFF','#F8F8F8']
const LEGACY_COLORS = ['#0b1324','#0b0f19','#171717']

let cssFiles = []
for (const file of fs.readdirSync(path.join(dist,'assets'))) {
  if (/\.css$/i.test(file)) cssFiles.push(path.join(dist,'assets',file))
}

if (cssFiles.length === 0) {
  console.error('[verify-design] No CSS files found in dist/assets')
  process.exit(1)
}

let combined = ''
for (const f of cssFiles) combined += fs.readFileSync(f,'utf8')

const presentNew = NEW_COLORS.filter(c => combined.toLowerCase().includes(c.toLowerCase()))
const presentLegacy = LEGACY_COLORS.filter(c => combined.toLowerCase().includes(c.toLowerCase()))

console.log('[verify-design] New colors found:', presentNew.join(', ') || 'NONE')
console.log('[verify-design] Legacy colors found:', presentLegacy.join(', ') || 'NONE')

if (presentLegacy.length) {
  console.error('[verify-design] FAIL: legacy dark theme colors detected:', presentLegacy)
  process.exit(2)
}
if (!presentNew.length) {
  console.error('[verify-design] FAIL: expected new light colors not detected')
  process.exit(3)
}
console.log('[verify-design] PASS: Design System colors applied.')
