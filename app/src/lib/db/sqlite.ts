import Database from '@tauri-apps/plugin-sql'

let db: Database | null = null

export async function getDb() {
  if (db) return db
  // sqlite:app.db stores the DB in the app's data directory
  db = await Database.load('sqlite:app.db')
  // Improve reliability under concurrent access / slower disks
  try {
    await db.execute('PRAGMA journal_mode = WAL')
    await db.execute('PRAGMA busy_timeout = 3000')
    await db.execute('PRAGMA foreign_keys = ON')
  } catch (e) {
    // Ignored: Pragmas may fail on some platforms; not critical
    console.warn('SQLite PRAGMA setup warning:', e)
  }
  await migrate(db)
  return db
}

async function migrate(database: Database) {
  await database.execute(`
    CREATE TABLE IF NOT EXISTS tissues (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      width REAL NOT NULL,
      composition TEXT NOT NULL,
      sku TEXT NOT NULL,
      color TEXT NULL,
      created_at TEXT NOT NULL
    )
  `)
  await database.execute(`
    CREATE TABLE IF NOT EXISTS colors (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      hex TEXT NULL,
      labL REAL NULL,
      labA REAL NULL,
      labB REAL NULL,
      sku TEXT NOT NULL,
      created_at TEXT NOT NULL
    )
  `)
  // Sequência por família de cor (código de 2 letras)
  await database.execute(`
    CREATE TABLE IF NOT EXISTS color_family_seq (
      code TEXT PRIMARY KEY,
      last INTEGER NOT NULL
    )
  `)
  // Configurações (chave/valor)
  await database.execute(`
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    )
  `)
  // Estampas (patterns)
  await database.execute(`
    CREATE TABLE IF NOT EXISTS patterns (
      id TEXT PRIMARY KEY,
      family TEXT NOT NULL,
      name TEXT NOT NULL,
      sku TEXT NOT NULL,
      created_at TEXT NOT NULL
    )
  `)
  await database.execute(`
    CREATE TABLE IF NOT EXISTS pattern_family_code (
      family_norm TEXT PRIMARY KEY,
      code TEXT NOT NULL
    )
  `)
  await database.execute(`
    CREATE TABLE IF NOT EXISTS pattern_family_seq (
      code TEXT PRIMARY KEY,
      last INTEGER NOT NULL
    )
  `)
  await database.execute(`
    CREATE TABLE IF NOT EXISTS tecido_cor (
      id TEXT PRIMARY KEY,
      tissue_id TEXT NOT NULL,
      color_id TEXT NOT NULL,
      sku_filho TEXT NOT NULL,
      status TEXT NOT NULL,
      created_at TEXT NOT NULL,
      image TEXT NULL,
      image_path TEXT NULL,
      image_mime TEXT NULL,
      image_hash TEXT NULL,
      image_thumb TEXT NULL,
      UNIQUE(tissue_id, color_id),
      UNIQUE(sku_filho)
    )
  `)
  // Attempt to add missing image column on upgraded installations
  try { await database.execute('ALTER TABLE tecido_cor ADD COLUMN image TEXT NULL') } catch (e) { /* ignore if exists */ }
  try { await database.execute('ALTER TABLE tecido_cor ADD COLUMN image_path TEXT NULL') } catch (e) { /* ignore if exists */ }
  try { await database.execute('ALTER TABLE tecido_cor ADD COLUMN image_mime TEXT NULL') } catch (e) { /* ignore if exists */ }
  try { await database.execute('ALTER TABLE tecido_cor ADD COLUMN image_hash TEXT NULL') } catch (e) { /* ignore if exists */ }
  try { await database.execute('ALTER TABLE tecido_cor ADD COLUMN image_thumb TEXT NULL') } catch (e) { /* ignore if exists */ }

  // Tecido-Estampa
  await database.execute(`
    CREATE TABLE IF NOT EXISTS tecido_estampa (
      id TEXT PRIMARY KEY,
      tissue_id TEXT NOT NULL,
      pattern_id TEXT NOT NULL,
      sku_filho TEXT NOT NULL,
      status TEXT NOT NULL,
      created_at TEXT NOT NULL,
      image TEXT NULL,
      image_path TEXT NULL,
      image_mime TEXT NULL,
      image_hash TEXT NULL,
      image_thumb TEXT NULL,
      UNIQUE(tissue_id, pattern_id),
      UNIQUE(sku_filho)
    )
  `)
  try { await database.execute('ALTER TABLE tecido_estampa ADD COLUMN image TEXT NULL') } catch (e) {}
  try { await database.execute('ALTER TABLE tecido_estampa ADD COLUMN image_path TEXT NULL') } catch (e) {}
  try { await database.execute('ALTER TABLE tecido_estampa ADD COLUMN image_mime TEXT NULL') } catch (e) {}
  try { await database.execute('ALTER TABLE tecido_estampa ADD COLUMN image_hash TEXT NULL') } catch (e) {}
  try { await database.execute('ALTER TABLE tecido_estampa ADD COLUMN image_thumb TEXT NULL') } catch (e) {}
  
  // Family statistics: track hue ranges and color count per family
  await database.execute(`
    CREATE TABLE IF NOT EXISTS family_stats (
      family_name TEXT PRIMARY KEY,
      hue_min REAL NOT NULL,
      hue_max REAL NOT NULL,
      hue_avg REAL NOT NULL,
      color_count INTEGER NOT NULL,
      updated_at TEXT NOT NULL
    )
  `)
}

