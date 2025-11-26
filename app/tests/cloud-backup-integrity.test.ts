import { describe, it, expect } from 'vitest'
import { makeFullExport } from '@/lib/export'
import { verifyDownloadedBackup } from '@/lib/cloud-sync'

function makeManifest(hash: string) {
  return { hash, updated_at: new Date().toISOString(), version: 4 }
}

describe('cloud backup integrity verification', () => {
  it('accepts valid backup (v4) when manifest hash matches integrity', async () => {
    const payload = await makeFullExport({ tissues: [], colors: [], patterns: [], links: [], patternLinks: [] })
    const jsonText = JSON.stringify(payload)
    const manifest = makeManifest(payload.integrity.hashHex)
    const res = await verifyDownloadedBackup(manifest, jsonText)
    expect(res.ok).toBe(true)
    expect(res.reason).toBeUndefined()
  })

  it('rejects when manifest hash mismatches integrity hash', async () => {
    const payload = await makeFullExport({ tissues: [], colors: [], patterns: [], links: [], patternLinks: [] })
    const jsonText = JSON.stringify(payload)
    const manifest = makeManifest('deadbeef'.padEnd(64, '0'))
    const res = await verifyDownloadedBackup(manifest, jsonText)
    expect(res.ok).toBe(false)
    expect(res.reason).toMatch(/manifest/i)
  })

  it('rejects when integrity hash field is stale (payload mutated)', async () => {
    const payload = await makeFullExport({ tissues: [], colors: [], patterns: [], links: [], patternLinks: [] })
    // Tamper: add fake tissue after hash computed
    const tampered: any = { ...payload, tissues: [{ id: 'x', name: 'Fake', width: 100, composition: '—', sku: 'FAKE', createdAt: new Date().toISOString() }] }
    const jsonText = JSON.stringify(tampered)
    const manifest = makeManifest(payload.integrity.hashHex) // still original hash
    const res = await verifyDownloadedBackup(manifest, jsonText)
    expect(res.ok).toBe(false)
    expect(res.reason).toMatch(/integridade|hash/i)
  })
})
