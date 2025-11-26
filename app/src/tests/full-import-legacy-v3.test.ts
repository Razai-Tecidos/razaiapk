import { describe, it, expect, beforeEach } from 'vitest'
import { db, colorsDb, patternsDb } from '@/lib/db'
import { importFullBackupExact } from '@/lib/import'

// Ensures legacy v3 backup (without attachments/integrity) still imports (with issues reported).

describe('Legacy v3 full export import via exact importer', () => {
  beforeEach(async () => { await db.init() })

  it('Imports v3 backup and reports issues', async () => {
    const backupV3 = {
      schema: 'razai-tools.full-export',
      version: 3,
      generatedAt: new Date().toISOString(),
      counts: { tissues:1, colors:1, patterns:0, links:0, patternLinks:0 },
      tissues: [ { id:'t1', name:'Helanca', width:160, composition:'—', sku:'T001', createdAt:'2025-01-01T00:00:00.000Z' } ],
      colors: [ { id:'c1', name:'Azul', sku:'AZ001', createdAt:'2025-01-01T00:00:00.000Z' } ],
      patterns: [],
      links: [],
      patternLinks: [],
      settings: { deltaThreshold: 3.9 }
    }
    const json = JSON.stringify(backupV3)
    const res = await importFullBackupExact(json)
    expect(res.inserted.tissues + res.updated.tissues).toBeGreaterThanOrEqual(1)
    expect(res.inserted.colors + res.updated.colors).toBeGreaterThanOrEqual(1)
    expect(res.issues.length).toBeGreaterThan(0) // should report version + attachments/integrity issues
    const [tAfter, cAfter] = await Promise.all([ db.listTissues(), colorsDb.listColors() ])
    expect(tAfter.length).toBeGreaterThanOrEqual(1)
    expect(cAfter.length).toBeGreaterThanOrEqual(1)
  })
})