export async function listTissues() {
  const d = await getDb()
  const rows = await d.select<Array<{ id: string; name: string; width: number; composition: string; sku: string; color: string | null; created_at: string }>>(
    'SELECT id, name, width, composition, sku, color, created_at FROM tissues ORDER BY created_at DESC'
  )
  return rows.map((r) => ({ id: r.id, name: r.name, width: r.width, composition: r.composition, sku: r.sku, color: r.color ?? undefined, createdAt: r.created_at }))
}

export async function createTissue(input: { id: string; name: string; width: number; composition: string; sku: string; color?: string; createdAt: string }) {
  const d = await getDb()
  await d.execute('INSERT INTO tissues (id, name, width, composition, sku, color, created_at) VALUES ($1, $2, $3, $4, $5, $6, $7)', [
    input.id,
    input.name,
    input.width,
    input.composition,
    input.sku,
    input.color ?? null,
    input.createdAt,
  ])
}

export async function updateTissue(input: { id: string; name: string; width: number; composition: string; color?: string }) {
  const d = await getDb()
  await d.execute('UPDATE tissues SET name = $1, width = $2, composition = $3, color = $4 WHERE id = $5', [
    input.name,
    input.width,
    input.composition,
    input.color ?? null,
    input.id,
  ])
}

export async function deleteTissue(id: string) {
  const d = await getDb()
  await d.execute('DELETE FROM tissues WHERE id = $1', [id])
}

// Colors
export async function listColors() {
  const d = await getDb()
  const rows = await d.select<Array<{ id: string; name: string; hex: string | null; labL: number | null; labA: number | null; labB: number | null; sku: string; created_at: string }>>(
    'SELECT id, name, hex, labL, labA, labB, sku, created_at FROM colors ORDER BY created_at DESC'
  )
  return rows.map((r) => ({ id: r.id, name: r.name, hex: r.hex ?? undefined, labL: r.labL ?? undefined, labA: r.labA ?? undefined, labB: r.labB ?? undefined, sku: r.sku, createdAt: r.created_at }))
}

export async function createColor(input: { id: string; name: string; hex?: string; labL?: number; labA?: number; labB?: number; sku: string; createdAt: string }) {
  const d = await getDb()
  await d.execute('INSERT INTO colors (id, name, hex, labL, labA, labB, sku, created_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)', [
    input.id,
    input.name,
    input.hex ?? null,
    input.labL ?? null,
    input.labA ?? null,
    input.labB ?? null,
    input.sku,
    input.createdAt,
  ])
}

export async function updateColor(input: { id: string; name: string; hex?: string; labL?: number; labA?: number; labB?: number }) {
  const d = await getDb()
  await d.execute('UPDATE colors SET name=$1, hex=$2, labL=$3, labA=$4, labB=$5 WHERE id=$6', [
    input.name,
    input.hex ?? null,
    input.labL ?? null,
    input.labA ?? null,
    input.labB ?? null,
    input.id,
  ])
}

export async function deleteColor(id: string) {
  const d = await getDb()
  await d.execute('DELETE FROM colors WHERE id = $1', [id])
}

