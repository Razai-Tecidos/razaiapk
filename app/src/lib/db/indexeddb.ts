import { openDB, IDBPDatabase } from 'idb'
import type { Tissue } from '@/types/tissue'
import type { Color } from '@/types/color'
import type { Pattern } from '@/types/pattern'
import type { TecidoCor, TecidoCorView } from '@/types/tecidoCor'
import type { TecidoEstampa } from '@/types/tecidoEstampa'
import { detectFamilyFromName, inferFamilyFrom } from '@/lib/color-utils'

let dbPromise: Promise<IDBPDatabase> | null = null

export function getDb() {
  if (!dbPromise) {
    dbPromise = openDB('razai-tools', 8, {
      upgrade(db, oldVersion) {
        if (oldVersion < 1) {
          const store = db.createObjectStore('tissues', { keyPath: 'id' })
          store.createIndex('createdAt', 'createdAt')
        }
        if (oldVersion < 2) {
          const colors = db.createObjectStore('colors', { keyPath: 'id' })
          colors.createIndex('createdAt', 'createdAt')
        }
        if (oldVersion < 3) {
          // meta store para sequências de famílias de cores
          db.createObjectStore('colors_meta', { keyPath: 'key' })
        }
        if (oldVersion < 4) {
          // vínculos tecido-cor
          const links = db.createObjectStore('links', { keyPath: 'id' })
          links.createIndex('createdAt', 'createdAt')
          // índice único por par tecido|cor
          links.createIndex('pair', 'pair', { unique: true })
        }
        if (oldVersion < 5) {
          // store para imagens originais por hash
          db.createObjectStore('link_images', { keyPath: 'hash' })
          // 'links' já existe; os registros podem receber novos campos sem alterar o store
        }
        if (oldVersion < 6) {
          // Padrões (estampas) com índice por criação
          const patterns = db.createObjectStore('patterns', { keyPath: 'id' })
          patterns.createIndex('createdAt', 'createdAt')
          // Usaremos 'colors_meta' para metadados de estampas também, com prefixos específicos
        }
        if (oldVersion < 7) {
          // Links tecido-estampa
          const pelinks = db.createObjectStore('pattern_links', { keyPath: 'id' })
          pelinks.createIndex('createdAt', 'createdAt')
          pelinks.createIndex('pair', 'pair', { unique: true })
          // images stored via existing pattern_links record fields; optional
        }
        if (oldVersion < 8) {
          // Family statistics store
          const familyStats = db.createObjectStore('family_stats', { keyPath: 'familyName' })
          familyStats.createIndex('hueAvg', 'hueAvg')
        }
      }
    })
  }
  return dbPromise
}

export async function listTissues() {
  const db = await getDb()
  try {
    return (await db.getAllFromIndex('tissues', 'createdAt')).reverse() as Tissue[]
  } catch (e) {
    // Fallback para bases antigas sem índice: busca tudo e ordena por createdAt
    const all = await db.getAll('tissues') as Tissue[]
    return all.sort((a, b) => (a.createdAt || '').localeCompare(b.createdAt || '')).reverse()
  }
}

export async function createTissue(input: Tissue) {
  const db = await getDb()
  await db.put('tissues', input)
}

export async function updateTissue(input: { id: string; name: string; width: number; composition: string; color?: string }) {
  const db = await getDb()
  const current = (await db.get('tissues', input.id)) as Tissue | undefined
  if (!current) return
  const updated: Tissue = {
    ...current,
    name: input.name,
    width: input.width,
    composition: input.composition,
    color: input.color,
  }
  await db.put('tissues', updated)
}

export async function deleteTissue(id: string) {
  const db = await getDb()
  await db.delete('tissues', id)
}

// Colors
export async function listColors() {
  const db = await getDb()
  return (await db.getAllFromIndex('colors', 'createdAt')).reverse() as Color[]
}

export async function createColor(input: Color) {
  const db = await getDb()
  await db.put('colors', input)
}

