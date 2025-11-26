import { describe, it, expect } from 'vitest'
import { verifyDownloadedBackup } from '@/lib/cloud-sync'
import { makeFullExport } from '@/lib/export'

function json(payload: any): string { return JSON.stringify(payload) }

describe('Cloud backup integrity verification', () => {
  it('passes with matching manifest hash and valid integrity', async () => {
    const tissues: any[] = []
    const colors: any[] = [{ id: 'c1', name: 'Teste', hex: '#1122FF', sku: 'C001', createdAt: new Date().toISOString() }]
    const patterns: any[] = []
    const links: any[] = []
    const patternLinks: any[] = []
    const payload = await makeFullExport({ tissues, colors, patterns, links, patternLinks, familyStats: [], settings: {} })
    const manifest = { hash: payload.integrity.hashHex, updated_at: new Date().toISOString(), version: 4 }
    const res = await verifyDownloadedBackup(manifest, json(payload))
    expect(res.ok).toBe(true)
  })

  it('fails when manifest hash mismatches payload integrity hash', async () => {
    const payload = await makeFullExport({ tissues: [], colors: [], patterns: [], links: [], patternLinks: [], familyStats: [], settings: {} })
    const manifest = { hash: 'deadbeef', updated_at: new Date().toISOString(), version: 4 }
    const res = await verifyDownloadedBackup(manifest, json(payload))
    expect(res.ok).toBe(false)
    expect(res.reason).toMatch(/divergente/i)
  })

  it('fails when integrity hash recomputation is invalid (tampered payload)', async () => {
    const payload = await makeFullExport({ tissues: [], colors: [], patterns: [], links: [], patternLinks: [], familyStats: [], settings: {} })
    // Tamper: modify colors array after integrity computed
    payload.colors.push({ id: 'cx', name: 'Alterada', hex: '#000000', sku: 'X', createdAt: new Date().toISOString() })
    // Remove manifest so recompute path runs and detects invalid
    const res = await verifyDownloadedBackup(undefined, json(payload))
    expect(res.ok).toBe(false)
    // Depending on underlying integrity utility reason may be 'hash divergente' or 'integridade inválida'
    expect(res.reason).toMatch(/(hash divergente|integridade inválida)/i)
  })
})