// Apaga TODAS as cores, vínculos tecido_cor dependentes e sequência por família.
// Mantém tecidos, estampas, configurações e vínculos tecido_estampa intactos.
// Retorna contagens do que foi removido para feedback na UI.
export async function clearAllColors(): Promise<{ colors: number; links: number; sequences: number }> {
  const d = await getDb()
  // Contagens prévias para retorno
  const colorCountRows = await d.select<Array<{ c: number }>>('SELECT COUNT(*) as c FROM colors')
  const linkCountRows = await d.select<Array<{ c: number }>>('SELECT COUNT(*) as c FROM tecido_cor')
  const seqCountRows = await d.select<Array<{ c: number }>>('SELECT COUNT(*) as c FROM color_family_seq')
  const colors = colorCountRows[0]?.c || 0
  const links = linkCountRows[0]?.c || 0
  const sequences = seqCountRows[0]?.c || 0
  try {
    await d.execute('BEGIN')
    // Remover vínculos primeiro para evitar referências órfãs
    await d.execute('DELETE FROM tecido_cor')
    // Remover cores
    await d.execute('DELETE FROM colors')
    // Resetar sequências (serão recriadas conforme novas famílias surgirem)
    await d.execute('DELETE FROM color_family_seq')
    await d.execute('COMMIT')
  } catch (e) {
    try { await d.execute('ROLLBACK') } catch {}
    throw e
  }
  // Opcional: liberar espaço; ignorar erros em plataformas sem suporte
  try { await d.execute('VACUUM') } catch {}
  return { colors, links, sequences }
}

// Retorna próximo SKU para uma família (código de 2 letras) e atualiza contador atômico
export async function nextColorSkuByFamilyCode(code: string) {
  const d = await getDb()
  const rows = await d.select<Array<{ last: number }>>('SELECT last FROM color_family_seq WHERE code = $1', [code])
  let next = 1
  if (rows.length > 0 && typeof rows[0].last === 'number') {
    next = rows[0].last + 1
    await d.execute('UPDATE color_family_seq SET last = $1 WHERE code = $2', [next, code])
  } else {
    await d.execute('INSERT INTO color_family_seq (code, last) VALUES ($1, $2)', [code, next])
  }
  const padded = String(next).padStart(3, '0')
  return `${code}${padded}`
}

export async function getSetting(key: string): Promise<string | undefined> {
  const d = await getDb()
  const rows = await d.select<Array<{ value: string }>>('SELECT value FROM settings WHERE key = $1', [key])
  return rows.length ? rows[0].value : undefined
}

export async function setSetting(key: string, value: string): Promise<void> {
  const d = await getDb()
  const exists = await d.select<Array<{ key: string }>>('SELECT key FROM settings WHERE key = $1', [key])
  if (exists.length) await d.execute('UPDATE settings SET value=$1 WHERE key=$2', [value, key])
  else await d.execute('INSERT INTO settings (key, value) VALUES ($1,$2)', [key, value])
}

// Tecido-Cor (links)
export async function listTecidoCor() {
  const d = await getDb()
  const rows = await d.select<Array<{ id: string; tissue_id: string; color_id: string; sku_filho: string; status: string; created_at: string; image: string | null; image_path: string | null; image_mime: string | null; image_hash: string | null; image_thumb: string | null }>>(
    'SELECT id, tissue_id, color_id, sku_filho, status, created_at, image, image_path, image_mime, image_hash, image_thumb FROM tecido_cor ORDER BY created_at DESC'
  )
  return rows.map(r => ({ id: r.id, tissueId: r.tissue_id, colorId: r.color_id, skuFilho: r.sku_filho, status: r.status as 'Ativo'|'Inativo', createdAt: r.created_at, image: r.image ?? undefined, imagePath: r.image_path ?? undefined, imageMime: r.image_mime ?? undefined, imageHash: r.image_hash ?? undefined, imageThumb: r.image_thumb ?? undefined }))
}