export async function updateColor(input: { id: string; name: string; hex?: string; labL?: number; labA?: number; labB?: number }) {
  const db = await getDb()
  const current = (await db.get('colors', input.id)) as Color | undefined
  if (!current) return
  const updated: Color = {
    ...current,
    name: input.name,
    hex: input.hex,
    labL: input.labL,
    labA: input.labA,
    labB: input.labB,
  }
  await db.put('colors', updated)
}

export async function deleteColor(id: string) {
  const db = await getDb()
  await db.delete('colors', id)
}

// Próximo SKU por família (código de 2 letras) na IndexedDB
export async function nextColorSkuByFamilyCode(code: string) {
  const db = await getDb()
  const key = `family_seq:${code}`
  const rec = (await db.get('colors_meta', key)) as { key: string; last: number } | undefined
  const next = rec && typeof rec.last === 'number' ? rec.last + 1 : 1
  await db.put('colors_meta', { key, last: next })
  const padded = String(next).padStart(3, '0')
  return `${code}${padded}`
}

export async function getSetting(key: string): Promise<string | undefined> {
  const db = await getDb()
  const rec = (await db.get('colors_meta', key)) as { key: string; value: string } | undefined
  return rec?.value
}

export async function setSetting(key: string, value: string): Promise<void> {
  const db = await getDb()
  await db.put('colors_meta', { key, value })
}

// Tecido-Cor (links)
export async function listTecidoCor(): Promise<TecidoCorView[]> {
  const db = await getDb()
  const links = (await db.getAllFromIndex('links', 'createdAt')).reverse() as (TecidoCor & { pair: string })[]
  const tissues = await db.getAll('tissues') as Tissue[]
  const colors = await db.getAll('colors') as Color[]
  const tMap = new Map(tissues.map(t => [t.id, t]))
  const cMap = new Map(colors.map(c => [c.id, c]))
  const result: TecidoCorView[] = []
  for (const l of links) {
    const t = tMap.get(l.tissueId)
    const c = cMap.get(l.colorId)
    if (!t || !c) continue // skip broken refs
    const family = detectFamilyFromName(c.name) || 'Outros'
    result.push({
      ...l,
      tissueSku: t.sku,
      tissueName: t.name,
      width: t.width,
      composition: t.composition,
      colorSku: c.sku,
      colorName: c.name,
      family: family && family !== '—' ? family : '—',
      hex: c.hex,
      nomeCompleto: `${t.name} ${c.name}`,
    })
  }
  return result
}

export async function createTecidoCor(input: { tissueId: string; colorId: string; status?: 'Ativo'|'Inativo' }): Promise<{ created?: TecidoCor; duplicate?: boolean }> {
  const db = await getDb()
  const t = await db.get('tissues', input.tissueId) as Tissue | undefined
  const c = await db.get('colors', input.colorId) as Color | undefined
  if (!t || !c) throw new Error('Tecido ou cor inexistente')
  const pair = `${input.tissueId}|${input.colorId}`
  const id = crypto.randomUUID()
  const createdAt = new Date().toISOString()
  const skuFilho = `${t.sku}-${c.sku}`
  const rec: TecidoCor & { pair: string } = { id, tissueId: input.tissueId, colorId: input.colorId, skuFilho, status: input.status ?? 'Ativo', createdAt, pair, image: undefined, imagePath: undefined, imageMime: undefined, imageHash: undefined, imageThumb: undefined }
  try {
    await db.add('links', rec)
    return { created: rec }
  } catch (e: any) {
    // likely constraint violation on unique index
    return { duplicate: true }
  }
}

export async function createManyTecidoCor(tissueId: string, colorIds: string[]): Promise<{ created: number; duplicates: number }> {
  let created = 0, duplicates = 0
  for (const colorId of colorIds) {
    const res = await createTecidoCor({ tissueId, colorId })
    if (res.created) created++
    else duplicates++
  }
  return { created, duplicates }
}

