/**
 * Cloud Sync (Supabase free-tier friendly, but provider-agnostic)
 *
 * Minimal implementation for:
 *  - Fetch latest manifest (metadata + hash + timestamp)
 *  - Download latest backup JSON
 *  - Upload new backup (if user triggers)
 *
 * This module is purposely lightweight and does not pull in Supabase SDK.
 * It uses plain fetch against public REST endpoints you can expose via
 * Edge Functions or Row Level Policies (RLS) with a public anon key.
 *
 * ENV EXPECTED (placeholders added in .env):
 *  VITE_SUPABASE_URL
 *  VITE_SUPABASE_ANON_KEY
 *
 * STORAGE/BACKEND ASSUMPTION:
 *  - A public bucket named `backups` containing files like `latest.json`
 *  - Optionally timestamped snapshots: `full-<ISO>.json`
 *  - A table `backups_manifest` with a single row (or latest row) containing:
 *      id, updated_at (timestamptz), hash (text), size_bytes (int), version (int)
 *  - An Edge Function or REST policy that allows SELECT on `backups_manifest`.
 *
 * If Supabase is not configured (no env vars), functions return early.
 */
import { buildBackupInWorker, importBackupInWorker } from './workers'
import { db, colorsDb, patternsDb } from './db'
import { verifyFullExportIntegrity } from './export'

export interface CloudManifest {
  hash: string
  updated_at: string
  version: number
  size_bytes?: number
}

interface CloudSyncConfig {
  url?: string
  anonKey?: string
  auto?: boolean
  bucket?: string // novo: permite configurar nome do bucket (default 'backups')
  uploadToken?: string // se presente, usa Edge Function segura para upload
}

const CONFIG_KEY = 'cloud-sync-config'
const LAST_IMPORT_TS_KEY = 'cloud-sync-last-import-ts'
const LAST_UPLOAD_KEY = 'cloud-sync-last-upload'

export function getConfig(): CloudSyncConfig {
  try {
    const raw = localStorage.getItem(CONFIG_KEY)
    if (!raw) return {}
    return JSON.parse(raw)
  } catch { return {} }
}

export function saveConfig(cfg: CloudSyncConfig) {
  localStorage.setItem(CONFIG_KEY, JSON.stringify(cfg))
}

export function getLastImportTimestamp(): number {
  const v = localStorage.getItem(LAST_IMPORT_TS_KEY)
  return v ? Number(v) : 0
}

function setLastImportTimestamp(ts: number) {
  localStorage.setItem(LAST_IMPORT_TS_KEY, String(ts))
}

function envSupabaseUrl(): string | undefined {
  return import.meta.env.VITE_SUPABASE_URL
}
function envSupabaseAnon(): string | undefined {
  return import.meta.env.VITE_SUPABASE_ANON_KEY
}
function envSupabaseUploadToken(): string | undefined {
  return import.meta.env.VITE_SUPABASE_UPLOAD_TOKEN
}
function envSupabaseBucket(): string | undefined {
  return import.meta.env.VITE_SUPABASE_BUCKET
}
function envSupabaseAuto(): boolean | undefined {
  const raw = import.meta.env.VITE_SUPABASE_AUTO
  if (raw === undefined) return undefined
  if (typeof raw === 'string') {
    if (/^(0|false|off|no)$/i.test(raw.trim())) return false
    if (/^(1|true|on|yes)$/i.test(raw.trim())) return true
  }
  return undefined
}

/** Constrói URL correta para Edge Function Supabase.
 *  Base típica: https://<ref>.supabase.co
 *  Funções:     https://<ref>.functions.supabase.co/<nome>
 */
function buildFunctionUrl(base: string, fnName: string): string {
  try {
    const u = new URL(base)
    const host = u.host // ex: uxjpqavwwuctqndzubha.supabase.co
    if (!host.endsWith('.supabase.co')) return `${base}/functions/v1/${fnName}`
    const ref = host.slice(0, -'.supabase.co'.length)
    return `https://${ref}.functions.supabase.co/${fnName}`
  } catch {
    return `${base}/functions/v1/${fnName}` // fallback
  }
}