export async function createTecidoCor(input: { tissueId: string; colorId: string; status?: 'Ativo'|'Inativo' }) {
  const d = await getDb()
  // obter SKUs
  const tRows = await d.select<Array<{ sku: string }>>('SELECT sku FROM tissues WHERE id = $1', [input.tissueId])
  const cRows = await d.select<Array<{ sku: string }>>('SELECT sku FROM colors WHERE id = $1', [input.colorId])
  if (!tRows.length || !cRows.length) throw new Error('Tecido ou cor inexistente')
  const skuFilho = `${tRows[0].sku}-${cRows[0].sku}`
  const id = crypto.randomUUID()
  const createdAt = new Date().toISOString()
  try {
    await d.execute('INSERT INTO tecido_cor (id, tissue_id, color_id, sku_filho, status, created_at, image, image_path, image_mime, image_hash, image_thumb) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)', [
      id,
      input.tissueId,
      input.colorId,
      skuFilho,
      input.status ?? 'Ativo',
      createdAt,
      null,
      null,
      null,
      null,
      null,
    ])
    return { id }
  } catch (e: any) {
    // violação UNIQUE => duplicado
    return { duplicate: true }
  }
}

export async function createManyTecidoCor(tissueId: string, colorIds: string[]) {
  let created = 0, duplicates = 0
  for (const colorId of colorIds) {
    const res = await createTecidoCor({ tissueId, colorId })
    if ((res as any).duplicate) duplicates++
    else created++
  }
  return { created, duplicates }
}

export async function updateTecidoCorStatus(id: string, status: 'Ativo'|'Inativo') {
  const d = await getDb()
  await d.execute('UPDATE tecido_cor SET status=$1 WHERE id=$2', [status, id])
}

export async function deleteTecidoCor(id: string) {
  const d = await getDb()
  await d.execute('DELETE FROM tecido_cor WHERE id=$1', [id])
}

export async function updateTecidoCorImage(id: string, image: string | null) {
  const d = await getDb()
  await d.execute('UPDATE tecido_cor SET image=$1 WHERE id=$2', [image, id])
}

export async function updateTecidoCorImageFull(id: string, payload: { path?: string | null; mime?: string | null; hash?: string | null; thumb?: string | null }) {
  const d = await getDb()
  await d.execute('UPDATE tecido_cor SET image_path=$1, image_mime=$2, image_hash=$3, image_thumb=$4 WHERE id=$5', [
    payload.path ?? null,
    payload.mime ?? null,
    payload.hash ?? null,
    payload.thumb ?? null,
    id,
  ])
}

// ===== Tecido-Estampa (links)
export type TecidoEstampa = import('@/types/tecidoEstampa').TecidoEstampa
export type TecidoEstampaView = import('@/types/tecidoEstampa').TecidoEstampaView

export async function listTecidoEstampa() {
  const d = await getDb()
  const rows = await d.select<Array<{ id: string; tissue_id: string; pattern_id: string; sku_filho: string; status: string; created_at: string; image: string | null; image_path: string | null; image_mime: string | null; image_hash: string | null; image_thumb: string | null }>>(
    'SELECT id, tissue_id, pattern_id, sku_filho, status, created_at, image, image_path, image_mime, image_hash, image_thumb FROM tecido_estampa ORDER BY created_at DESC'
  )
  return rows.map(r => ({ id: r.id, tissueId: r.tissue_id, patternId: r.pattern_id, skuFilho: r.sku_filho, status: r.status as 'Ativo'|'Inativo', createdAt: r.created_at, image: r.image ?? undefined, imagePath: r.image_path ?? undefined, imageMime: r.image_mime ?? undefined, imageHash: r.image_hash ?? undefined, imageThumb: r.image_thumb ?? undefined }))
}

export async function createTecidoEstampa(input: { tissueId: string; patternId: string; status?: 'Ativo'|'Inativo' }) {
  const d = await getDb()
  const tRows = await d.select<Array<{ sku: string }>>('SELECT sku FROM tissues WHERE id = $1', [input.tissueId])
  const pRows = await d.select<Array<{ sku: string }>>('SELECT sku FROM patterns WHERE id = $1', [input.patternId])
  if (!tRows.length || !pRows.length) throw new Error('Tecido ou estampa inexistente')
  const skuFilho = `${tRows[0].sku}-${pRows[0].sku}`
  const id = crypto.randomUUID()
  const createdAt = new Date().toISOString()
  try {
    await d.execute('INSERT INTO tecido_estampa (id, tissue_id, pattern_id, sku_filho, status, created_at, image, image_path, image_mime, image_hash, image_thumb) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)', [
      id,
      input.tissueId,
      input.patternId,
      skuFilho,
      input.status ?? 'Ativo',
      createdAt,
      null,
      null,
      null,
      null,
      null,
    ])
    return { id }
  } catch (e) {
    return { duplicate: true }
  }
}

