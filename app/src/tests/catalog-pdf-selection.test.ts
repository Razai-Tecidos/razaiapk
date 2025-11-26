import { describe, it, expect } from 'vitest'
import { generateCatalogPdf } from '@/lib/pdf/catalog-pdf'
import type { CatalogItem } from '@/types/catalog'

describe('Catalog PDF - seleção de subconjunto', () => {
  function makeItems(): CatalogItem[] {
    return [
      {
        tissueId: 1,
        tissueName: 'Tecido Alpha',
        tissueSku: 'T001',
        composition: '100% Algodão',
        width: 150,
        colors: [
          { colorId: 11, colorName: 'Amarelo Sol', colorSku: 'AM001', hex: '#FFC400', family: 'Amarelo', skuFilho: 'T001-AM001', status: 'Ativo', createdAt: new Date().toISOString(), imageThumb: undefined },
          { colorId: 12, colorName: 'Verde Floresta', colorSku: 'VE001', hex: '#228B22', family: 'Verde', skuFilho: 'T001-VE001', status: 'Ativo', createdAt: new Date().toISOString(), imageThumb: undefined },
        ],
        patterns: [
          { patternId: 101, patternName: 'Folhas Tropicais', patternSku: 'FT001', family: 'Folhas', skuFilho: 'T001-FT001', status: 'Ativo', createdAt: new Date().toISOString(), imageThumb: undefined },
        ],
      },
      {
        tissueId: 2,
        tissueName: 'Tecido Beta',
        tissueSku: 'T002',
        composition: '50% Algodão 50% Poli',
        width: 140,
        colors: [
          { colorId: 21, colorName: 'Vermelho Fogo', colorSku: 'VE002', hex: '#D40000', family: 'Vermelho', skuFilho: 'T002-VE002', status: 'Ativo', createdAt: new Date().toISOString(), imageThumb: undefined },
        ],
        patterns: [
          { patternId: 201, patternName: 'Geométrico Azul', patternSku: 'GA001', family: 'Geométrico', skuFilho: 'T002-GA001', status: 'Ativo', createdAt: new Date().toISOString(), imageThumb: undefined },
          { patternId: 202, patternName: 'Geométrico Cinza', patternSku: 'GC002', family: 'Geométrico', skuFilho: 'T002-GC002', status: 'Ativo', createdAt: new Date().toISOString(), imageThumb: undefined },
        ],
      },
    ]
  }

  it('Gera PDF com todos os itens e soma correta de cores/padrões', async () => {
    const items = makeItems()
    const res = await generateCatalogPdf({ items, config: { title: 'Teste', includeCover: true, brandName: 'RAZAI', showFooterPageNumbers: true, showFooterBrand: true } })
    expect(res.metadata).toBeDefined()
    expect(res.metadata!.itemCount).toBe(2)
    expect(res.metadata!.colorsTotal).toBe(3) // 2 + 1
    expect(res.metadata!.patternsTotal).toBe(3) // 1 + 2
    expect(res.fileName).toMatch(/Teste/i)
    expect(res.blob).toBeInstanceOf(Blob)
  })

  it('Gera PDF somente com subconjunto (1 tecido) e metadados refletem a seleção', async () => {
    const items = makeItems()
    const subset = [items[0]]
    const res = await generateCatalogPdf({ items: subset, config: { title: 'Subset', includeCover: false } })
    expect(res.metadata).toBeDefined()
    expect(res.metadata!.itemCount).toBe(1)
    expect(res.metadata!.colorsTotal).toBe(2)
    expect(res.metadata!.patternsTotal).toBe(1)
    expect(res.fileName).toMatch(/Subset/i)
  })
})
