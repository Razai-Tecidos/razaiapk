import type { TecidoCorView } from '@/types/tecidoCor'
import type { TecidoEstampaView } from '@/types/tecidoEstampa'
import type { Tissue } from '@/types/tissue'
import type { Color } from '@/types/color'
import type { HueBoundaries } from '@/lib/color-utils'
import type { Pattern } from '@/types/pattern'
import type { FamilyStat } from '@/lib/db'

// Hashing utility (local lightweight) – we inline to avoid extra import churn.
async function sha256Hex(text: string): Promise<string> {
  // Browser / Tauri (WebCrypto)
  if (typeof crypto !== 'undefined' && crypto.subtle) {
    try {
      const enc = new TextEncoder().encode(text)
      const digest = await crypto.subtle.digest('SHA-256', enc)
      return Array.from(new Uint8Array(digest)).map(b=>b.toString(16).padStart(2,'0')).join('')
    } catch {/* fallthrough */}
  }
  // Node fallback (vitest environment)
  try {
    // dynamic require to avoid bundler warnings
    const nodeCrypto = await (new Function('return require("crypto")'))()
    return nodeCrypto.createHash('sha256').update(text).digest('hex')
  } catch {
    // Very weak fallback – NOT cryptographically strong, but ensures deterministic string
    let h = 0
    for (let i=0;i<text.length;i++) h = (h*33 + text.charCodeAt(i)) >>> 0
    return h.toString(16).padStart(8,'0').padEnd(64,'0')
  }
}

// Stable stringify to ensure deterministic hash irrespective of key insertion order.
// NOTE: We intentionally skip undefined-valued object keys because JSON persistence
// drops them. Earlier versions (legacy) accidentally hashed the raw object including
// "undefined" textual placeholders. We keep a legacy fallback in verification.
function stableStringify(v: any): string {
  if (v === null || typeof v !== 'object') return JSON.stringify(v)
  if (Array.isArray(v)) return '[' + v.map(stableStringify).join(',') + ']'
  const keys = Object.keys(v).sort()
  const parts: string[] = []
  for (const k of keys) {
    const val = v[k]
    if (typeof val === 'undefined') continue // skip undefined to mirror JSON
    parts.push(JSON.stringify(k) + ':' + stableStringify(val))
  }
  return '{' + parts.join(',') + '}'
}

// Deep sanitize: remove all undefined values (recursively) so hashing matches persisted JSON.
function sanitizeForHash<T>(input: T): T {
  if (input === null) return input
  if (Array.isArray(input)) {
    return input.map(item => sanitizeForHash(item)) as unknown as T
  }
  if (typeof input === 'object') {
    const out: any = {}
    for (const k of Object.keys(input as any)) {
      const val = (input as any)[k]
      if (typeof val === 'undefined') continue
      out[k] = sanitizeForHash(val)
    }
    return out
  }
  return input
}

// Removido: exportação isolada de vínculos (JSON/CSV). Agora apenas backup completo.

// Full backup export v4 (all entities + optional settings + attachments + integrity hash)
// Previous versions:
// v1: tissues/colors + links (color) only
// v2: + settings
// v3: + patterns + patternLinks
// v4: + attachments (images) + integrity hash + future-proof fields
export type FullExport = {
  schema: 'razai-tools.full-export'
  version: 4
  generatedAt: string
  counts: { tissues: number; colors: number; patterns: number; links: number; patternLinks: number; attachments: number; familyStats: number }
  tissues: Tissue[]
  colors: Color[]
  patterns: Pattern[]
  links: TecidoCorView[]
  patternLinks: TecidoEstampaView[]
  familyStats: FamilyStat[]
  // Embedded image attachments (unique by hash). "data" is a data URL or base64 payload.
  attachments: Array<{ hash: string; mime?: string; size?: number; data?: string; thumb?: string }>
  integrity: { hashAlgorithm: 'SHA-256'; hashHex: string }
  settings?: {
    deltaThreshold?: number
    hueBoundaries?: HueBoundaries
  }
}