export async function createManyTecidoEstampa(tissueId: string, patternIds: string[]) {
  let created = 0, duplicates = 0
  for (const patternId of patternIds) {
    const res = await createTecidoEstampa({ tissueId, patternId })
    if ((res as any).duplicate) duplicates++
    else created++
  }
  return { created, duplicates }
}

export async function updateTecidoEstampaStatus(id: string, status: 'Ativo'|'Inativo') {
  const d = await getDb()
  await d.execute('UPDATE tecido_estampa SET status=$1 WHERE id=$2', [status, id])
}

export async function deleteTecidoEstampa(id: string) {
  const d = await getDb()
  await d.execute('DELETE FROM tecido_estampa WHERE id=$1', [id])
}

export async function updateTecidoEstampaImageFull(id: string, payload: { path?: string | null; mime?: string | null; hash?: string | null; thumb?: string | null }) {
  const d = await getDb()
  await d.execute('UPDATE tecido_estampa SET image_path=$1, image_mime=$2, image_hash=$3, image_thumb=$4 WHERE id=$5', [
    payload.path ?? null,
    payload.mime ?? null,
    payload.hash ?? null,
    payload.thumb ?? null,
    id,
  ])
}

// ===== Estampas (Patterns) =====
export type Pattern = import('@/types/pattern').Pattern

function normFamilyName(name: string): string { return (name || '').trim().replace(/\s+/g, ' ').toLowerCase() }

async function getAssignedPatternCodeFor(familyNorm: string): Promise<string | undefined> {
  const d = await getDb()
  const rows = await d.select<Array<{ code: string }>>('SELECT code FROM pattern_family_code WHERE family_norm = $1', [familyNorm])
  return rows.length ? rows[0].code : undefined
}

async function listUsedPatternCodes(): Promise<Set<string>> {
  const d = await getDb()
  const rows = await d.select<Array<{ code: string }>>('SELECT code FROM pattern_family_code', [])
  return new Set(rows.map(r => r.code))
}

function computeCandidateCodeForFamily(displayFamily: string, avoid: Set<string>): string {
  const s = (displayFamily || '').trim()
  if (!s) return 'XX'
  const first = s[0].toUpperCase()
  const rest = s.slice(1)
  if (normFamilyName(s) === 'jardim') return 'JA'
  const tryList: string[] = []
  for (let i = 0; i < rest.length; i++) {
    const ch = rest[i].toUpperCase()
    if (!/[A-ZÇÁÉÍÓÚÃÕÂÊÎÔÛÄËÏÖÜ]/i.test(ch)) continue
    if (first === 'J' && ch === 'A') continue
    tryList.push(first + (ch === 'Ç' ? 'C' : ch))
    if (tryList.length >= 5) break
  }
  if (rest[0]) {
    const ch = rest[0].toUpperCase()
    if (!(first === 'J' && ch === 'A')) tryList.push(first + ch)
  }
  tryList.push(first + 'X', first + 'Y', first + 'Z')
  for (const code of tryList) {
    if (code === 'JA') continue
    if (!avoid.has(code)) return code
  }
  let n = 1
  while (avoid.has(first + String(n))) n++
  return first + String(n)
}

async function ensurePatternFamilyCode(displayFamily: string): Promise<{ code: string; familyNorm: string }> {
  const d = await getDb()
  const familyNorm = normFamilyName(displayFamily)
  const existing = await getAssignedPatternCodeFor(familyNorm)
  if (existing) return { code: existing, familyNorm }
  const used = await listUsedPatternCodes()
  used.add('JA')
  const code = computeCandidateCodeForFamily(displayFamily, used)
  await d.execute('INSERT INTO pattern_family_code (family_norm, code) VALUES ($1,$2)', [familyNorm, code])
  return { code, familyNorm }
}