export async function fetchManifest(): Promise<CloudManifest | null> {
  const cfg = getConfig()
  const base = cfg.url || envSupabaseUrl()
  const anon = cfg.anonKey || envSupabaseAnon()
  // bucket não é necessário para manifesto; somente downloads/uploads
  if (!base || !anon) return null
  try {
    // Assuming a REST endpoint or Edge Function: GET /rest/v1/backups_manifest?select=*&limit=1&order=updated_at.desc
    const url = `${base}/rest/v1/backups_manifest?select=*&order=updated_at.desc&limit=1`
    const res = await fetch(url, { headers: { apikey: anon, Authorization: `Bearer ${anon}` } })
    if (!res.ok) return null
    const data = await res.json()
    if (Array.isArray(data) && data.length) {
      const row = data[0]
      return {
        hash: row.hash || '',
        updated_at: row.updated_at,
        version: row.version || 4,
        size_bytes: row.size_bytes
      }
    }
    return null
  } catch { return null }
}

export async function downloadLatestBackup(): Promise<string | null> {
  const cfg = getConfig()
  const base = cfg.url || envSupabaseUrl()
  const anon = cfg.anonKey || envSupabaseAnon()
  const bucket = cfg.bucket || 'backups'
  if (!base || !anon) return null
  try {
    // Public bucket object path (requires bucket público)
    const url = `${base}/storage/v1/object/public/${bucket}/latest.json`
    const res = await fetch(url, { headers: { apikey: anon } })
    if (!res.ok) return null
    return await res.text()
  } catch { return null }
}

export async function uploadNewBackup(): Promise<{ ok: boolean; reason?: string }> {
  const cfg = getConfig()
  const base = cfg.url || envSupabaseUrl()
  const anon = cfg.anonKey || envSupabaseAnon()
  const bucket = cfg.bucket || 'backups'
  // Se uploadToken estiver definido (mesmo string vazia) no config, respeita.
  // String vazia desativa explicitamente uso da env.
  const uploadTokenRaw = (cfg.uploadToken !== undefined ? cfg.uploadToken : (envSupabaseUploadToken() || ''))
  const uploadToken = uploadTokenRaw.trim()
  if (!base || !anon) return { ok: false, reason: 'No config/env' }
  try {
    // Build full backup JSON (v4 with integrity)
    // Build backup using worker (falls back automatically if workers unsupported)
    const json = await buildBackupInWorker()
    const blob = new Blob([json], { type: 'application/json' })

    // Extract stats for filename
    let tissueCount = 0
    try {
      const parsed = JSON.parse(json)
      if (parsed && Array.isArray(parsed.tissues)) tissueCount = parsed.tissues.length
    } catch {}

    // Caminho seguro: se houver uploadToken usamos Edge Function no domínio functions.supabase.co
    if (uploadToken) {
      let parsed: any
      try { parsed = JSON.parse(json) } catch { return { ok: false, reason: 'Invalid JSON generated' } }
      const hash = parsed?.integrity?.hashHex || ''
      const sizeBytes = json.length
      const fnUrl = buildFunctionUrl(base, 'upload_backup')
      const fnRes = await fetch(fnUrl, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-upload-token': uploadToken,
          apikey: anon,
          Authorization: `Bearer ${anon}`
        },
        body: JSON.stringify({ backupJson: parsed, hash, sizeBytes, tissueCount })
      })
      if (!fnRes.ok) {
        let detail: string | undefined
        try { detail = (await fnRes.text()).slice(0, 240) } catch {}
        const reason = `Edge upload failed (${fnRes.status}): ${detail || fnRes.statusText}`
        try { localStorage.setItem(LAST_UPLOAD_KEY, JSON.stringify({ ok: false, ts: Date.now(), reason })) } catch {}
        return { ok: false, reason }
      }
      try { localStorage.setItem(LAST_UPLOAD_KEY, JSON.stringify({ ok: true, ts: Date.now(), reason: 'uploaded via edge function' })) } catch {}
      return { ok: true }
    }
    // Upload to bucket as latest.json
    // Supabase Storage raw REST expects POST /storage/v1/object/{bucket}/{path}
    // Use x-upsert to allow overwrite without 409 conflict.
    const uploadUrl = `${base}/storage/v1/object/${bucket}/latest.json`
    const uploadRes = await fetch(uploadUrl, {
      method: 'POST',
      headers: {
        apikey: anon,
        Authorization: `Bearer ${anon}`,
        'content-type': 'application/json',
        'x-upsert': 'true'
      },
      body: blob
    })
    if (!uploadRes.ok) {
      let detail: string | undefined
      try {
        const text = await uploadRes.text()
        detail = text?.slice(0, 200)
      } catch {}
      // Traduz erro de bucket ausente
      if (detail && /Bucket not found/i.test(detail)) {
        return { ok: false, reason: `Bucket '${bucket}' não existe. Crie no painel Storage do Supabase.` }
      }
      const reason = `Upload failed (${uploadRes.status} ${uploadRes.statusText})${detail? ': '+ detail : ''}`
      try { localStorage.setItem(LAST_UPLOAD_KEY, JSON.stringify({ ok: false, ts: Date.now(), reason })) } catch {}
      return { ok: false, reason }
    }
    // Optional snapshot (best-effort; ignore failure)
    const ts = new Date().toISOString().replace(/[:]/g, '-')
    const snapshotName = `full-${ts}-qty${tissueCount}.json`
    const snapshotUrl = `${base}/storage/v1/object/${bucket}/${snapshotName}`
    let snapshotWarning = ''
    try {
      const snapRes = await fetch(snapshotUrl, {
        method: 'POST',
        headers: {
          apikey: anon,
          Authorization: `Bearer ${anon}`,
          'content-type': 'application/json',
          'x-upsert': 'true'
        },
        body: blob
      })
      if (!snapRes.ok) {
        const txt = await snapRes.text().catch(() => '')
        snapshotWarning = `Histórico falhou: ${snapRes.status} ${txt.slice(0, 50)}`
        console.warn('Snapshot upload failed:', txt)
      }
    } catch (e: any) {
      snapshotWarning = `Histórico erro: ${e.message}`
      console.warn('Snapshot upload error:', e)
    }
    return { ok: true, reason: snapshotWarning }
  } catch (e: any) {
    const reason = e?.message || String(e)
    try { localStorage.setItem(LAST_UPLOAD_KEY, JSON.stringify({ ok: false, ts: Date.now(), reason })) } catch {}
    return { ok: false, reason }
  }
}

