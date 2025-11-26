import { describe, it, expect, beforeEach } from 'vitest'
import { db, colorsDb, patternsDb, linksDb, patternLinksDb } from '@/lib/db'
import { buildFullBackupJson } from '@/lib/backup'
import { importFullBackupExact } from '@/lib/import'

// Helper to clear DB (since we don't have a global clear)
async function clearDb() {
  // Delete links first because list() filters out broken refs
  const links = await linksDb.list()
  for (const l of links) await linksDb.delete(l.id)
  
  const pLinks = await patternLinksDb.list()
  for (const l of pLinks) await patternLinksDb.delete(l.id)

  const tissues = await db.listTissues()
  for (const t of tissues) await db.deleteTissue(t.id)
  
  const colors = await colorsDb.listColors()
  for (const c of colors) await colorsDb.deleteColor(c.id)
  
  const patterns = await patternsDb.listPatterns()
  for (const p of patterns) await patternsDb.deletePattern(p.id)
}

describe('Backup & Restore Flow', () => {
  beforeEach(async () => {
    await db.init()
    await clearDb()
  })

  it('should backup and restore data correctly', async () => {
    // 1. Create initial data
    await db.createTissue({ name: 'Test Tissue', width: 150, composition: 'Cotton' })
    const tissues = await db.listTissues()
    const tissue = tissues[0]
    expect(tissue).toBeDefined()

    await colorsDb.createColor({ name: 'Test Color', hex: '#FF0000', labL: 50, labA: 50, labB: 50 })
    const colors = await colorsDb.listColors()
    const color = colors[0]
    expect(color).toBeDefined()

    await patternsDb.createPattern({ family: 'Test Family', name: 'Test Pattern' })
    const patterns = await patternsDb.listPatterns()
    const pattern = patterns[0]
    expect(pattern).toBeDefined()

    // Create links
    await linksDb.createMany(tissue.id, [color.id])
    const links = await linksDb.list()
    expect(links.length).toBe(1)

    await patternLinksDb.createMany(tissue.id, [pattern.id])
    const pLinks = await patternLinksDb.list()
    expect(pLinks.length).toBe(1)

    // 2. Generate Backup JSON
    const json = await buildFullBackupJson()
    expect(json).toBeTruthy()
    const parsed = JSON.parse(json)
    expect(parsed.tissues.length).toBe(1)
    expect(parsed.colors.length).toBe(1)
    expect(parsed.patterns.length).toBe(1)
    expect(parsed.links.length).toBe(1)
    expect(parsed.patternLinks.length).toBe(1)

    // 3. Clear DB
    await clearDb()
    expect((await db.listTissues()).length).toBe(0)
    expect((await colorsDb.listColors()).length).toBe(0)

    // 4. Restore from JSON
    const result = await importFullBackupExact(json)
    expect(result.issues.length).toBe(0)
    expect(result.inserted.tissues).toBe(1)
    expect(result.inserted.colors).toBe(1)
    expect(result.inserted.patterns).toBe(1)
    expect(result.inserted.links).toBe(1)
    expect(result.inserted.patternLinks).toBe(1)

    // 5. Verify Data
    const restoredTissues = await db.listTissues()
    expect(restoredTissues.length).toBe(1)
    expect(restoredTissues[0].name).toBe('Test Tissue')
    expect(restoredTissues[0].sku).toBe(tissue.sku) // Should preserve SKU

    const restoredColors = await colorsDb.listColors()
    expect(restoredColors.length).toBe(1)
    expect(restoredColors[0].name).toBe('Test Color')
    expect(restoredColors[0].sku).toBe(color.sku)

    const restoredLinks = await linksDb.list()
    expect(restoredLinks.length).toBe(1)
    expect(restoredLinks[0].tissueId).toBe(tissue.id) // IDs should be preserved if possible, or mapped. 
    // Note: importFullBackupExact uses syncDb.importAll which uses create*Raw or update*Raw.
    // If IDs are in the JSON (they are), they should be preserved.
    expect(restoredLinks[0].colorId).toBe(color.id)
  })
})