async function nextPatternSkuByCode(code: string): Promise<string> {
  const d = await getDb()
  const rows = await d.select<Array<{ last: number }>>('SELECT last FROM pattern_family_seq WHERE code = $1', [code])
  let next = 1
  if (rows.length) {
    next = (rows[0].last || 0) + 1
    await d.execute('UPDATE pattern_family_seq SET last=$1 WHERE code=$2', [next, code])
  } else {
    await d.execute('INSERT INTO pattern_family_seq (code, last) VALUES ($1,$2)', [code, next])
  }
  const padded = String(next).padStart(3, '0')
  return `${code}${padded}`
}

export async function listPatterns(): Promise<Pattern[]> {
  const d = await getDb()
  const rows = await d.select<Array<{ id: string; family: string; name: string; sku: string; created_at: string }>>('SELECT id, family, name, sku, created_at FROM patterns ORDER BY created_at DESC')
  return rows.map(r => ({ id: r.id, family: r.family, name: r.name, sku: r.sku, createdAt: r.created_at }))
}

export async function createPattern(input: { id: string; family: string; name: string; sku: string; createdAt: string }): Promise<void> {
  const d = await getDb()
  await d.execute('INSERT INTO patterns (id, family, name, sku, created_at) VALUES ($1,$2,$3,$4,$5)', [
    input.id, input.family, input.name, input.sku, input.createdAt,
  ])
}

export async function updatePattern(input: { id: string; family: string; name: string }): Promise<void> {
  const d = await getDb()
  await d.execute('UPDATE patterns SET family=$1, name=$2 WHERE id=$3', [input.family, input.name, input.id])
}

export async function deletePattern(id: string): Promise<void> {
  const d = await getDb()
  await d.execute('DELETE FROM patterns WHERE id=$1', [id])
}

export async function nextPatternSkuByFamilyName(familyDisplayName: string): Promise<{ code: string; sku: string }> {
  const { code } = await ensurePatternFamilyCode(familyDisplayName)
  const sku = await nextPatternSkuByCode(code)
  return { code, sku }
}

// ===== Raw CRUD for import/export (preserves all fields including IDs and images) =====
import type { Tissue } from '@/types/tissue'
import type { Color } from '@/types/color'
import type { TecidoCor } from '@/types/tecidoCor'
// use previously declared TecidoEstampa type alias from this module section

export async function createTissueRaw(t: Tissue) {
  const d = await getDb()
  await d.execute('INSERT OR REPLACE INTO tissues (id, name, width, composition, sku, color, created_at) VALUES ($1,$2,$3,$4,$5,$6,$7)', [
    t.id, t.name, t.width, t.composition, t.sku, t.color ?? null, t.createdAt,
  ])
}

export async function updateTissueRaw(t: Tissue) {
  const d = await getDb()
  await d.execute('UPDATE tissues SET name=$1, width=$2, composition=$3, color=$4, created_at=$5 WHERE id=$6', [
    t.name, t.width, t.composition, t.color ?? null, t.createdAt, t.id,
  ])
}

export async function createColorRaw(c: Color) {
  const d = await getDb()
  await d.execute('INSERT OR REPLACE INTO colors (id, name, hex, labL, labA, labB, sku, created_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)', [
    c.id, c.name, c.hex ?? null, c.labL ?? null, c.labA ?? null, c.labB ?? null, c.sku, c.createdAt,
  ])
}

export async function updateColorRaw(c: Color) {
  const d = await getDb()
  await d.execute('UPDATE colors SET name=$1, hex=$2, labL=$3, labA=$4, labB=$5, created_at=$6 WHERE id=$7', [
    c.name, c.hex ?? null, c.labL ?? null, c.labA ?? null, c.labB ?? null, c.createdAt, c.id,
  ])
}

export async function createPatternRaw(p: Pattern) {
  const d = await getDb()
  await d.execute('INSERT OR REPLACE INTO patterns (id, family, name, sku, created_at) VALUES ($1,$2,$3,$4,$5)', [
    p.id, p.family, p.name, p.sku, p.createdAt,
  ])
}

export async function updatePatternRaw(p: Pattern) {
  const d = await getDb()
  await d.execute('UPDATE patterns SET family=$1, name=$2, created_at=$3 WHERE id=$4', [
    p.family, p.name, p.createdAt, p.id,
  ])
}

