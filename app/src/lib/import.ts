import type { Tissue } from '@/types/tissue'
import type { Color, ColorInput } from '@/types/color'
import type { PatternInput } from '@/types/pattern'
import type { FullExport } from '@/lib/export'
import { validateFullExportObject } from '@/lib/export'
import { syncDb } from '@/lib/db'

export type ImportDeps = {
  listTissues: () => Promise<Tissue[]>
  listColors: () => Promise<Color[]>
  createTissue: (input: { name: string; width: number; composition: string }) => Promise<Tissue | void>
  createColor: (input: ColorInput) => Promise<Color | void>
  createManyLinks: (tissueId: string, colorIds: string[]) => Promise<{ created: number; duplicates: number }>
}

export function splitCsvLine(line: string, delim: ','|';'): string[] {
  const res: string[] = []
  let cur = ''
  let q = false
  for (let i=0;i<line.length;i++) {
    const ch = line[i]
    if (q) {
      if (ch === '"') {
        if (line[i+1] === '"') { cur += '"'; i++ } else { q = false }
      } else cur += ch
    } else {
      if (ch === '"') q = true
      else if (ch === delim) { res.push(cur); cur = '' }
      else cur += ch
    }
  }
  res.push(cur)
  return res
}

export function parseCsv(text: string, delim: ','|';'): Array<Record<string,string>> {
  const lines = text.replace(/\r\n/g,'\n').replace(/\r/g,'\n').split('\n').filter(Boolean)
  if (lines.length === 0) return []
  const header = splitCsvLine(lines[0], delim)
  const out: Array<Record<string,string>> = []
  for (let i=1;i<lines.length;i++) {
    const cols = splitCsvLine(lines[i], delim)
    const row: Record<string,string> = {}
    for (let j=0;j<header.length;j++) row[header[j]] = cols[j] ?? ''
    out.push(row)
  }
  return out
}

export async function readItemsFromContent(fileName: string, text: string, delimiter: ','|';'): Promise<any[]> {
  if (fileName.toLowerCase().endsWith('.json')) {
    const obj = JSON.parse(text)
    return Array.isArray(obj) ? obj : (Array.isArray(obj.items) ? obj.items : [])
  }
  if (fileName.toLowerCase().endsWith('.csv')) {
    return parseCsv(text, delimiter)
  }
  throw new Error('Formato não suportado. Use JSON ou CSV.')
}

function field<T = string>(obj: any, keys: string[]): T | undefined {
  for (const k of keys) {
    if (obj[k] != null) return obj[k] as T
  }
  return undefined
}

