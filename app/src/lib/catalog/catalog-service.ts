import { CatalogFilters, CatalogItem } from '@/types/catalog'
import { db, linksDb, patternLinksDb } from '@/lib/db'

// Simple in-memory cache. Invalidated manually after CRUD mutations.
let _cache: CatalogItem[] | null = null
let _cacheTs = 0
const CACHE_MAX_MS = 60_000

export async function buildCatalogItems(force = false): Promise<CatalogItem[]> {
  if (!force && _cache && Date.now() - _cacheTs < CACHE_MAX_MS) return _cache

  const [tissues, links, patternLinks] = await Promise.all([
    db.listTissues(),
    linksDb.list(),
    patternLinksDb.list(),
  ])

  const groupedColors = new Map<string, CatalogItem['colors']>()
  const groupedPatterns = new Map<string, CatalogItem['patterns']>()

  for (const l of links) {
    const arr = groupedColors.get(l.tissueId) || []
    arr.push({
      colorId: l.colorId as any,
      colorName: l.colorName,
      colorSku: l.colorSku,
      hex: l.hex || '',
      family: l.family,
      skuFilho: l.skuFilho,
      status: l.status,
      createdAt: l.createdAt,
      imageThumb: l.imageThumb,
      imagePath: l.imagePath,
    })
    groupedColors.set(l.tissueId, arr)
  }

  for (const pl of patternLinks) {
    const arr = groupedPatterns.get(pl.tissueId) || []
    arr.push({
      patternId: pl.patternId as any,
      patternName: pl.patternName,
      patternSku: pl.patternSku,
      family: pl.patternFamily,
      skuFilho: pl.skuFilho,
      status: pl.status,
      createdAt: pl.createdAt,
      imageThumb: pl.imageThumb,
      imagePath: pl.imagePath,
    })
    groupedPatterns.set(pl.tissueId, arr)
  }

  const items: CatalogItem[] = tissues.map(t => ({
    tissueId: (t as any).id,
    tissueName: (t as any).name,
    tissueSku: (t as any).sku,
    composition: (t as any).composition,
    width: (t as any).width,
    colors: groupedColors.get((t as any).id) || [],
    patterns: groupedPatterns.get((t as any).id) || [],
  }))

  _cache = items
  _cacheTs = Date.now()
  return items
}

export function invalidateCatalogCache() {
  _cache = null
  _cacheTs = 0
}

export function filterCatalog(items: CatalogItem[], f: CatalogFilters): CatalogItem[] {
  return items.filter(item => {
    if (f.fabricType && item.fabricType !== f.fabricType) return false
    if (f.minWidth && (item.width ?? 0) < f.minWidth) return false
    if (f.maxWidth && (item.width ?? 0) > f.maxWidth) return false
    if (f.onlyActive) {
      const hasActive = item.colors.some(c => c.status === 'Ativo') || item.patterns.some(p => p.status === 'Ativo')
      if (!hasActive) return false
    }
    if (f.families && f.families.length) {
      const inFamilies = item.colors.some(c => f.families!.includes(c.family)) || item.patterns.some(p => f.families!.includes(p.family))
      if (!inFamilies) return false
    }
    if (f.search && f.search.trim()) {
      const s = f.search.toLowerCase()
      const hit = [item.tissueName, item.tissueSku, item.composition].some(v => v?.toLowerCase().includes(s)) ||
        item.colors.some(c => c.colorName.toLowerCase().includes(s) || c.colorSku.toLowerCase().includes(s)) ||
        item.patterns.some(p => p.patternName.toLowerCase().includes(s) || p.patternSku.toLowerCase().includes(s))
      if (!hit) return false
    }
    if (f.tags && f.tags.length) {
      const tags = item.tags || []
      if (!tags.some(t => f.tags!.includes(t))) return false
    }
    return true
  })
}
