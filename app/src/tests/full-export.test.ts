import { describe, it, expect } from 'vitest'
import { makeFullExport, fullExportToJsonString } from '@/lib/export'
import type { Tissue } from '@/types/tissue'
import type { Color } from '@/types/color'
import type { TecidoCorView } from '@/types/tecidoCor'
import type { TecidoEstampaView } from '@/types/tecidoEstampa'

describe('Full export JSON (backup completo)', () => {
  it('Gera snapshot com tissues, colors, links e settings', async () => {
    const tissues: Tissue[] = [
      { id: 't1', name: 'Helanca', width: 160, composition: '96% poliéster 4% elastano', sku: 'T001', createdAt: '2025-01-01T00:00:00.000Z' },
    ]
    const colors: Color[] = [
      { id: 'c1', name: 'Azul Razai', sku: 'AZ001', createdAt: '2025-01-01T00:00:00.000Z' }, // sem hex/lab
      { id: 'c2', name: 'Amarelo Sol', hex: '#FFC400', sku: 'AM001', createdAt: '2025-01-02T00:00:00.000Z' },
    ]
    const links: TecidoCorView[] = [
      {
        id: 'l1', tissueId: 't1', colorId: 'c2', skuFilho: 'T001-AM001', status: 'Ativo', createdAt: '2025-01-03T00:00:00.000Z',
        tissueSku: 'T001', tissueName: 'Helanca', width: 160, composition: '96% poliéster 4% elastano',
        colorSku: 'AM001', colorName: 'Amarelo Sol', family: 'Amarelo', hex: '#FFC400', nomeCompleto: 'Helanca Amarelo Sol'
      }
    ]
    const patterns = [
      { id: 'p1', family: 'Jardim', name: 'Pink', sku: 'JA001', createdAt: '2025-01-04T00:00:00.000Z' }
    ]
    const patternLinks: TecidoEstampaView[] = [
      {
        id: 'pl1', tissueId: 't1', patternId: 'p1', skuFilho: 'T001-JA001', status: 'Ativo', createdAt: '2025-01-05T00:00:00.000Z',
        tissueSku: 'T001', tissueName: 'Helanca', width: 160, composition: '96% poliéster 4% elastano',
        patternSku: 'JA001', patternFamily: 'Jardim', patternName: 'Pink', nomeCompleto: 'Helanca Jardim Pink'
      }
    ]
  const payload = await makeFullExport({ tissues, colors, patterns, links, patternLinks, familyStats: [], settings: { deltaThreshold: 3.9, hueBoundaries: { vermelhoStart: 345, laranjaStart: 50, amareloStart: 70, verdeStart: 110, verdeEnd: 170, azulStart: 170, roxoStart: 295, magentaStart: 325 } } })
    const json = fullExportToJsonString(payload)
    const obj = JSON.parse(json)
    expect(obj.schema).toBe('razai-tools.full-export')
  expect(obj.version).toBe(4)
    expect(obj.counts.tissues).toBe(1)
    expect(obj.counts.colors).toBe(2)
  expect(obj.counts.patterns).toBe(1)
  expect(obj.counts.links).toBe(1)
  expect(obj.counts.patternLinks).toBe(1)
  expect(obj.counts.attachments).toBe(0)
    expect(Array.isArray(obj.tissues)).toBe(true)
    expect(Array.isArray(obj.colors)).toBe(true)
  expect(Array.isArray(obj.patterns)).toBe(true)
  expect(Array.isArray(obj.links)).toBe(true)
  expect(Array.isArray(obj.patternLinks)).toBe(true)
  expect(Array.isArray(obj.attachments)).toBe(true)
  expect(obj.integrity.hashHex).toMatch(/^[0-9a-f]{64}$/)
    // cor sem hex/lab está presente
    const azul = obj.colors.find((c: any) => c.id === 'c1')
    expect(azul).toBeTruthy()
    expect(azul.hex).toBeUndefined()
    const pattern = obj.patterns.find((p: any) => p.id === 'p1')
    expect(pattern).toBeTruthy()
    expect(pattern.family).toBe('Jardim')
    const pl = obj.patternLinks.find((x: any) => x.id === 'pl1')
    expect(pl).toBeTruthy()
    expect(pl.skuFilho).toBe('T001-JA001')
  })
})
