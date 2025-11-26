#!/usr/bin/env node
/**
 * Aggregate release build script.
 * Steps:
 * 1. Sync version across manifests.
 * 2. Run full test suite.
 * 3. Build frontend (Vite).
 * 4. Build Tauri bundle (exe + installer).
 * 5. Collect artifacts (exe, msi/nsis) into release/ directory.
 * 6. Invoke portable build script to create zipped portable package.
 * 7. Generate RELEASE_SUMMARY.txt with hashes and file list.
 */
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { execSync } from 'node:child_process';

const root = path.resolve(process.cwd());
const releaseDir = path.join(root, 'release');
await fsp.mkdir(releaseDir, { recursive: true });

function run(cmd, opts={}) {
  console.log(`[release] RUN: ${cmd}`);
  execSync(cmd, { stdio: 'inherit', ...opts });
}

function sha256(file) {
  return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
}

// 1. Sync version
run('npm run sync:version');
const cargoToml = await fsp.readFile(path.join(root, 'src-tauri', 'Cargo.toml'), 'utf8');
const m = cargoToml.match(/version\s*=\s*"([0-9]+\.[0-9]+\.[0-9]+)"/);
if (!m) throw new Error('Cannot extract version from Cargo.toml');
const version = m[1];
console.log('[release] Version =', version);

// 2. Tests
run('npm test');

// 3. Frontend build
run('npm run build');

// 4. Tauri bundle
run('npm run build:tauri');

// 5. Collect artifacts
const tauriTarget = path.join(root, 'src-tauri', 'target', 'release');
const bundleRoot = path.join(tauriTarget, 'bundle');
const artifacts = [];

function collectFiles(dir) {
  if (!fs.existsSync(dir)) return;
  for (const entry of fs.readdirSync(dir)) {
    const full = path.join(dir, entry);
    const stat = fs.statSync(full);
    if (stat.isDirectory()) collectFiles(full); else artifacts.push(full);
  }
}
collectFiles(bundleRoot);

// Filter interesting installer/exe files
const interesting = artifacts.filter(f => /\.(exe|msi|nsis|zip)$/i.test(f));
if (!interesting.length) console.warn('[release] No installer/exe artifacts found.');

const versionDir = path.join(releaseDir, `v${version}`);
await fsp.rm(versionDir, { recursive: true, force: true });
await fsp.mkdir(versionDir, { recursive: true });

for (const file of interesting) {
  const base = path.basename(file);
  const dest = path.join(versionDir, base);
  await fsp.copyFile(file, dest);
  console.log('[release] Copied', base);
}

// 6. Portable build (creates portable/razai-tools-portable-vX + zip)
run('npm run build:portable');
const portableRoot = path.join(root, 'portable');
if (fs.existsSync(portableRoot)) {
  for (const entry of fs.readdirSync(portableRoot)) {
    const full = path.join(portableRoot, entry);
    if (/\.zip$/i.test(entry)) {
      const dest = path.join(versionDir, entry);
      await fsp.copyFile(full, dest);
      console.log('[release] Added portable zip', entry);
    }
  }
}

// 7. Generate summary with hashes
let summary = `Razai Tools Release v${version}\n\nArtifacts:\n`;
const filesInVersion = fs.readdirSync(versionDir).filter(f => fs.statSync(path.join(versionDir, f)).isFile());
for (const f of filesInVersion) {
  const full = path.join(versionDir, f);
  const hash = sha256(full);
  summary += `  - ${f}  SHA256=${hash}\n`;
}
summary += '\nBuild time: ' + new Date().toISOString() + '\n';
await fsp.writeFile(path.join(versionDir, 'RELEASE_SUMMARY.txt'), summary, 'utf8');
console.log('[release] RELEASE_SUMMARY.txt written');

// 8. Optional publish step (requires service role key env)
if (process.env.PUBLISH_RELEASE === '1') {
  try {
    console.log('[release] PUBLISH_RELEASE=1 detected; invoking publish-release script');
    // Use same node process (spawn new script)
    execSync('node scripts/publish-release.mjs', { stdio: 'inherit' });
  } catch (e) {
    console.warn('[release] Publish step failed:', e.message);
  }
} else {
  console.log('[release] Skipping publish step (set PUBLISH_RELEASE=1 to enable).');
}

console.log('\n[release] DONE: aggregated artifacts in', versionDir);
