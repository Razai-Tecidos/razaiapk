import { describe, it, expect, beforeEach, vi } from 'vitest'
import { autoImportIfNeeded, bootstrapCloudImport, saveConfig } from '@/lib/cloud-sync'
import { db, colorsDb } from '@/lib/db'
import { makeFullExport } from '@/lib/export'

// Mock fetch globally
const originalFetch = global.fetch

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

describe('Cloud Auto Sync', () => {
  beforeEach(async () => {
    // Restore fetch
    global.fetch = originalFetch
    // Reset config
    saveConfig({})
    await db.init()
  })

  it('Does nothing when auto disabled', async () => {
    saveConfig({ url: 'https://example.invalid', anonKey: 'anon', auto: false })
    const res = await autoImportIfNeeded()
    expect(res.performed).toBe(false)
    expect(res.reason).toBe('auto disabled')
  })

  it('Imports when manifest newer', async () => {
    // Prepare local no data
    saveConfig({ url: 'https://example.invalid', anonKey: 'anon', auto: true })
    // Build a fake backup JSON
    const tissues: any[] = []
    const colors: any[] = [{ id:'c1', sku:'COR-001', name:'Azul Teste', family:'Azul', hex:'#0000FF', createdAt:new Date().toISOString(), updatedAt:new Date().toISOString() }]
    const patterns: any[] = []
    const links: any[] = []
    const patternLinks: any[] = []
    const payload = await makeFullExport({ tissues, colors, patterns, links, patternLinks, familyStats: [], settings: {} })
    const backupJson = JSON.stringify(payload)

    mockFetchSequence([
      // Manifest fetch
      { ok: true, body: [{ hash: payload.integrity.hashHex, updated_at: new Date(Date.now()+1000).toISOString(), version: 4 }] },
      // Download latest.json
      { ok: true, body: {}, textBody: backupJson }
    ])

    const res = await autoImportIfNeeded()
    expect(res.performed).toBe(true)
    const allColors = await colorsDb.listColors()
    expect(allColors.length).toBe(1)
    expect(allColors[0].name).toBe('Azul Teste')
  })

  it('Skips import when manifest not newer', async () => {
    saveConfig({ url: 'https://example.invalid', anonKey: 'anon', auto: true })
    // First perform an import to set last import TS
    const tissues: any[] = []
    const colors: any[] = [{ id:'cA', sku:'COR-A', name:'Cor A', family:'Azul', hex:'#0011FF', createdAt:new Date().toISOString(), updatedAt:new Date().toISOString() }]
    const patterns: any[] = []
    const links: any[] = []
    const patternLinks: any[] = []
    const payloadA = await makeFullExport({ tissues, colors, patterns, links, patternLinks, familyStats: [], settings: {} })
    const backupJsonA = JSON.stringify(payloadA)
    mockFetchSequence([
      // First call: manifest newer -> perform import
      { ok: true, body: [{ hash: payloadA.integrity.hashHex, updated_at: new Date(Date.now()+2000).toISOString(), version: 4 }] },
      { ok: true, body: {}, textBody: backupJsonA },
      // Second cycle: manifest not newer (same timestamp in past) -> should skip
      { ok: true, body: [{ hash: payloadA.integrity.hashHex, updated_at: new Date(Date.now()-1000).toISOString(), version: 4 }] }
    ])
    // First import
    const first = await autoImportIfNeeded()
    expect(first.performed).toBe(true)
    // Second attempt should skip
    const second = await autoImportIfNeeded()
    expect(second.performed).toBe(false)
    expect(second.reason).toMatch(/no newer backup/i)
  })

  it('Bootstrap import runs when DB empty even without prior manifest comparison', async () => {
    saveConfig({ url: 'https://example.invalid', anonKey: 'anon', auto: true })
    // Garantir banco realmente vazio (limpa cores + remove tecidos/padrões existentes de execuções anteriores)
    const existingTissues = await db.listTissues()
    for (const t of existingTissues) { await db.deleteTissue(t.id) }
    const existingPatterns = await (await import('@/lib/db')).patternsDb.listPatterns()
    for (const p of existingPatterns) { await (await import('@/lib/db')).patternsDb.deletePattern(p.id) }
    await colorsDb.clearAllColors()
    // Sanity: depois da limpeza listar novamente
    const tissuesAfter = await db.listTissues()
    const colorsAfter = await colorsDb.listColors()
    expect(tissuesAfter.length).toBe(0)
    expect(colorsAfter.length).toBe(0)
    const tissuesPayload: any[] = []
    const colorsPayload: any[] = [{ id:'cB', sku:'COR-B', name:'Cor B', family:'Azul', hex:'#1122FF', createdAt:new Date().toISOString(), updatedAt:new Date().toISOString() }]
    const patternsPayload: any[] = []
    const links: any[] = []
    const patternLinks: any[] = []
    const payloadB = await makeFullExport({ tissues: tissuesPayload, colors: colorsPayload, patterns: patternsPayload, links, patternLinks, familyStats: [], settings: {} })
    const backupJsonB = JSON.stringify(payloadB)
    mockFetchSequence([
      // For bootstrap we only need downloadLatestBackup to succeed
      { ok: true, body: {}, textBody: backupJsonB }
    ])
    const res = await bootstrapCloudImport()
    expect(res.performed).toBe(true)
    const allColors = await colorsDb.listColors()
    expect(allColors.find(c => c.name === 'Cor B')).toBeTruthy()
  })
})