export function getLastUploadRecord(): { ok: boolean; ts: number; reason?: string } | null {
  try {
    const raw = localStorage.getItem(LAST_UPLOAD_KEY)
    if (!raw) return null
    return JSON.parse(raw)
  } catch {
    return null
  }
}

/**
 * Auto import logic:
 *  - If config.auto enabled
 *  - Fetch manifest & compare updated_at vs last import timestamp
 *  - If newer: download and import via importFullBackupExact
 *  - Sets last import timestamp upon success
 */
export async function autoImportIfNeeded(): Promise<{ performed: boolean; reason?: string; imported?: number }> {
  const cfg = getConfig()
  if (!cfg.auto) return { performed: false, reason: 'auto disabled' }
  const manifest = await fetchManifest()
  if (!manifest) return { performed: false, reason: 'no manifest' }
  const lastTs = getLastImportTimestamp()
  const manifestTs = Date.parse(manifest.updated_at)
  if (!manifestTs || manifestTs <= lastTs) {
    return { performed: false, reason: 'no newer backup' }
  }
  const backupJson = await downloadLatestBackup()
  if (!backupJson) return { performed: false, reason: 'download failed' }
  // Verificar integridade + hash do manifesto antes de importar
  const ver = await verifyDownloadedBackup(manifest, backupJson)
  if (!ver.ok) return { performed: false, reason: ver.reason }
  const imported = await importBackupInWorker(backupJson)
  if (!imported.ok) return { performed: false, reason: imported.error || 'import failed' }
  setLastImportTimestamp(Date.now())
  const totalInserted = typeof imported.inserted === 'object'
    ? Object.values(imported.inserted).reduce((acc: number, n: any) => acc + (typeof n === 'number' ? n : 0), 0)
    : 0
  console.log('[cloud-sync] Imported cloud backup. Inserted:', imported.inserted)
  return { performed: true, imported: totalInserted }
}