export async function createTecidoCorRaw(l: TecidoCor) {
  const d = await getDb()
  await d.execute('INSERT OR REPLACE INTO tecido_cor (id, tissue_id, color_id, sku_filho, status, created_at, image, image_path, image_mime, image_hash, image_thumb) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)', [
    l.id, l.tissueId, l.colorId, l.skuFilho, l.status, l.createdAt,
    l.image ?? null, l.imagePath ?? null, l.imageMime ?? null, l.imageHash ?? null, l.imageThumb ?? null,
  ])
}

export async function updateTecidoCorRaw(l: TecidoCor) {
  const d = await getDb()
  await d.execute('UPDATE tecido_cor SET tissue_id=$1, color_id=$2, sku_filho=$3, status=$4, created_at=$5, image=$6, image_path=$7, image_mime=$8, image_hash=$9, image_thumb=$10 WHERE id=$11', [
    l.tissueId, l.colorId, l.skuFilho, l.status, l.createdAt,
    l.image ?? null, l.imagePath ?? null, l.imageMime ?? null, l.imageHash ?? null, l.imageThumb ?? null,
    l.id,
  ])
}

export async function createTecidoEstampaRaw(l: TecidoEstampa) {
  const d = await getDb()
  await d.execute('INSERT OR REPLACE INTO tecido_estampa (id, tissue_id, pattern_id, sku_filho, status, created_at, image, image_path, image_mime, image_hash, image_thumb) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)', [
    l.id, l.tissueId, l.patternId, l.skuFilho, l.status, l.createdAt,
    l.image ?? null, l.imagePath ?? null, l.imageMime ?? null, l.imageHash ?? null, l.imageThumb ?? null,
  ])
}

export async function updateTecidoEstampaRaw(l: TecidoEstampa) {
  const d = await getDb()
  await d.execute('UPDATE tecido_estampa SET tissue_id=$1, pattern_id=$2, sku_filho=$3, status=$4, created_at=$5, image=$6, image_path=$7, image_mime=$8, image_hash=$9, image_thumb=$10 WHERE id=$11', [
    l.tissueId, l.patternId, l.skuFilho, l.status, l.createdAt,
    l.image ?? null, l.imagePath ?? null, l.imageMime ?? null, l.imageHash ?? null, l.imageThumb ?? null,
    l.id,
  ])
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
  const d = await getDb()
  const rows = await d.select<Array<{
    family_name: string
    hue_min: number
    hue_max: number
    hue_avg: number
    color_count: number
    updated_at: string
  }>>('SELECT family_name, hue_min, hue_max, hue_avg, color_count, updated_at FROM family_stats ORDER BY hue_avg')
  
  return rows.map(r => ({
    familyName: r.family_name,
    hueMin: r.hue_min,
    hueMax: r.hue_max,
    hueAvg: r.hue_avg,
    colorCount: r.color_count,
    updatedAt: r.updated_at,
  }))
}

export async function updateFamilyStat(familyName: string, hue: number): Promise<void> {
  const d = await getDb()
  const updatedAt = new Date().toISOString()
  
  // Check if stat exists
  const existing = await d.select<Array<{
    hue_min: number
    hue_max: number
    hue_avg: number
    color_count: number
  }>>('SELECT hue_min, hue_max, hue_avg, color_count FROM family_stats WHERE family_name = $1', [familyName])
  
  if (existing.length === 0) {
    // First color in this family
    await d.execute(
      'INSERT INTO family_stats (family_name, hue_min, hue_max, hue_avg, color_count, updated_at) VALUES ($1, $2, $3, $4, $5, $6)',
      [familyName, hue, hue, hue, 1, updatedAt]
    )
  } else {
    // Update existing stat
    const stat = existing[0]
    const newCount = stat.color_count + 1
    const newMin = Math.min(stat.hue_min, hue)
    const newMax = Math.max(stat.hue_max, hue)
    // Incremental average: new_avg = old_avg + (new_value - old_avg) / new_count
    const newAvg = stat.hue_avg + (hue - stat.hue_avg) / newCount
    
    await d.execute(
      'UPDATE family_stats SET hue_min = $1, hue_max = $2, hue_avg = $3, color_count = $4, updated_at = $5 WHERE family_name = $6',
      [newMin, newMax, newAvg, newCount, updatedAt, familyName]
    )
  }
}

export async function clearFamilyStats(): Promise<void> {
  const d = await getDb()
  await d.execute('DELETE FROM family_stats')
}

