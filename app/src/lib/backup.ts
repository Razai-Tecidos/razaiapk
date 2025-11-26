import { db, colorsDb, patternsDb, linksDb, patternLinksDb, settingsDb, familyStatsDb } from '@/lib/db'
import { makeFullExport, type FullExport } from '@/lib/export'

export async function buildFullBackup(): Promise<FullExport> {
  await db.init()
  const [tissues, colors, patterns, currentLinks, currentPatternLinks, familyStats] = await Promise.all([
    db.listTissues(),
    colorsDb.listColors(),
    patternsDb.listPatterns(),
    linksDb.list(),
    patternLinksDb.list(),
    familyStatsDb.list(),
  ])
  let delta: number | undefined, hue: any | undefined
  try { delta = await settingsDb.getDeltaThreshold() } catch {}
  try { hue = await settingsDb.getHueBoundaries() } catch {}
  return makeFullExport({ tissues, colors, patterns, links: currentLinks, patternLinks: currentPatternLinks, familyStats, settings: { deltaThreshold: delta, hueBoundaries: hue } })
}

export async function buildFullBackupJson(): Promise<string> {
  const payload = await buildFullBackup()
  return JSON.stringify(payload)
}