export async function importItems(items: any[], deps: ImportDeps): Promise<{ createdT: number; createdC: number; createdL: number; duplicates: number }>{
  const [allTissues, allColors] = await Promise.all([deps.listTissues(), deps.listColors()])
  const tBySku = new Map(allTissues.map(t => [t.sku, t]))
  const tByName = new Map(allTissues.map(t => [t.name.trim().toLowerCase(), t]))
  const cBySku = new Map(allColors.map(c => [c.sku, c]))
  const cByName = new Map(allColors.map(c => [c.name.trim().toLowerCase(), c]))

  let createdT = 0, createdC = 0, createdL = 0, duplicates = 0
  const perTissue = new Map<string, Set<string>>()

  for (const it of items) {
    const tissueSku = field<string>(it, ['tissueSku','tecido_sku','SKU_TECIDO'])
    const tissueName = field<string>(it, ['tissueName','tecido_nome','TECIDo_NOME','Tecido','tecido'])
    const width = Number(field<string|number>(it, ['width','largura'])) || 0
    const composition = field<string>(it, ['composition','composicao']) || ''

    const colorSku = field<string>(it, ['colorSku','cor_sku','COR_SKU'])
    const colorName = field<string>(it, ['colorName','cor_nome','Cor','cor'])
    const hex = field<string>(it, ['hex']) || ''

    // tissue
    let t: Tissue | undefined = undefined
    if (tissueSku && tBySku.has(tissueSku)) t = tBySku.get(tissueSku)
    else if (tissueName && tByName.has(String(tissueName).trim().toLowerCase())) t = tByName.get(String(tissueName).trim().toLowerCase())
    else if (tissueName) {
      const maybe = await deps.createTissue({ name: tissueName, width: width>0? width: 160, composition: composition || '—' })
      let created: Tissue | undefined = maybe as Tissue | undefined
      if (!created) {
        const latest = await deps.listTissues()
        created = latest[0]
      }
      if (created) {
        t = created
        tBySku.set(created.sku, created)
        tByName.set(created.name.trim().toLowerCase(), created)
        createdT++
      }
    }
    if (!t) continue

    // color
    let c: Color | undefined = undefined
    if (colorSku && cBySku.has(colorSku)) c = cBySku.get(colorSku)
    else if (colorName && cByName.has(String(colorName).trim().toLowerCase())) c = cByName.get(String(colorName).trim().toLowerCase())
    else if (colorName) {
      const payload: ColorInput = { name: colorName, hex: hex || undefined, labL: undefined, labA: undefined, labB: undefined }
      const maybe = await deps.createColor(payload)
      let created: Color | undefined = maybe as Color | undefined
      if (!created) {
        const latest = await deps.listColors()
        created = latest[0]
      }
      if (created) {
        c = created
        cBySku.set(c.sku, c)
        cByName.set(c.name.trim().toLowerCase(), c)
        createdC++
      }
    }
    if (!c) continue

    const set = perTissue.get(t.id) ?? new Set<string>()
    set.add(c.id)
    perTissue.set(t.id, set)
  }

  for (const [tissueId, colorIdSet] of perTissue.entries()) {
    const { created, duplicates: dup } = await deps.createManyLinks(tissueId, Array.from(colorIdSet))
    createdL += created
    duplicates += dup
  }

  return { createdT, createdC, createdL, duplicates }
}

export async function importFromContent(fileName: string, text: string, delimiter: ','|';', deps: ImportDeps) {
  const items = await readItemsFromContent(fileName, text, delimiter)
  return importItems(items, deps)
}

// Full backup import (create tissues, colors, patterns; ignore links arrays when present or absent)
// Legacy simple import (v1-v3) – kept for backward compatibility; ignores links & attachments.
export async function importFullBackup(jsonText: string, deps: {
  createTissue: (input: { name: string; width: number; composition: string }) => Promise<Tissue | void>
  createColor: (input: ColorInput) => Promise<Color | void>
  createPattern: (input: PatternInput) => Promise<void>
}): Promise<{ createdT: number; createdC: number; createdP: number }> {
  let obj: any
  try { obj = JSON.parse(jsonText) } catch { throw new Error('JSON inválido') }
  if (!obj || obj.schema !== 'razai-tools.full-export') throw new Error('Arquivo não é um backup completo reconhecido')
  // Accept older versions (<=3): no attachments/integrity.
  const version = obj.version || 1
  if (version > 4) throw new Error(`Versão futura não suportada: ${version}`)
  const tissues = Array.isArray(obj.tissues) ? obj.tissues : []
  const colors = Array.isArray(obj.colors) ? obj.colors : []
  const patterns = Array.isArray(obj.patterns) ? obj.patterns : []
  let createdT = 0, createdC = 0, createdP = 0
  for (const t of tissues) {
    const maybe = await deps.createTissue({ name: t.name, width: t.width, composition: t.composition })
    if (maybe) createdT++
  }
  for (const c of colors) {
    const payload: ColorInput = { name: c.name, hex: c.hex, labL: c.labL, labA: c.labA, labB: c.labB }
    const maybe = await deps.createColor(payload)
    if (maybe) createdC++
  }
  for (const p of patterns) {
    await deps.createPattern({ family: p.family, name: p.name })
    createdP++
  }
  return { createdT, createdC, createdP }
}

