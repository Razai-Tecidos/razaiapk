#!/usr/bin/env node
/**
 * Publish latest release artifacts to Supabase Storage and generate latest-release.json.
 * Requirements (env):
 *  SUPABASE_URL
 *  SUPABASE_SERVICE_ROLE_KEY (service role; DO NOT COMMIT)
 *  RELEASE_BUCKET (default 'releases')
 *  RELEASE_CHANNEL (optional, default 'stable')
 *  PUBLISH_VERSION (optional override; else inferred from Cargo.toml)
 *
 * Usage:
 *  SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node scripts/publish-release.mjs
 */
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';

const root = path.resolve(process.cwd());
const cargoToml = await fsp.readFile(path.join(root, 'src-tauri', 'Cargo.toml'), 'utf8');
const versionMatch = cargoToml.match(/version\s*=\s*"([0-9]+\.[0-9]+\.[0-9]+)"/);
if (!versionMatch) throw new Error('Cannot extract version from Cargo.toml');
const version = process.env.PUBLISH_VERSION || versionMatch[1];
const releaseDir = path.join(root, 'release', `v${version}`);
if (!fs.existsSync(releaseDir)) {
  console.error('[publish] Release dir not found:', releaseDir);
  process.exit(1);
}

const SUPABASE_URL = process.env.SUPABASE_URL;
// Allow fallback to SERVICE_ROLE_KEY legacy naming
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SERVICE_ROLE_KEY;
const BUCKET = process.env.RELEASE_BUCKET || 'releases';
const CHANNEL = process.env.RELEASE_CHANNEL || 'stable';
if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('[publish] Missing SUPABASE_URL or service role key (SUPABASE_SERVICE_ROLE_KEY / SERVICE_ROLE_KEY).');
  console.error('[publish] Set the env vars then re-run: SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node scripts/publish-release.mjs');
  process.exit(2);
}

function parseSummary(file) {
  const text = fs.readFileSync(file, 'utf8');
  const lines = text.split(/\r?\n/);
  const files = [];
  for (const line of lines) {
    // Lines in RELEASE_SUMMARY.txt are formatted as:
    // "  - filename  SHA256=<hash>" (two leading spaces, two spaces between filename and SHA256)
    // Be tolerant to variable whitespace.
    const m = line.match(/^\s*-\s+(.+?)\s+SHA256=([a-f0-9]{64})$/i);
    if (m) files.push({ name: m[1], sha256: m[2] });
  }
  return files;
}

const summaryPath = path.join(releaseDir, 'RELEASE_SUMMARY.txt');
if (!fs.existsSync(summaryPath)) {
  console.error('[publish] RELEASE_SUMMARY.txt missing:', summaryPath);
  process.exit(1);
}

const fileEntries = parseSummary(summaryPath);
if (!fileEntries.length) {
  console.error('[publish] No file entries parsed from summary.');
  process.exit(1);
}

async function uploadFile(entry) {
  const filePath = path.join(releaseDir, entry.name);
  if (!fs.existsSync(filePath)) {
    console.warn('[publish] File missing, skipping:', entry.name);
    return null;
  }
  const data = fs.readFileSync(filePath);
  const targetPath = `v${version}/${entry.name}`;
  const url = `${SUPABASE_URL}/storage/v1/object/${BUCKET}/${encodeURIComponent(targetPath)}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${SERVICE_KEY}`,
      'x-upsert': 'true'
    },
    body: data
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Upload failed for ${entry.name}: ${res.status} ${text}`);
  }
  return { ...entry, sizeBytes: data.length, url: `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/v${version}/${entry.name}` };
}

console.log(`[publish] Uploading ${fileEntries.length} artifacts to bucket '${BUCKET}' (version ${version})...`);
const published = [];
for (const e of fileEntries) {
  const r = await uploadFile(e);
  if (r) published.push(r);
}

const manifest = {
  version,
  channel: CHANNEL,
  publishedAt: new Date().toISOString(),
  files: published,
  totalSize: published.reduce((a, b) => a + (b.sizeBytes || 0), 0)
};

// Store version-specific manifest
async function uploadJson(obj, target) {
  const json = JSON.stringify(obj, null, 2);
  const url = `${SUPABASE_URL}/storage/v1/object/${BUCKET}/${encodeURIComponent(target)}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${SERVICE_KEY}`,
      'x-upsert': 'true',
      'Content-Type': 'application/json'
    },
    body: json
  });
  if (!res.ok) {
    throw new Error(`Upload manifest ${target} failed: ${res.status}`);
  }
}

await uploadJson(manifest, `v${version}/manifest.json`);
await uploadJson(manifest, 'latest-release.json');

console.log('[publish] Release manifest uploaded.');
console.log('[publish] Latest release URL (public):');
console.log(`${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/latest-release.json`);
