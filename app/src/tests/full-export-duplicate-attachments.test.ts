import { describe, it, expect } from 'vitest'
import { makeFullExport } from '@/lib/export'
import type { TecidoCorView } from '@/types/tecidoCor'

describe('Full export v4 deduplicates attachments by hash', () => {
  it('Two links with same imageHash produce one attachment', async () => {
    const tissues = [ { id:'t1', name:'Helanca', width:160, composition:'—', sku:'T001', createdAt:'2025-01-01T00:00:00.000Z' } ]
    const colors = [
      { id:'c1', name:'Cor A', hex:'#111111', sku:'CA001', createdAt:'2025-01-01T00:00:00.000Z' },
      { id:'c2', name:'Cor B', hex:'#222222', sku:'CB001', createdAt:'2025-01-01T00:00:00.000Z' }
    ]
    const dataUrl = 'data:image/png;base64,' + btoa('same')
    const links: TecidoCorView[] = [
      { id:'l1', tissueId:'t1', colorId:'c1', skuFilho:'T001-CA001', status:'Ativo', createdAt:'2025-01-02T00:00:00.000Z', tissueSku:'T001', tissueName:'Helanca', width:160, composition:'—', colorSku:'CA001', colorName:'Cor A', family:'Cinza', hex:'#111111', nomeCompleto:'Helanca Cor A', image:dataUrl, imageHash:'dupHash', imageMime:'image/png', imageThumb:dataUrl },
      { id:'l2', tissueId:'t1', colorId:'c2', skuFilho:'T001-CB001', status:'Ativo', createdAt:'2025-01-03T00:00:00.000Z', tissueSku:'T001', tissueName:'Helanca', width:160, composition:'—', colorSku:'CB001', colorName:'Cor B', family:'Cinza', hex:'#222222', nomeCompleto:'Helanca Cor B', image:dataUrl, imageHash:'dupHash', imageMime:'image/png', imageThumb:dataUrl }
    ]
    const payload = await makeFullExport({ tissues, colors, patterns: [], links, patternLinks: [], familyStats: [], settings:{} })
    expect(payload.counts.attachments).toBe(1)
    expect(payload.attachments[0].hash).toBe('dupHash')
  })
})
