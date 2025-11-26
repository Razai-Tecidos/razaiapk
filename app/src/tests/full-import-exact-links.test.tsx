import { describe, it, expect, beforeEach } from 'vitest'
import { makeFullExport } from '@/lib/export'
import type { TecidoCorView } from '@/types/tecidoCor'
import type { TecidoEstampaView } from '@/types/tecidoEstampa'
import { db, colorsDb, patternsDb, linksDb, patternLinksDb } from '@/lib/db'
import { importFullBackupExact } from '@/lib/import'

// Tests that exact v4 import recreates links.

describe('Full export v4 exact import recreates links', () => {
  beforeEach(async () => { await db.init() })

  it('Imports tissues, colors, patterns and links/patternLinks', async () => {
    const tissues = [ { id:'t1', name:'Helanca', width:160, composition:'—', sku:'T001', createdAt:'2025-01-01T00:00:00.000Z' } ]
    const colors = [ { id:'c1', name:'Azul Razai', hex:'#2233ff', sku:'AZ001', createdAt:'2025-01-01T00:00:00.000Z' } ]
    const patterns = [ { id:'p1', family:'Jardim', name:'Flor', sku:'JA001', createdAt:'2025-01-01T00:00:00.000Z' } ]
    const links: TecidoCorView[] = [ {
      id:'l1', tissueId:'t1', colorId:'c1', skuFilho:'T001-AZ001', status:'Ativo', createdAt:'2025-01-02T00:00:00.000Z',
      tissueSku:'T001', tissueName:'Helanca', width:160, composition:'—',
      colorSku:'AZ001', colorName:'Azul Razai', family:'Azul', hex:'#2233ff', nomeCompleto:'Helanca Azul Razai'
    } ]
    const patternLinks: TecidoEstampaView[] = [ {
      id:'pl1', tissueId:'t1', patternId:'p1', skuFilho:'T001-JA001', status:'Ativo', createdAt:'2025-01-03T00:00:00.000Z',
      tissueSku:'T001', tissueName:'Helanca', width:160, composition:'—',
      patternSku:'JA001', patternFamily:'Jardim', patternName:'Flor', nomeCompleto:'Helanca Jardim Flor'
    } ]
    const payload = await makeFullExport({ tissues, colors, patterns, links, patternLinks, familyStats: [], settings: {} })
    const json = JSON.stringify(payload)
    const res = await importFullBackupExact(json)
    expect(res.inserted.tissues + res.updated.tissues).toBeGreaterThanOrEqual(1)
    expect(res.inserted.colors + res.updated.colors).toBeGreaterThanOrEqual(1)
    expect(res.inserted.patterns + res.updated.patterns).toBeGreaterThanOrEqual(1)
    expect(res.inserted.links + res.updated.links).toBeGreaterThanOrEqual(1)
    expect(res.inserted.patternLinks + res.updated.patternLinks).toBeGreaterThanOrEqual(1)
    const [tAfter, cAfter, pAfter, lAfter, plAfter] = await Promise.all([
      db.listTissues(), colorsDb.listColors(), patternsDb.listPatterns(), linksDb.list(), patternLinksDb.list()
    ])
    expect(tAfter.length).toBe(1)
    expect(cAfter.length).toBe(1)
    expect(pAfter.length).toBe(1)
    expect(lAfter.length).toBe(1)
    expect(plAfter.length).toBe(1)
  })
})