export async function updateTecidoCorStatus(id: string, status: 'Ativo'|'Inativo'): Promise<void> {
  const db = await getDb()
  const current = await db.get('links', id) as (TecidoCor & { pair: string }) | undefined
  if (!current) return
  await db.put('links', { ...current, status })
}

export async function deleteTecidoCor(id: string): Promise<void> {
  const db = await getDb()
  await db.delete('links', id)
}

export async function updateTecidoCorImage(id: string, image: string | null): Promise<void> {
  const db = await getDb()
  const current = await db.get('links', id) as (TecidoCor & { pair: string }) | undefined
  if (!current) return
  await db.put('links', { ...current, image: image ?? undefined })
}

export async function updateTecidoCorImageFull(id: string, file: File): Promise<void> {
  const db = await getDb()
  const current = await db.get('links', id) as (TecidoCor & { pair: string }) | undefined
  if (!current) return
  // calcular hash
  let hash = ''
  try {
    const buf = await file.arrayBuffer()
    const digest = await crypto.subtle.digest('SHA-256', buf)
    hash = Array.from(new Uint8Array(digest)).map(b=>b.toString(16).padStart(2,'0')).join('')
    // armazenar blob no store dedicado, se não existir
    const exists = await db.get('link_images', hash)
    if (!exists) {
      await db.put('link_images', { hash, mime: file.type || 'application/octet-stream', blob: new Blob([buf], { type: file.type }) })
    }
  } catch {
    hash = crypto.randomUUID().replace(/-/g,'')
    const buf = await file.arrayBuffer()
    await db.put('link_images', { hash, mime: file.type || 'application/octet-stream', blob: new Blob([buf], { type: file.type }) })
  }
  // gerar thumb simples (jsdom não tem canvas; usar DataURL do arquivo direto como fallback leve em testes)
  const thumb = await new Promise<string>((resolve) => {
    const fr = new FileReader()
    fr.onload = () => resolve(String(fr.result))
    fr.onerror = () => resolve('')
    fr.readAsDataURL(file)
  })
  const updated: TecidoCor & { pair: string } = {
    ...current,
    imagePath: `idb:${hash}`,
    imageMime: file.type || 'application/octet-stream',
    imageHash: hash,
    imageThumb: thumb || current.imageThumb,
  }
  await db.put('links', updated)
}

// ===== Tecido-Estampa Links =====
export type TecidoEstampaView = import('@/types/tecidoEstampa').TecidoEstampaView

export async function listTecidoEstampa(): Promise<TecidoEstampaView[]> {
  const db = await getDb()
  const links = (await db.getAllFromIndex('pattern_links', 'createdAt')).reverse() as (TecidoEstampa & { pair: string })[]
  const tissues = await db.getAll('tissues') as Tissue[]
  const patterns = await db.getAll('patterns') as import('@/types/pattern').Pattern[]
  const tMap = new Map(tissues.map(t => [t.id, t]))
  const pMap = new Map(patterns.map(p => [p.id, p]))
  const out: TecidoEstampaView[] = []
  for (const l of links) {
    const t = tMap.get(l.tissueId)
    const p = pMap.get(l.patternId)
    if (!t || !p) continue
    out.push({
      ...l,
      tissueSku: t.sku,
      tissueName: t.name,
      width: t.width,
      composition: t.composition,
      patternSku: p.sku,
      patternFamily: p.family,
      patternName: p.name,
      nomeCompleto: `${t.name} ${p.family} ${p.name}`,
    })
  }
  return out
}

export async function createTecidoEstampa(input: { tissueId: string; patternId: string; status?: 'Ativo'|'Inativo' }): Promise<{ created?: TecidoEstampa; duplicate?: boolean }> {
  const db = await getDb()
  const t = await db.get('tissues', input.tissueId) as Tissue | undefined
  const p = await db.get('patterns', input.patternId) as import('@/types/pattern').Pattern | undefined
  if (!t || !p) throw new Error('Tecido ou estampa inexistente')
  const pair = `${input.tissueId}|${input.patternId}`
  const id = crypto.randomUUID()
  const createdAt = new Date().toISOString()
  const skuFilho = `${t.sku}-${p.sku}`
  const rec: TecidoEstampa & { pair: string } = { id, tissueId: input.tissueId, patternId: input.patternId, skuFilho, status: input.status ?? 'Ativo', createdAt, pair }
  try {
    await db.add('pattern_links', rec)
    return { created: rec }
  } catch {
    return { duplicate: true }
  }
}

