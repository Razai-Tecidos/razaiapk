import { describe, it, expect } from 'vitest'
import { makeFullExport } from '@/lib/export'
import type { Tissue } from '@/types/tissue'
import type { Color } from '@/types/color'
import type { TecidoCorView } from '@/types/tecidoCor'

// Minimal test verifying attachments + integrity hash generation when images present.

describe('Full export v4 attachments & integrity', () => {
  it('Generates attachment for link with image data URL', async () => {
    const tissues: Tissue[] = [ { id:'t1', name:'Helanca', width:160, composition:'—', sku:'T001', createdAt:'2025-01-01T00:00:00.000Z' } ]
    const colors: Color[] = [ { id:'c1', name:'Cor Rosa', hex:'#ff00aa', sku:'RO001', createdAt:'2025-01-01T00:00:00.000Z' } ]
    const dummyDataUrl = 'data:image/png;base64,' + btoa('fakebinary')
    const links: TecidoCorView[] = [ {
      id:'l1', tissueId:'t1', colorId:'c1', skuFilho:'T001-RO001', status:'Ativo', createdAt:'2025-01-02T00:00:00.000Z',
      tissueSku:'T001', tissueName:'Helanca', width:160, composition:'—',
      colorSku:'RO001', colorName:'Cor Rosa', family:'Rosa', hex:'#ff00aa', nomeCompleto:'Helanca Cor Rosa',
      image: dummyDataUrl, imageHash:'hash1', imageMime:'image/png', imageThumb: dummyDataUrl
    } ]
    const payload = await makeFullExport({ tissues, colors, patterns: [], links, patternLinks: [], familyStats: [], settings: {} })
    expect(payload.version).toBe(4)
    expect(payload.counts.attachments).toBe(1)
    expect(payload.attachments[0].hash).toBe('hash1')
    expect(payload.attachments[0].data).toContain('data:image/png;base64')
    expect(payload.integrity.hashHex).toMatch(/^[0-9a-f]{64}$/)
  })
})