/** Manual restore ignoring timestamp check */
export async function manualRestoreLatest(): Promise<{ ok: boolean; reason?: string; colorsImported?: number }> {
  const backupJson = await downloadLatestBackup()
  if (!backupJson) return { ok: false, reason: 'download failed' }
  // Tenta obter manifesto para validar hash; se não existir, ainda valida integridade
  const manifest = await fetchManifest()
  const ver = await verifyDownloadedBackup(manifest || undefined, backupJson)
  if (!ver.ok) return { ok: false, reason: ver.reason }
  const imported = await importBackupInWorker(backupJson)
  if (!imported.ok) return { ok: false, reason: imported.error || 'import failed' }
  setLastImportTimestamp(Date.now())
  return { ok: true, colorsImported: imported.inserted?.colors ?? 0 }
}

/** Quick heuristic: DB considered empty if no tissues/colors/patterns */
export async function isLocalDbEmpty(): Promise<boolean> {
  await db.init()
  const [t, c, p] = await Promise.all([db.listTissues(), colorsDb.listColors(), patternsDb.listPatterns()])
  return !t.length && !c.length && !p.length
}

/** Import immediately if DB empty regardless of timestamps */
export async function bootstrapCloudImport(): Promise<{ performed: boolean; reason?: string }> {
  const cfg = getConfig()
  if (!cfg.auto) return { performed: false, reason: 'auto disabled' }
  if (!(await isLocalDbEmpty())) {
    return autoImportIfNeeded() // fallback to timestamp logic
  }
  const backupJson = await downloadLatestBackup()
  if (!backupJson) return { performed: false, reason: 'no backup' }
  const manifest = await fetchManifest()
  const ver = await verifyDownloadedBackup(manifest || undefined, backupJson)
  if (!ver.ok) return { performed: false, reason: ver.reason }
  const imported = await importBackupInWorker(backupJson)
  if (!imported.ok) return { performed: false, reason: imported.error || 'import failed' }
  setLastImportTimestamp(Date.now())
  return { performed: true }
}

/**
 * ensureDefaultCloudConfig
 * Seta configuração inicial automaticamente a partir de variáveis de ambiente
 * na PRIMEIRA execução (quando não existir config persistida).
 * Não sobrescreve configuração já existente (usuário pode ter ajustado manualmente).
 * Regras:
 *  - Exige URL + ANON KEY válidos
 *  - bucket: VITE_SUPABASE_BUCKET ou 'backups'
 *  - uploadToken: VITE_SUPABASE_UPLOAD_TOKEN se presente
 *  - auto: true por padrão, a menos que VITE_SUPABASE_AUTO explicite false ("0", "false")
 */
export function ensureDefaultCloudConfig(overrides?: Partial<CloudSyncConfig>): { created: boolean; config?: CloudSyncConfig } {
  const existing = getConfig()
  if (existing.url || existing.anonKey) {
    return { created: false }
  }
  // Allow tests or callers to inject overrides explicitly without relying on import.meta.env mutability
  const url = overrides?.url ?? envSupabaseUrl()
  const anon = overrides?.anonKey ?? envSupabaseAnon()
  if (!url || !anon) return { created: false }
  const bucket = overrides?.bucket ?? envSupabaseBucket() ?? 'backups'
  const uploadToken = overrides?.uploadToken ?? envSupabaseUploadToken()
  const autoOverride = overrides?.auto
  const autoEnv = envSupabaseAuto()
  const auto = autoOverride !== undefined ? autoOverride : (autoEnv === undefined ? true : autoEnv)
  const cfg: CloudSyncConfig = {
    url,
    anonKey: anon,
    bucket,
    auto,
    ...(uploadToken ? { uploadToken } : {})
  }
  saveConfig(cfg)
  return { created: true, config: cfg }
}

/**
 * verifyDownloadedBackup
 * Executa validação de integridade (versão 4) e compara hash do manifesto com o hash embutido.
 * Para versões antigas (<4) permite import (modo legado) retornando ok com razão.
 * Retorna objeto com ok + reason (quando falha) para uso em fluxo de import.
 */