export async function createManyTecidoEstampa(tissueId: string, patternIds: string[]): Promise<{ created: number; duplicates: number }> {
  let created = 0, duplicates = 0
  for (const pid of patternIds) {
    const r = await createTecidoEstampa({ tissueId, patternId: pid })
    if (r.created) created++
    else duplicates++
  }
  return { created, duplicates }
}

export async function updateTecidoEstampaStatus(id: string, status: 'Ativo'|'Inativo'): Promise<void> {
  const db = await getDb()
  const current = await db.get('pattern_links', id) as (TecidoEstampa & { pair: string }) | undefined
  if (!current) return
  await db.put('pattern_links', { ...current, status })
}

export async function deleteTecidoEstampa(id: string): Promise<void> {
  const db = await getDb()
  await db.delete('pattern_links', id)
}

export async function updateTecidoEstampaImageFull(id: string, file: File): Promise<void> {
  const db = await getDb()
  const current = await db.get('pattern_links', id) as (TecidoEstampa & { pair: string }) | undefined
  if (!current) return
  let hash = ''
  try {
    const buf = await file.arrayBuffer()
    const digest = await crypto.subtle.digest('SHA-256', buf)
    hash = Array.from(new Uint8Array(digest)).map(b=>b.toString(16).padStart(2,'0')).join('')
    const exists = await db.get('link_images', hash)
    if (!exists) {
      await db.put('link_images', { hash, mime: file.type || 'application/octet-stream', blob: new Blob([buf], { type: file.type }) })
    }
  } catch {
    hash = crypto.randomUUID().replace(/-/g,'')
    const buf = await file.arrayBuffer()
    await db.put('link_images', { hash, mime: file.type || 'application/octet-stream', blob: new Blob([buf], { type: file.type }) })
  }
  const thumb = await new Promise<string>((resolve) => {
    const fr = new FileReader()
    fr.onload = () => resolve(String(fr.result))
    fr.onerror = () => resolve('')
    fr.readAsDataURL(file)
  })
  const updated: TecidoEstampa & { pair: string } = { ...current, imagePath: `idb:${hash}`, imageMime: file.type || 'application/octet-stream', imageHash: hash, imageThumb: thumb || current.imageThumb }
  await db.put('pattern_links', updated)
}

// ===== Estampas (Patterns) =====
// Pattern type imported at top

function normFamilyName(name: string): string {
  return (name || '').trim().replace(/\s+/g, ' ').toLowerCase()
}

async function listAssignedPatternCodes(): Promise<Map<string, string>> {
  const db = await getDb()
  const all = await db.getAll('colors_meta') as Array<{ key: string; value?: any; last?: any }>
  const map = new Map<string, string>()
  for (const rec of all) {
    if (rec.key && typeof rec.key === 'string' && rec.key.startsWith('pattern_family_code:')) {
      const fam = rec.key.split(':', 2)[1]
      const code = (rec as any).value as string
      if (fam && code) map.set(fam, code)
    }
  }
  return map
}

