import { describe, it, expect } from 'vitest'
import { makeFullExport, fullExportToJsonString } from '@/lib/export'

describe('Backup completo sem vínculos', () => {
  it('Gera JSON com arrays vazios de links quando não existem vínculos', async () => {
    const payload = await makeFullExport({
      tissues: [ { id:'t1', name:'Helanca', width:160, composition:'—', sku:'T001', createdAt:'2025-01-01T00:00:00.000Z' } ],
      colors: [ { id:'c1', name:'Azul Razai', sku:'AZ001', createdAt:'2025-01-01T00:00:00.000Z' } ],
      patterns: [ { id:'p1', family:'Jardim', name:'Pink', sku:'JA001', createdAt:'2025-01-02T00:00:00.000Z' } ],
      links: [],
      patternLinks: [],
      familyStats: [],
      settings: { deltaThreshold: 3.9 }
    })
    const json = fullExportToJsonString(payload)
    const obj = JSON.parse(json)
    expect(obj.schema).toBe('razai-tools.full-export')
    expect(obj.version).toBe(4)
    expect(obj.counts.links).toBe(0)
    expect(obj.counts.patternLinks).toBe(0)
    expect(obj.counts.attachments).toBe(0)
    expect(Array.isArray(obj.links)).toBe(true)
    expect(Array.isArray(obj.patternLinks)).toBe(true)
    expect(obj.links.length).toBe(0)
    expect(obj.patternLinks.length).toBe(0)
    expect(Array.isArray(obj.attachments)).toBe(true)
    expect(obj.integrity.hashHex).toMatch(/^[0-9a-f]{64}$/)
  })
})