export async function verifyDownloadedBackup(manifest: CloudManifest | undefined, jsonText: string): Promise<{ ok: boolean; reason?: string }> {
  let obj: any
  try { obj = JSON.parse(jsonText) } catch { return { ok: false, reason: 'json inválido' } }
  if (!obj || obj.schema !== 'razai-tools.full-export') return { ok: false, reason: 'payload inválido' }
  const version = obj.version || 0
  if (version < 4) {
    // Modo legado: não havia integridade formal; permitir import (não há verificação de hash consistente).
    return { ok: true, reason: 'legacy sem integridade' }
  }
  if (version > 4) return { ok: false, reason: 'versão futura não suportada' }
  if (!obj.integrity || typeof obj.integrity.hashHex !== 'string') return { ok: false, reason: 'integridade ausente' }
  const integrityHash = obj.integrity.hashHex
  if (manifest) {
    if (!manifest.hash) return { ok: false, reason: 'manifesto sem hash' }
    if (manifest.hash !== integrityHash) return { ok: false, reason: 'manifest hash divergente' }
  }
  // Verificação detalhada (recomputar hash) via util existente
  const integrityRes = await verifyFullExportIntegrity(obj)
  if (!integrityRes.valid) return { ok: false, reason: integrityRes.reason || 'integridade inválida' }
  return { ok: true }
}

export async function listBackups(): Promise<{ name: string; updated_at: string; metadata: any }[]> {
  const cfg = getConfig()
  const base = cfg.url || envSupabaseUrl()
  const anon = cfg.anonKey || envSupabaseAnon()
  const bucket = cfg.bucket || 'backups'
  if (!base || !anon) return []
  try {
    const url = `${base}/storage/v1/object/list/${bucket}`
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        apikey: anon,
        Authorization: `Bearer ${anon}`,
        'content-type': 'application/json'
      },
      body: JSON.stringify({
        limit: 100,
        offset: 0,
        sortBy: { column: 'created_at', order: 'desc' },
        prefix: '' // Required by Supabase Storage API, empty string lists all
      })
    })
    if (!res.ok) {
      const txt = await res.text().catch(()=>'')
      throw new Error(`Erro ${res.status}: ${txt.slice(0,100)}`)
    }
    const data = await res.json()
    if (!Array.isArray(data)) return []
    
    // Filtra no cliente
    const files = data.filter((f: any) => f.name === 'latest.json' || f.name.startsWith('full-'))

    // Fallback: Se a lista estiver vazia, pode ser falta de permissão de LIST (RLS).
    // Tentamos verificar se 'latest.json' existe via acesso público (HEAD).
    if (files.length === 0) {
      try {
        const latestUrl = `${base}/storage/v1/object/public/${bucket}/latest.json`
        const check = await fetch(latestUrl, { method: 'HEAD' })
        if (check.ok) {
          const size = check.headers.get('Content-Length')
          const lastMod = check.headers.get('Last-Modified')
          // Adiciona item sintético
          files.push({
            name: 'latest.json',
            updated_at: lastMod || new Date().toISOString(),
            created_at: lastMod || new Date().toISOString(),
            metadata: { size: size ? parseInt(size) : 0 }
          })
        }
      } catch (e) {
        console.warn('Fallback check failed:', e)
      }
    }

    return files
  } catch (e) {
    console.error('List backups error:', e)
    throw e
  }
}

export async function restoreBackup(filename: string): Promise<{ ok: boolean; reason?: string; colorsImported?: number }> {
  const cfg = getConfig()
  const base = cfg.url || envSupabaseUrl()
  const anon = cfg.anonKey || envSupabaseAnon()
  const bucket = cfg.bucket || 'backups'
  if (!base || !anon) return { ok: false, reason: 'No config' }
  try {
    const url = `${base}/storage/v1/object/public/${bucket}/${filename}`
    const res = await fetch(url, { headers: { apikey: anon } })
    if (!res.ok) return { ok: false, reason: 'Download failed' }
    const json = await res.text()
    
    // Verify integrity if possible (manifest check skipped for specific files, but internal integrity check remains)
    const ver = await verifyDownloadedBackup(undefined, json)
    if (!ver.ok) return { ok: false, reason: ver.reason }
    
    const imported = await importBackupInWorker(json)
    if (!imported.ok) return { ok: false, reason: imported.error || 'Import failed' }
    
    setLastImportTimestamp(Date.now())
    return { ok: true, colorsImported: imported.inserted?.colors || 0 }
  } catch (e: any) {
    return { ok: false, reason: e.message || String(e) }
  }
}