function computeCandidateCodeForFamily(displayFamily: string, avoid: Set<string>): string {
  const s = (displayFamily || '').trim()
  if (!s) return 'XX'
  const first = s[0].toUpperCase()
  const rest = s.slice(1)
  // Helper to try building codes
  const tryList: string[] = []
  // 1) Jardim reservado como JA
  if (normFamilyName(s) === 'jardim') return 'JA'
  // 2) First + first consonant/letter from rest
  for (let i = 0; i < rest.length; i++) {
    const ch = rest[i].toUpperCase()
    if (!/[A-ZÇÁÉÍÓÚÃÕÂÊÎÔÛÄËÏÖÜ]/i.test(ch)) continue
    // Skip 'A' when first is 'J' to avoid 'JA' for não-Jardim
    if (first === 'J' && ch === 'A') continue
    tryList.push(first + (ch === 'Ç' ? 'C' : ch))
    if (tryList.length >= 5) break
  }
  // 3) Fallback: first two letters (avoid JA case)
  if (rest[0]) {
    const ch = rest[0].toUpperCase()
    if (!(first === 'J' && ch === 'A')) tryList.push(first + ch)
  }
  // 4) Fallbacks with X/Y/Z
  tryList.push(first + 'X', first + 'Y', first + 'Z')
  for (const code of tryList) {
    if (code === 'JA') continue // JA reservado
    if (!avoid.has(code)) return code
  }
  // As última instância: gerar com números
  let n = 1
  while (avoid.has(first + String(n))) n++
  return first + String(n)
}

async function ensurePatternFamilyCode(displayFamily: string): Promise<{ code: string; familyNorm: string }> {
  const db = await getDb()
  const familyNorm = normFamilyName(displayFamily)
  const key = `pattern_family_code:${familyNorm}`
  const existing = await db.get('colors_meta', key) as { key: string; value: string } | undefined
  if (existing && existing.value) return { code: existing.value, familyNorm }
  // Build avoid set from existing assignments
  const map = await listAssignedPatternCodes()
  const used = new Set<string>(Array.from(map.values()))
  // Reserve JA to Jardim
  used.add('JA')
  const code = computeCandidateCodeForFamily(displayFamily, used)
  await db.put('colors_meta', { key, value: code })
  return { code, familyNorm }
}

async function nextPatternSkuByCode(code: string): Promise<string> {
  const db = await getDb()
  const key = `pattern_family_seq:${code}`
  const rec = (await db.get('colors_meta', key)) as { key: string; last: number } | undefined
  const next = rec && typeof rec.last === 'number' ? rec.last + 1 : 1
  await db.put('colors_meta', { key, last: next })
  const padded = String(next).padStart(3, '0')
  return `${code}${padded}`
}

export async function listPatterns(): Promise<Pattern[]> {
  const db = await getDb()
  try {
    return (await db.getAllFromIndex('patterns', 'createdAt')).reverse() as Pattern[]
  } catch {
    const all = await db.getAll('patterns') as Pattern[]
    return all.sort((a, b) => (a.createdAt || '').localeCompare(b.createdAt || '')).reverse()
  }
}

export async function createPattern(input: Pattern): Promise<void> {
  const db = await getDb()
  await db.put('patterns', input)
}

export async function updatePattern(input: { id: string; family: string; name: string }): Promise<void> {
  const db = await getDb()
  const current = (await db.get('patterns', input.id)) as Pattern | undefined
  if (!current) return
  // SKU permanece imutável mesmo que família/nome mudem
  const updated: Pattern = { ...current, family: input.family, name: input.name }
  await db.put('patterns', updated)
}

export async function deletePattern(id: string): Promise<void> {
  const db = await getDb()
  await db.delete('patterns', id)
}

export async function nextPatternSkuByFamilyName(familyDisplayName: string): Promise<{ code: string; sku: string }> {
  const { code } = await ensurePatternFamilyCode(familyDisplayName)
  const sku = await nextPatternSkuByCode(code)
  return { code, sku }
}