// New exact import (v4) – preserves IDs/SKUs/createdAt, recreates links, attempts to restore images.
export async function importFullBackupExact(jsonText: string): Promise<{
  inserted: { tissues: number; colors: number; patterns: number; links: number; patternLinks: number }
  updated: { tissues: number; colors: number; patterns: number; links: number; patternLinks: number }
  issues: string[]
}> {
  let obj: any
  try { obj = JSON.parse(jsonText) } catch { throw new Error('JSON inválido') }
  const issues = validateFullExportObject(obj)
  if (obj.version < 4) issues.push('Versão antiga – upgrade interno aplicado (sem attachments/integrity confiável).')
  if (obj.version > 4) throw new Error(`Versão não suportada (${obj.version})`) // future
  // Prepare raw arrays from view links (they already contain base fields).
  const tecidoCorLinks = (Array.isArray(obj.links)? obj.links: []).map((l: any) => ({
    id: l.id,
    tissueId: l.tissueId,
    colorId: l.colorId,
    skuFilho: l.skuFilho,
    status: l.status,
    createdAt: l.createdAt,
    image: l.image, imagePath: l.imagePath, imageMime: l.imageMime, imageHash: l.imageHash, imageThumb: l.imageThumb,
  }))
  const tecidoEstampaLinks = (Array.isArray(obj.patternLinks)? obj.patternLinks: []).map((l: any) => ({
    id: l.id,
    tissueId: l.tissueId,
    patternId: l.patternId,
    skuFilho: l.skuFilho,
    status: l.status,
    createdAt: l.createdAt,
    image: l.image, imagePath: l.imagePath, imageMime: l.imageMime, imageHash: l.imageHash, imageThumb: l.imageThumb,
  }))
  // Attachments map for image restoration (web fallback uses data URL directly)
  const attachMap = new Map<string, { data?: string; mime?: string; thumb?: string }>()
  if (Array.isArray(obj.attachments)) {
    for (const a of obj.attachments) attachMap.set(a.hash, { data: a.data, mime: a.mime, thumb: a.thumb })
  }
  // Restore missing image fields from attachments when needed
  function hydrateImage(link: any) {
    const h = link.imageHash || link.imagePath
    if (!h) return
    const att = attachMap.get(h)
    if (!att) return
    if (!link.image && att.data) link.image = att.data
    if (!link.imageThumb && att.thumb) link.imageThumb = att.thumb
    if (!link.imageMime && att.mime) link.imageMime = att.mime
  }
  for (const l of tecidoCorLinks) hydrateImage(l)
  for (const l of tecidoEstampaLinks) hydrateImage(l)
  // Use raw import/update strategy via syncDb
  const res = await syncDb.importAll({
    tissues: Array.isArray(obj.tissues)? obj.tissues: [],
    colors: Array.isArray(obj.colors)? obj.colors: [],
    patterns: Array.isArray(obj.patterns)? obj.patterns: [],
    familyStats: Array.isArray(obj.familyStats)? obj.familyStats: [],
    tecidoCorLinks,
    tecidoEstampaLinks,
  }, 'merge')
  return {
    inserted: {
      tissues: res.tissuesInserted,
      colors: res.colorsInserted,
      patterns: res.patternsInserted,
      links: res.tecidoCorInserted,
      patternLinks: res.tecidoEstampaInserted,
    },
    updated: {
      tissues: res.tissuesUpdated,
      colors: res.colorsUpdated,
      patterns: res.patternsUpdated,
      links: res.tecidoCorUpdated,
      patternLinks: res.tecidoEstampaUpdated,
    },
    issues,
  }
}

// Dry-run validator returning issues (wrapper around validateFullExportObject)
export function fullBackupDryRun(jsonText: string): string[] {
  let obj: any
  try { obj = JSON.parse(jsonText) } catch { return ['JSON inválido'] }
  return validateFullExportObject(obj)
}
