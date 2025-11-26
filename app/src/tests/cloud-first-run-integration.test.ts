import { describe, it, expect, beforeEach, vi } from 'vitest'
import { ensureDefaultCloudConfig, bootstrapCloudImport, getConfig, getLastImportTimestamp } from '@/lib/cloud-sync'
import { db, colorsDb, db as tissuesDb } from '@/lib/db'
import { makeFullExport } from '@/lib/export'

// Helper to mock fetch responses sequentially
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

describe('Cloud Sync – first run bootstrap integration', () => {
  beforeEach(async () => {
    // Fresh DB state
    await db.init()
    // Purge any existing localStorage config keys
    localStorage.removeItem('cloud-sync-config')
    localStorage.removeItem('cloud-sync-last-import-ts')
  })

  it('imports backup on first run when DB is empty and sets last import timestamp', async () => {
    const seed = ensureDefaultCloudConfig({ url: 'https://cloud.invalid', anonKey: 'anon-key', auto: true })
    expect(seed.created).toBe(true)
    expect(getConfig().url).toBe('https://cloud.invalid')

    // Prepare remote backup payload with one tissue + one color
    const now = new Date().toISOString()
    const tissues = [{ id: 't1', name: 'Tecido Teste', width: 120, composition: 'Algodão', sku: 'T001', createdAt: now }]
    const colors = [{ id: 'c1', name: 'Azul Teste', hex: '#2244FF', sku: 'C001', createdAt: now }]
    const patterns: any[] = []
    const links: any[] = []
    const patternLinks: any[] = []
    const payload = await makeFullExport({ tissues, colors, patterns, links, patternLinks, familyStats: [], settings: {} })
    const backupJson = JSON.stringify(payload)

    // First fetch: downloadLatestBackup()
    mockFetchSequence([
      { ok: true, body: {}, textBody: backupJson }
    ])

    const first = await bootstrapCloudImport()
    expect(first.performed).toBe(true)
    const importedColors = await colorsDb.listColors()
    expect(importedColors.find(c => c.name === 'Azul Teste')).toBeTruthy()
    const tsAfter = getLastImportTimestamp()
    expect(tsAfter).toBeGreaterThan(0)

    // Second call: DB no longer empty → falls back to autoImportIfNeeded and should not re-import (no newer manifest)
    const manifestUpdatedAt = new Date(tsAfter - 1000).toISOString() // older than last import
    mockFetchSequence([
      { ok: true, body: [{ updated_at: manifestUpdatedAt, hash: 'h', version: 4, size_bytes: backupJson.length }] }
    ])
    const second = await bootstrapCloudImport()
    expect(second.performed).toBe(false)
  })
})