// Limpa todas as cores e vínculos tecido-cor na IndexedDB, além das sequências de família de cor.
// Mantém tecidos, estampas, configurações e vínculos tecido-estampa.
export async function clearAllColors(): Promise<{ colors: number; links: number; sequences: number }> {
  const db = await getDb()
  const allColors = await db.getAll('colors') as Array<{ id: string }>
  const allLinks = await db.getAll('links') as Array<{ id: string; colorId: string }>
  const allMeta = await db.getAll('colors_meta') as Array<{ key: string }>
  const colorIds = new Set(allColors.map(c => c.id))
  const linksToDelete = allLinks.filter(l => colorIds.has(l.colorId))
  const seqKeys = allMeta.filter(m => typeof m.key === 'string' && m.key.startsWith('family_seq:')).map(m => m.key)
  // Remover vínculos primeiro
  for (const l of linksToDelete) {
    await db.delete('links', l.id)
  }
  // Remover cores
  for (const c of allColors) {
    await db.delete('colors', c.id)
  }
  // Remover sequências
  for (const k of seqKeys) {
    await db.delete('colors_meta', k)
  }
  return { colors: allColors.length, links: linksToDelete.length, sequences: seqKeys.length }
}

// ===== Raw CRUD for import/export (preserves all fields including IDs and images) =====

export async function createTissueRaw(t: Tissue) {
  const db = await getDb()
  await db.put('tissues', t)
}

export async function updateTissueRaw(t: Tissue) {
  const db = await getDb()
  await db.put('tissues', t)
}

export async function createColorRaw(c: Color) {
  const db = await getDb()
  await db.put('colors', c)
}

export async function updateColorRaw(c: Color) {
  const db = await getDb()
  await db.put('colors', c)
}

export async function createPatternRaw(p: Pattern) {
  const db = await getDb()
  await db.put('patterns', p)
}

export async function updatePatternRaw(p: Pattern) {
  const db = await getDb()
  await db.put('patterns', p)
}

export async function listTecidoCorRaw(): Promise<TecidoCor[]> {
  const db = await getDb()
  return (await db.getAll('links')) as TecidoCor[]
}

export async function createTecidoCorRaw(l: TecidoCor) {
  const db = await getDb()
  await db.put('links', l)
}

export async function updateTecidoCorRaw(l: TecidoCor) {
  const db = await getDb()
  await db.put('links', l)
}

export async function listTecidoEstampaRaw(): Promise<TecidoEstampa[]> {
  const db = await getDb()
  return (await db.getAll('pattern_links')) as TecidoEstampa[]
}

export async function createTecidoEstampaRaw(l: TecidoEstampa) {
  const db = await getDb()
  await db.put('pattern_links', l)
}

export async function updateTecidoEstampaRaw(l: TecidoEstampa) {
  const db = await getDb()
  await db.put('pattern_links', l)
}

// Family Statistics
export interface FamilyStat {
  familyName: string
  hueMin: number
  hueMax: number
  hueAvg: number
  colorCount: number
  updatedAt: string
}

export async function listFamilyStats(): Promise<FamilyStat[]> {
  const db = await getDb()
  try {
    return (await db.getAllFromIndex('family_stats', 'hueAvg')) as FamilyStat[]
  } catch (e) {
    const all = (await db.getAll('family_stats')) as FamilyStat[]
    return all.sort((a, b) => a.hueAvg - b.hueAvg)
  }
}

export async function updateFamilyStat(familyName: string, hue: number): Promise<void> {
  const db = await getDb()
  const updatedAt = new Date().toISOString()
  
  const existing = await db.get('family_stats', familyName) as FamilyStat | undefined
  
  if (!existing) {
    // First color in this family
    await db.put('family_stats', {
      familyName,
      hueMin: hue,
      hueMax: hue,
      hueAvg: hue,
      colorCount: 1,
      updatedAt,
    })
  } else {
    // Update existing stat
    const newCount = existing.colorCount + 1
    const newMin = Math.min(existing.hueMin, hue)
    const newMax = Math.max(existing.hueMax, hue)
    const newAvg = existing.hueAvg + (hue - existing.hueAvg) / newCount
    
    await db.put('family_stats', {
      familyName,
      hueMin: newMin,
      hueMax: newMax,
      hueAvg: newAvg,
      colorCount: newCount,
      updatedAt,
    })
  }
}

export async function clearFamilyStats(): Promise<void> {
  const db = await getDb()
  await db.clear('family_stats')
}

