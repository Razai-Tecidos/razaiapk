import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { ensureDefaultCloudConfig, getConfig, saveConfig, bootstrapCloudImport } from '@/lib/cloud-sync'
import { db, colorsDb } from '@/lib/db'
import { makeFullExport } from '@/lib/export'

// Preserve original fetch
const originalFetch = global.fetch
// Preserve original env snapshot (Vitest relies on some internal vars inside import.meta.env)
const originalEnv = { ...(import.meta as any).env }

function mockFetchSequence(sequence: Array<{ ok: boolean; status?: number; body?: any; textBody?: string }>) {
  let i = 0
  global.fetch = vi.fn(async () => {
    const current = sequence[Math.min(i, sequence.length - 1)]
    i++
    return {
      ok: current.ok,
      status: current.status || (current.ok ? 200 : 500),
      json: async () => current.body,
      text: async () => (current.textBody || JSON.stringify(current.body))
    } as any
  })
}

describe('ensureDefaultCloudConfig', () => {
  // No longer mutating import.meta.env directly; using overrides param.

  beforeEach(async () => {
    saveConfig({})
    global.fetch = originalFetch
    await db.init()
  })

  afterEach(() => {
    global.fetch = originalFetch
  })

  it('seeds config from env on first run with auto=true default', () => {
    const r = ensureDefaultCloudConfig({ url: 'https://example.invalid', anonKey: 'anon-key' })
    expect(r.created).toBe(true)
    const cfg = getConfig()
    expect(cfg.url).toBe('https://example.invalid')
    expect(cfg.anonKey).toBe('anon-key')
    expect(cfg.auto).toBe(true)
    expect(cfg.bucket).toBe('backups')
  })

  it('respects auto disabled override', () => {
    const r = ensureDefaultCloudConfig({ url: 'https://ex2.invalid', anonKey: 'anon2', auto: false })
    expect(r.created).toBe(true)
    const cfg = getConfig()
    expect(cfg.auto).toBe(false)
  })

  it('does NOT override existing manual config', () => {
    saveConfig({ url: 'https://manual.invalid', anonKey: 'manual', auto: false })
    const r = ensureDefaultCloudConfig({ url: 'https://new.invalid', anonKey: 'anon-new' })
    expect(r.created).toBe(false)
    const cfg = getConfig()
    expect(cfg.url).toBe('https://manual.invalid')
    expect(cfg.auto).toBe(false)
  })

  it('bootstrapCloudImport uses seeded override config when DB empty', async () => {
    const seedResult = ensureDefaultCloudConfig({ url: 'https://bootstrap.invalid', anonKey: 'anonB' })
    expect(seedResult.created).toBe(true)
    // Build minimal backup JSON with one color
    const tissues: any[] = []
    const colors: any[] = [{ id:'cSeed', sku:'COR-SEED', name:'Seed Color', family:'Azul', hex:'#2244FF', createdAt:new Date().toISOString(), updatedAt:new Date().toISOString() }]
    const patterns: any[] = []
    const links: any[] = []
    const patternLinks: any[] = []
    const payload = await makeFullExport({ tissues, colors, patterns, links, patternLinks, familyStats: [], settings: {} })
    const backupJson = JSON.stringify(payload)
    mockFetchSequence([
      { ok: true, body: {}, textBody: backupJson }
    ])
    const res = await bootstrapCloudImport()
    expect(res.performed).toBe(true)
    const allColors = await colorsDb.listColors()
    expect(allColors.find(c => c.name === 'Seed Color')).toBeTruthy()
  })
})