export async function makeFullExport(params: {
  tissues: Tissue[]
  colors: Color[]
  patterns: Pattern[]
  links: TecidoCorView[]
  patternLinks: TecidoEstampaView[]
  familyStats: FamilyStat[]
  settings?: { deltaThreshold?: number; hueBoundaries?: HueBoundaries }
}): Promise<FullExport> {
  // Build attachments: gather unique image hashes or inline images.
  const attachMap = new Map<string, { hash: string; mime?: string; size?: number; data?: string; thumb?: string }>()
  async function collectFrom(link: any) {
    const { image, imagePath, imageMime, imageHash, imageThumb } = link || {}
    const hash = imageHash || (imagePath ? imagePath : undefined)
    if (!hash) return
    if (attachMap.has(hash)) return
    let data: string | undefined
    let size: number | undefined
    // Prefer legacy data URL already stored
    if (typeof image === 'string' && image.startsWith('data:')) {
      data = image
      size = image.length
    } else if (imagePath) {
      // Attempt to read file (Tauri) and convert to data URL.
      try {
        const w: any = typeof window !== 'undefined' ? window : {}
        if (w.__TAURI__ || w.__TAURI_INTERNALS__) {
          const fs: any = await (new Function('return import("@tauri-apps/plugin-fs")'))()
          const pathMod: any = await (new Function('return import("@tauri-apps/api/path")'))()
          const appDir = await pathMod.appDataDir()
          const full = await pathMod.join(appDir, imagePath)
          const bin = await fs.readBinaryFile(full)
          size = bin.length
          const mime = imageMime || 'application/octet-stream'
          const b64 = btoa(String.fromCharCode(...bin))
          data = `data:${mime};base64,${b64}`
        }
      } catch {
        // ignore file read failure – remain undefined
      }
    }
    attachMap.set(hash, { hash, mime: imageMime, size, data, thumb: imageThumb })
  }
  for (const l of params.links) await collectFrom(l)
  for (const l of params.patternLinks) await collectFrom(l)
  const attachments = Array.from(attachMap.values()).sort((a,b)=>a.hash.localeCompare(b.hash))
  const base: Omit<FullExport, 'integrity'> = {
    schema: 'razai-tools.full-export',
    version: 4,
    generatedAt: new Date().toISOString(),
    counts: {
      tissues: params.tissues.length,
      colors: params.colors.length,
      patterns: params.patterns.length,
      links: params.links.length,
      patternLinks: params.patternLinks.length,
      attachments: attachments.length,
      familyStats: params.familyStats.length,
    },
    tissues: params.tissues,
    colors: params.colors,
    patterns: params.patterns,
    links: params.links,
    patternLinks: params.patternLinks,
    familyStats: params.familyStats,
    attachments,
    settings: params.settings,
  }
  // Sanitize base before hashing so undefined properties (removed in JSON) do not break integrity check.
  const sanitized = sanitizeForHash(base)
  const hashHex = await sha256Hex(stableStringify(sanitized))
  return { ...base, integrity: { hashAlgorithm: 'SHA-256', hashHex } }
}

export function fullExportToJsonString(payload: FullExport): string {
  return JSON.stringify(payload, null, 2)
}

export function fullExportToJsonBlob(payload: FullExport): Blob {
  return new Blob([fullExportToJsonString(payload)], { type: 'application/json' })
}

// Basic validator (non-throwing) – returns list of issues for UI/dry-run.
export function validateFullExportObject(obj: any): string[] {
  const issues: string[] = []
  if (!obj || obj.schema !== 'razai-tools.full-export') issues.push('schema inválido ou ausente')
  if (obj.version !== 4) issues.push(`versão esperada 4, encontrada ${obj.version}`)
  if (!Array.isArray(obj.tissues)) issues.push('tissues ausente ou não-array')
  if (!Array.isArray(obj.colors)) issues.push('colors ausente ou não-array')
  if (!Array.isArray(obj.patterns)) issues.push('patterns ausente ou não-array')
  if (!Array.isArray(obj.links)) issues.push('links ausente ou não-array')
  if (!Array.isArray(obj.patternLinks)) issues.push('patternLinks ausente ou não-array')
  if (!Array.isArray(obj.attachments)) issues.push('attachments ausente ou não-array')
  if (!obj.integrity || typeof obj.integrity.hashHex !== 'string') issues.push('integrity.hashHex ausente')
  // Integrity recompute intentionally omitted (async) – handled by dedicated async verifier elsewhere if needed.
  return issues
}

// Async integrity verifier – recomputa hash de forma estável e compara com integrity.hashHex.
// Retorna objeto com resultado e valores (útil para UI badge ou testes adicionais).
export async function verifyFullExportIntegrity(payload: any): Promise<{
  valid: boolean
  expected?: string
  actual?: string
  algorithm?: string
  reason?: string
}> {
  if (!payload || payload.schema !== 'razai-tools.full-export') return { valid: false, reason: 'schema inválido' }
  if (payload.version !== 4) return { valid: false, reason: `versão não suportada (${payload.version})` }
  if (!payload.integrity || typeof payload.integrity.hashHex !== 'string') return { valid: false, reason: 'integrity ausente' }
  const expected = payload.integrity.hashHex
  const { integrity, ...rest } = payload
  // Strategy: compute new sanitized hash (post-fix) and legacy hash (pre-fix) for backward compatibility.
  const sanitized = sanitizeForHash(rest)
  const actualSanitized = await sha256Hex(stableStringify(sanitized))
  if (actualSanitized === expected) {
    return { valid: true, expected, actual: actualSanitized, algorithm: 'SHA-256' }
  }
  // Legacy fallback: previous method hashed raw object including undefined placeholders.
  const legacyActual = await sha256Hex(stableStringify(rest))
  if (legacyActual === expected) {
    return { valid: true, expected, actual: legacyActual, algorithm: 'SHA-256', reason: 'modo legado' }
  }
  return { valid: false, expected, actual: actualSanitized, algorithm: 'SHA-256', reason: 'hash divergente' }
}
