import { supabase, isSupabaseConfigured } from '../supabase'
import type { Tissue, TissueInput } from '@/types/tissue'
import type { Color, ColorInput } from '@/types/color'
import type { TecidoCor, TecidoCorView } from '@/types/tecidoCor'
import { detectFamilyFromName, familyCodeFor, inferFamilyFrom, labHueAngle } from '../color-utils'
import type { Pattern, PatternInput } from '@/types/pattern'
import type { TecidoEstampa, TecidoEstampaView } from '@/types/tecidoEstampa'
import { DEFAULT_DE_THRESHOLD } from '@/lib/settings'
import * as idb from './indexeddb'

export type FamilyStat = {
  familyName: string
  hueMin: number | null
  hueMax: number | null
  hueAvg: number | null
  colorCount: number
  updatedAt: string | null
}

const useLocalDb = import.meta.env.MODE === 'test' || !isSupabaseConfigured()

// --- SETTINGS (Local Storage) ---
// Settings are kept local to the device
const SETTINGS_PREFIX = 'razai_settings_'

export const settingsDb = {
  async getCompressionQuality(): Promise<number> {
    const v = localStorage.getItem(SETTINGS_PREFIX + 'compression_quality')
    const n = Number(v)
    return Number.isFinite(n) && n > 0 && n <= 1 ? n : 0.8
  },
  async setCompressionQuality(value: number): Promise<void> {
    const n = Math.max(0.1, Math.min(1, value))
    localStorage.setItem(SETTINGS_PREFIX + 'compression_quality', String(n))
  },
  async getDeltaThreshold(): Promise<number> {
    const v = localStorage.getItem(SETTINGS_PREFIX + 'delta_threshold')
    const n = v ? Number(v) : DEFAULT_DE_THRESHOLD
    return Number.isFinite(n) && n > 0 ? n : DEFAULT_DE_THRESHOLD
  },
  async setDeltaThreshold(value: number) {
    localStorage.setItem(SETTINGS_PREFIX + 'delta_threshold', String(value))
  },
  async getHueBoundaries(): Promise<any> {
    const v = localStorage.getItem(SETTINGS_PREFIX + 'hue_boundaries')
    const parsed = v ? JSON.parse(v) : undefined
    if (parsed && (parsed as any).cianoStart !== undefined) {
      const c = (parsed as any).cianoStart
      return { ...parsed, verdeEnd: parsed.verdeEnd ?? c, azulStart: parsed.azulStart ?? c }
    }
    return parsed
  },
  async setHueBoundaries(bounds: any): Promise<void> {
    localStorage.setItem(SETTINGS_PREFIX + 'hue_boundaries', JSON.stringify(bounds))
  },
  async getFrontierPreference(): Promise<'green'|'blue'|'none'> {
    const v = localStorage.getItem(SETTINGS_PREFIX + 'hue_frontier_pref')
    return (v === 'green' || v === 'blue' || v === 'none') ? v : 'green'
  },
  async setFrontierPreference(v: 'green'|'blue'|'none'): Promise<void> {
    localStorage.setItem(SETTINGS_PREFIX + 'hue_frontier_pref', v)
  },
  async getHueWheelVisualRotation(): Promise<number> {
    const v = localStorage.getItem(SETTINGS_PREFIX + 'hue_visual_rotation')
    const n = Number(v)
    return Number.isFinite(n) ? ((n % 360) + 360) % 360 : 0
  },
  async setHueWheelVisualRotation(value: number): Promise<void> {
    const n = ((Number(value) % 360) + 360) % 360
    localStorage.setItem(SETTINGS_PREFIX + 'hue_visual_rotation', String(n))
  },
  async getHueWheelOffsetDeg(): Promise<number> {
    const v = localStorage.getItem(SETTINGS_PREFIX + 'hue_wheel_offset_deg')
    const n = Number(v)
    return Number.isFinite(n) ? ((n % 360) + 360) % 360 : 0
  },
  async setHueWheelOffsetDeg(value: number): Promise<void> {
    const n = ((Number(value) % 360) + 360) % 360
    localStorage.setItem(SETTINGS_PREFIX + 'hue_wheel_offset_deg', String(n))
  }
}

// --- SUPABASE DB IMPLEMENTATION ---

export const db = {
  async init() {
    if (useLocalDb) {
      await idb.getDb()
      return
    }
    // No initialization needed for Supabase client
    console.log('[db] Connected to Supabase')
  },
  
  // Tissues
  async listTissues(): Promise<Tissue[]> {
    if (useLocalDb) {
      return idb.listTissues() as Promise<Tissue[]>
    }
    const { data, error } = await supabase.from('tissues').select('*').order('created_at', { ascending: false })
    if (error) throw error
    return data as Tissue[]
  },
  async createTissue(input: TissueInput) {
    if (useLocalDb) {
      const existing = await idb.listTissues()
      const sku = nextSequentialSku(existing.map(t => t.sku))
      const tissue: Tissue = {
        id: crypto.randomUUID(),
        name: input.name,
        width: input.width,
        composition: input.composition,
        sku,
        color: input.color,
        createdAt: new Date().toISOString()
      }
      await idb.createTissue(tissue)
      return
    }
    const id = crypto.randomUUID()
    // Generate SKU
    const { data: existing } = await supabase.from('tissues').select('sku')
    const sku = nextSequentialSku((existing || []).map(x => x.sku))
    
    const { error } = await supabase.from('tissues').insert({
      id,
      sku,
      name: input.name,
      width: input.width,
      composition: input.composition
    })
    if (error) throw error
  },
  async updateTissue(input: { id: string } & TissueInput) {
    if (useLocalDb) {
      await idb.updateTissue({
        id: input.id,
        name: input.name,
        width: input.width,
        composition: input.composition,
        color: input.color
      })
      return
    }
    const { error } = await supabase.from('tissues').update({
      name: input.name,
      width: input.width,
      composition: input.composition
    }).eq('id', input.id)
    if (error) throw error
  },
  async deleteTissue(id: string) {
    if (useLocalDb) {
      await idb.deleteTissue(id)
      return
    }
    const { error } = await supabase.from('tissues').delete().eq('id', id)
    if (error) throw error
  }
}

function nextSequentialSku(existingSkus: string[]) {
  let max = 0
  for (const s of existingSkus) {
    const m = /^T(\d+)$/.exec(s)
    if (m) {
      const n = parseInt(m[1], 10)
      if (!Number.isNaN(n)) max = Math.max(max, n)
    }
  }
  const next = max + 1
  const padded = String(next).padStart(3, '0')
  return `T${padded}`
}

// Colors API
export const colorsDb = {
  async listColors(): Promise<Color[]> {
    if (useLocalDb) {
      return idb.listColors() as Promise<Color[]>
    }
    const { data, error } = await supabase.from('colors').select('*').order('created_at', { ascending: false })
    if (error) throw error
    // Map snake_case to camelCase if needed, but Supabase returns as is. 
    // Our types expect camelCase (labL, labA, labB). 
    // Supabase columns are lab_l, lab_a, lab_b. We need to map.
    return (data || []).map(mapColorFromSupabase)
  },
  async createColor(input: ColorInput) {
    if (useLocalDb) {
      const id = crypto.randomUUID()
      const family = (() => {
        const fromName = detectFamilyFromName(input.name)
        if (fromName) return fromName
        const fromSpec = inferFamilyFrom({ hex: input.hex, labL: input.labL, labA: input.labA, labB: input.labB })
        return (fromSpec && fromSpec !== '—') ? fromSpec : 'Outros'
      })()
      const code = familyCodeFor(family)
      const sku = await idb.nextColorSkuByFamilyCode(code)
      const createdAt = new Date().toISOString()
      const color: Color = {
        id,
        name: input.name,
        hex: input.hex,
        labL: input.labL,
        labA: input.labA,
        labB: input.labB,
        sku,
        createdAt
      }
      await idb.createColor(color)
      if (typeof input.labL === 'number' && typeof input.labA === 'number' && typeof input.labB === 'number') {
        const hue = labHueAngle({ L: input.labL, a: input.labA, b: input.labB })
        await idb.updateFamilyStat(family, hue)
      }
      return
    }
    const id = crypto.randomUUID()
    
    // Family logic
    const family = (() => {
      const fromName = detectFamilyFromName(input.name)
      if (fromName) return fromName
      const fromSpec = inferFamilyFrom({ hex: input.hex, labL: input.labL, labA: input.labA, labB: input.labB })
      return (fromSpec && fromSpec !== '—') ? fromSpec : 'Outros'
    })()
    const code = familyCodeFor(family)
    
    // SKU Logic: Count existing in family to generate next
    // This is a simple approximation. For robust multi-user, we'd need a sequence table or atomic increment.
    // Fetch all colors to calculate next SKU (same as local logic)
    const { data: allColors } = await supabase.from('colors').select('sku')
    const familySkus = (allColors || [])
      .map(c => c.sku)
      .filter(s => s.startsWith(code))
    
    let maxSeq = 0
    for (const s of familySkus) {
      const seq = parseInt(s.substring(code.length), 10)
      if (!isNaN(seq)) maxSeq = Math.max(maxSeq, seq)
    }
    const sku = `${code}${String(maxSeq + 1).padStart(3, '0')}`

    const { error } = await supabase.from('colors').insert({
      id,
      sku,
      name: input.name,
      hex: input.hex,
      lab_l: input.labL,
      lab_a: input.labA,
      lab_b: input.labB
    })
    if (error) throw error
    
    // Update stats
    if (typeof input.labL === 'number' && typeof input.labA === 'number' && typeof input.labB === 'number') {
      const hue = labHueAngle({ L: input.labL, a: input.labA, b: input.labB })
      await familyStatsDb.updateStat(family, hue)
    }
  },
  async updateColor(input: { id: string } & ColorInput) {
    if (useLocalDb) {
      await idb.updateColor({
        id: input.id,
        name: input.name,
        hex: input.hex,
        labL: input.labL,
        labA: input.labA,
        labB: input.labB
      })
      return
    }
    const { error } = await supabase.from('colors').update({
      name: input.name,
      hex: input.hex,
      lab_l: input.labL,
      lab_a: input.labA,
      lab_b: input.labB
    }).eq('id', input.id)
    if (error) throw error
  },
  async deleteColor(id: string) {
    if (useLocalDb) {
      await idb.deleteColor(id)
      return
    }
    const { error } = await supabase.from('colors').delete().eq('id', id)
    if (error) throw error
  },
  async clearAllColors(): Promise<{ colors: number; links: number; sequences: number }> {
    if (useLocalDb) {
      return idb.clearAllColors()
    }
    // Capture counts before deletion for simple reporting. Best-effort only.
    const [{ count: colorCount }, { count: linkCount }, { count: familyCount }] = await Promise.all([
      supabase.from('colors').select('*', { count: 'exact', head: true }),
      supabase.from('links').select('*', { count: 'exact', head: true }),
      supabase.from('family_stats').select('*', { count: 'exact', head: true })
    ])

    const colorDel = await supabase.from('colors').delete()
    if (colorDel.error) throw colorDel.error

    const linkDel = await supabase.from('links').delete()
    if (linkDel.error) throw linkDel.error

    const familyDel = await supabase.from('family_stats').delete()
    if (familyDel.error) throw familyDel.error

    return {
      colors: colorCount ?? 0,
      links: linkCount ?? 0,
      sequences: familyCount ?? 0
    }
  },
  async recalculateAllColorSkus() {
    if (useLocalDb) {
      const colors = await idb.listColors()
      const byFamily = new Map<string, Color[]>()
      for (const color of colors) {
        const fromName = detectFamilyFromName(color.name)
        let family = fromName || 'Outros'
        if (!fromName) {
          const fromSpec = inferFamilyFrom({ hex: color.hex, labL: color.labL, labA: color.labA, labB: color.labB })
          if (fromSpec && fromSpec !== '—') family = fromSpec
        }
        if (!byFamily.has(family)) byFamily.set(family, [])
        byFamily.get(family)!.push(color)
      }

      let totalUpdated = 0
      for (const [family, familyColors] of byFamily.entries()) {
        const code = familyCodeFor(family)
        familyColors.sort((a, b) => (a.createdAt || '').localeCompare(b.createdAt || ''))
        for (let i = 0; i < familyColors.length; i++) {
          const color = familyColors[i]
          const newSku = `${code}${String(i + 1).padStart(3, '0')}`
          if (color.sku !== newSku) {
            await idb.updateColorRaw({ ...color, sku: newSku })
          }
          totalUpdated++
        }
      }
      return { totalUpdated, familiesProcessed: byFamily.size }
    }
    // This is complex to port 1:1 safely without a transaction script, 
    // but we can do it client-side logic + updates
    console.log('[Migration] Starting color SKU recalculation (Supabase)...')
    const colors = await this.listColors()
    
    const colorsByNewFamily = new Map<string, Color[]>()
    for (const color of colors) {
      const fromName = detectFamilyFromName(color.name)
      let family = fromName || 'Outros'
      if (!fromName) {
        const fromSpec = inferFamilyFrom({ hex: color.hex, labL: color.labL, labA: color.labA, labB: color.labB })
        if (fromSpec && fromSpec !== '—') family = fromSpec
      }
      if (!colorsByNewFamily.has(family)) colorsByNewFamily.set(family, [])
      colorsByNewFamily.get(family)!.push(color)
    }

    let totalUpdated = 0
    for (const [family, familyColors] of colorsByNewFamily.entries()) {
      const code = familyCodeFor(family)
      // Sort by created_at
      familyColors.sort((a, b) => (a.createdAt || '').localeCompare(b.createdAt || ''))
      
      for (let i = 0; i < familyColors.length; i++) {
        const color = familyColors[i]
        const seq = i + 1
        const newSku = `${code}${String(seq).padStart(3, '0')}`
        
        if (color.sku !== newSku) {
          await supabase.from('colors').update({ sku: newSku }).eq('id', color.id)
        }
        totalUpdated++
      }
    }
    return { totalUpdated, familiesProcessed: colorsByNewFamily.size }
  }
}

function mapColorFromSupabase(c: any): Color {
  return {
    id: c.id,
    sku: c.sku,
    name: c.name,
    hex: c.hex,
    labL: c.lab_l,
    labA: c.lab_a,
    labB: c.lab_b,
    createdAt: c.created_at
  }
}

// Patterns API
export const patternsDb = {
  async listPatterns(): Promise<Pattern[]> {
    if (useLocalDb) {
      return idb.listPatterns() as Promise<Pattern[]>
    }
    const { data, error } = await supabase.from('patterns').select('*').order('created_at', { ascending: false })
    if (error) throw error
    return data as Pattern[]
  },
  async createPattern(input: PatternInput) {
    if (useLocalDb) {
      const id = crypto.randomUUID()
      const familyDisplay = (input.family || '').trim()
      if (!familyDisplay) throw new Error('Família obrigatória')
      const { sku } = await idb.nextPatternSkuByFamilyName(familyDisplay)
      const pattern: Pattern = {
        id,
        family: familyDisplay,
        name: (input.name || '').trim(),
        sku,
        createdAt: new Date().toISOString()
      }
      await idb.createPattern(pattern)
      return
    }
    const id = crypto.randomUUID()
    const familyDisplay = (input.family || '').trim()
    if (!familyDisplay) throw new Error('Família obrigatória')
    
    // SKU Logic
    const { data: existing } = await supabase.from('patterns').select('sku').eq('family', familyDisplay)
    let maxSeq = 0
    const prefix = familyDisplay.substring(0, 2).toUpperCase()
    for (const p of existing || []) {
      const m = new RegExp(`^${prefix}(\\d+)$`).exec(p.sku)
      if (m) {
        const n = parseInt(m[1], 10)
        if (!isNaN(n)) maxSeq = Math.max(maxSeq, n)
      }
    }
    const sku = `${prefix}${String(maxSeq + 1).padStart(3, '0')}`

    const { error } = await supabase.from('patterns').insert({
      id,
      sku,
      family: familyDisplay,
      name: (input.name || '').trim()
    })
    if (error) throw error
  },
  async updatePattern(input: { id: string } & PatternInput) {
    if (useLocalDb) {
      await idb.updatePattern({ id: input.id, family: input.family, name: input.name })
      return
    }
    const { error } = await supabase.from('patterns').update({
      name: input.name,
      family: input.family
    }).eq('id', input.id)
    if (error) throw error
  },
  async deletePattern(id: string) {
    if (useLocalDb) {
      await idb.deletePattern(id)
      return
    }
    const { error } = await supabase.from('patterns').delete().eq('id', id)
    if (error) throw error
  }
}

// Family Stats
export const familyStatsDb = {
  async list(): Promise<FamilyStat[]> {
    if (useLocalDb) {
      const stats = await idb.listFamilyStats()
      return stats.map((s) => ({
        familyName: s.familyName,
        hueMin: s.hueMin,
        hueMax: s.hueMax,
        hueAvg: s.hueAvg,
        colorCount: s.colorCount,
        updatedAt: s.updatedAt
      }))
    }
    const { data, error } = await supabase.from('family_stats').select('*')
    if (error) throw error
    return (data || []).map((s: any): FamilyStat => ({
      familyName: s.family_name,
      hueMin: s.hue_min ?? null,
      hueMax: s.hue_max ?? null,
      hueAvg: s.hue_avg ?? null,
      colorCount: s.color_count ?? 0,
      updatedAt: s.updated_at ?? null
    }))
  },
  async updateStat(familyName: string, hue: number): Promise<void> {
    if (useLocalDb) {
      await idb.updateFamilyStat(familyName, hue)
      return
    }
    // We need to fetch current stats to update average/min/max
    // Or we can just insert a new color and let a trigger handle it? 
    // For now, let's do a simple upsert logic client side or just ignore complex stats for MVP
    // The original logic was complex. Let's simplify: just update the count and avg roughly
    
    const { data: current } = await supabase.from('family_stats').select('*').eq('family_name', familyName).single()
    
    let newCount = 1
    let newAvg = hue
    let newMin = hue
    let newMax = hue
    
    if (current) {
      newCount = (current.color_count || 0) + 1
      // Simple moving average approximation
      newAvg = ((current.hue_avg || 0) * (newCount - 1) + hue) / newCount
      newMin = Math.min(current.hue_min || hue, hue)
      newMax = Math.max(current.hue_max || hue, hue)
    }

    const { error } = await supabase.from('family_stats').upsert({
      family_name: familyName,
      hue_min: newMin,
      hue_max: newMax,
      hue_avg: newAvg,
      color_count: newCount,
      updated_at: new Date().toISOString()
    })
    if (error) throw error
  },
  async recalculateAll() {
    if (useLocalDb) {
      await idb.clearFamilyStats()
      const colors = await colorsDb.listColors()
      const families = new Set<string>()
      for (const c of colors) {
        if (typeof c.labL === 'number' && typeof c.labA === 'number' && typeof c.labB === 'number') {
          const hue = labHueAngle({ L: c.labL, a: c.labA, b: c.labB })
          const fromName = detectFamilyFromName(c.name)
          let family = fromName || 'Outros'
          if (!fromName) {
            const fromSpec = inferFamilyFrom({ hex: c.hex, labL: c.labL, labA: c.labA, labB: c.labB })
            if (fromSpec && fromSpec !== '—') family = fromSpec
          }
          families.add(family)
          await idb.updateFamilyStat(family, hue)
        }
      }
      return { totalFamilies: families.size, totalColors: colors.length }
    }
    // Reset stats
    await supabase.from('family_stats').delete()
    
    const colors = await colorsDb.listColors()
    const families = new Set<string>()
    for (const c of colors) {
      if (typeof c.labL === 'number' && typeof c.labA === 'number' && typeof c.labB === 'number') {
        const hue = labHueAngle({ L: c.labL, a: c.labA, b: c.labB })
        // Infer family
        const fromName = detectFamilyFromName(c.name)
        let family = fromName || 'Outros'
        if (!fromName) {
          const fromSpec = inferFamilyFrom({ hex: c.hex, labL: c.labL, labA: c.labA, labB: c.labB })
          if (fromSpec && fromSpec !== '—') family = fromSpec
        }
        families.add(family)
        await this.updateStat(family, hue)
      }
    }
    return { totalFamilies: families.size, totalColors: colors.length }
  }
}

// Links (Tecido-Cor)
export const linksDb = {
  async list(): Promise<TecidoCorView[]> {
    if (useLocalDb) {
      return idb.listTecidoCor()
    }
    // Join tissues and colors
    const { data, error } = await supabase
      .from('links')
      .select(`
        *,
        tissues (sku, name, width, composition),
        colors (sku, name, hex, lab_l, lab_a, lab_b)
      `)
      .order('created_at', { ascending: false })
      
    if (error) throw error
    
    return (data || []).map((l: any) => {
      const t = l.tissues
      const c = l.colors
      const family = c ? inferFamilyFrom({ hex: c.hex, labL: c.lab_l, labA: c.lab_a, labB: c.lab_b }) : '—'
      
      return {
        id: l.id,
        tissueId: l.tissue_id,
        colorId: l.color_id,
        skuFilho: l.sku_filho,
        status: l.status,
        image: l.image_path ? supabase.storage.from('tissue-images').getPublicUrl(l.image_path).data.publicUrl : undefined,
        image_path: l.image_path,
        createdAt: l.created_at,
        
        tissueSku: t?.sku,
        tissueName: t?.name,
        width: t?.width,
        composition: t?.composition,
        colorSku: c?.sku,
        colorName: c?.name,
        family: family && family !== '—' ? family : '—',
        hex: c?.hex,
        nomeCompleto: `${t?.name || ''} ${c?.name || ''}`
      }
    })
  },
  async listRaw(): Promise<TecidoCor[]> {
    if (useLocalDb) {
      return idb.listTecidoCorRaw()
    }
    const { data, error } = await supabase.from('links').select('*')
    if (error) throw error
    return data as any[]
  },
  async createMany(tissueId: string, colorIds: string[]): Promise<{ created: number; duplicates: number }> {
    if (useLocalDb) {
      return idb.createManyTecidoCor(tissueId, colorIds)
    }
    let created = 0
    let duplicates = 0
    
    // Get tissue SKU
    const { data: tissue } = await supabase.from('tissues').select('sku').eq('id', tissueId).single()
    if (!tissue) throw new Error('Tecido não encontrado')
    
    for (const colorId of colorIds) {
      // Get color SKU
      const { data: color } = await supabase.from('colors').select('sku').eq('id', colorId).single()
      if (!color) continue
      
      const skuFilho = `${tissue.sku}-${color.sku}`
      
      // Check duplicate
      const { data: existing } = await supabase.from('links').select('id').eq('sku_filho', skuFilho).single()
      if (existing) {
        duplicates++
        continue
      }
      
      const { error } = await supabase.from('links').insert({
        id: crypto.randomUUID(),
        tissue_id: tissueId,
        color_id: colorId,
        sku_filho: skuFilho,
        status: 'Ativo'
      })
      if (!error) created++
    }
    return { created, duplicates }
  },
  async updateStatus(id: string, status: 'Ativo'|'Inativo') {
    if (useLocalDb) {
      await idb.updateTecidoCorStatus(id, status)
      return
    }
    const { error } = await supabase.from('links').update({ status }).eq('id', id)
    if (error) throw error
  },
  async delete(id: string) {
    if (useLocalDb) {
      await idb.deleteTecidoCor(id)
      return
    }
    const { error } = await supabase.from('links').delete().eq('id', id)
    if (error) throw error
  },
  async setImageFull(id: string, file: File) {
    if (useLocalDb) {
      await idb.updateTecidoCorImageFull(id, file)
      return
    }
    const ext = file.name.split('.').pop()
    const path = `${id}.${ext}`
    
    const { error: uploadError } = await supabase.storage
      .from('tissue-images')
      .upload(path, file, { upsert: true })
      
    if (uploadError) throw uploadError
    
    const { error: updateError } = await supabase
      .from('links')
      .update({ image_path: path })
      .eq('id', id)
      
    if (updateError) throw updateError
  }
}

// Pattern Links
export const patternLinksDb = {
  async list(): Promise<TecidoEstampaView[]> {
    if (useLocalDb) {
      return idb.listTecidoEstampa()
    }
    const { data, error } = await supabase
      .from('pattern_links')
      .select(`
        *,
        tissues (sku, name, width, composition),
        patterns (sku, name, family)
      `)
      .order('created_at', { ascending: false })
      
    if (error) throw error
    
    return (data || []).map((l: any) => {
      const t = l.tissues
      const p = l.patterns
      
      return {
        id: l.id,
        tissueId: l.tissue_id,
        patternId: l.pattern_id,
        skuFilho: l.sku_filho,
        status: l.status,
        image: l.image_path ? supabase.storage.from('pattern-images').getPublicUrl(l.image_path).data.publicUrl : undefined,
        image_path: l.image_path,
        createdAt: l.created_at,
        
        tissueSku: t?.sku,
        tissueName: t?.name,
        width: t?.width,
        composition: t?.composition,
        patternSku: p?.sku,
        patternName: p?.name,
        patternFamily: p?.family,
        nomeCompleto: `${t?.name || ''} ${p?.family || ''} ${p?.name || ''}`
      }
    })
  },
  async listRaw(): Promise<TecidoEstampa[]> {
    if (useLocalDb) {
      return idb.listTecidoEstampaRaw()
    }
    const { data, error } = await supabase.from('pattern_links').select('*')
    if (error) throw error
    return data as any[]
  },
  async createMany(tissueId: string, patternIds: string[]) {
    if (useLocalDb) {
      return idb.createManyTecidoEstampa(tissueId, patternIds)
    }
    let created = 0
    const { data: tissue } = await supabase.from('tissues').select('sku').eq('id', tissueId).single()
    if (!tissue) throw new Error('Tecido não encontrado')

    for (const pid of patternIds) {
      const { data: pattern } = await supabase.from('patterns').select('sku').eq('id', pid).single()
      if (!pattern) continue
      
      const skuFilho = `${tissue.sku}-${pattern.sku}`
      const { data: existing } = await supabase.from('pattern_links').select('id').eq('sku_filho', skuFilho).single()
      if (existing) continue
      
      await supabase.from('pattern_links').insert({
        id: crypto.randomUUID(),
        tissue_id: tissueId,
        pattern_id: pid,
        sku_filho: skuFilho,
        status: 'Ativo'
      })
      created++
    }
    return { created, duplicates: 0 }
  },
  async updateStatus(id: string, status: 'Ativo'|'Inativo') {
    if (useLocalDb) {
      await idb.updateTecidoEstampaStatus(id, status)
      return
    }
    const { error } = await supabase.from('pattern_links').update({ status }).eq('id', id)
    if (error) throw error
  },
  async delete(id: string) {
    if (useLocalDb) {
      await idb.deleteTecidoEstampa(id)
      return
    }
    const { error } = await supabase.from('pattern_links').delete().eq('id', id)
    if (error) throw error
  },
  async setImageFull(id: string, file: File) {
    if (useLocalDb) {
      await idb.updateTecidoEstampaImageFull(id, file)
      return
    }
    const ext = file.name.split('.').pop()
    const path = `${id}.${ext}`
    
    const { error: uploadError } = await supabase.storage
      .from('pattern-images')
      .upload(path, file, { upsert: true })
      
    if (uploadError) throw uploadError
    
    const { error: updateError } = await supabase
      .from('pattern_links')
      .update({ image_path: path })
      .eq('id', id)
      
    if (updateError) throw updateError
  }
}

// Sync DB (Legacy / Backup)
export const syncDb = {
  async exportAll() {
    if (useLocalDb) {
      const [tissues, colors, patterns, links, patternLinks, stats] = await Promise.all([
        idb.listTissues(),
        idb.listColors(),
        idb.listPatterns(),
        idb.listTecidoCorRaw(),
        idb.listTecidoEstampaRaw(),
        (async () => (await idb.listFamilyStats()).map((s) => ({
          familyName: s.familyName,
          hueMin: s.hueMin,
          hueMax: s.hueMax,
          hueAvg: s.hueAvg,
          colorCount: s.colorCount,
          updatedAt: s.updatedAt
        })) )()
      ])

      return {
        version: '1.0',
        exportedAt: new Date().toISOString(),
        tissues,
        colors,
        patterns,
        tecidoCorLinks: links,
        tecidoEstampaLinks: patternLinks,
        familyStats: stats,
      }
    }
    return {
      version: '1.0',
      exportedAt: new Date().toISOString(),
      tissues: [],
      colors: [],
      patterns: [],
      tecidoCorLinks: [],
      tecidoEstampaLinks: [],
      familyStats: [],
    }
  },
  async importAll(_data?: any, _mode: 'merge' | 'replace' = 'merge') {
    if (useLocalDb) {
      const data = _data || {}
      const result = {
        tissuesInserted: 0,
        tissuesUpdated: 0,
        colorsInserted: 0,
        colorsUpdated: 0,
        patternsInserted: 0,
        patternsUpdated: 0,
        tecidoCorInserted: 0,
        tecidoCorUpdated: 0,
        tecidoEstampaInserted: 0,
        tecidoEstampaUpdated: 0,
      }

      const upsertArray = async <T extends { id?: string }>(items: T[] | undefined, updateFn: (item: T) => Promise<void>, insertedKey: keyof typeof result) => {
        if (!Array.isArray(items)) return
        for (const item of items) {
          if (!item) continue
          await updateFn(item)
          result[insertedKey] = (result[insertedKey] as number) + 1
        }
      }

      await upsertArray(data.tissues, idb.updateTissueRaw, 'tissuesInserted')
      await upsertArray(data.colors, idb.updateColorRaw, 'colorsInserted')
      await upsertArray(data.patterns, idb.updatePatternRaw, 'patternsInserted')
      await upsertArray(data.tecidoCorLinks, idb.updateTecidoCorRaw, 'tecidoCorInserted')
      await upsertArray(data.tecidoEstampaLinks, idb.updateTecidoEstampaRaw, 'tecidoEstampaInserted')

      if (Array.isArray(data.familyStats)) {
        await idb.clearFamilyStats()
        for (const stat of data.familyStats) {
          if (!stat) continue
          await idb.updateFamilyStat(stat.familyName, stat.hueAvg ?? 0)
        }
      }

      return result
    }
    return {
      tissuesInserted: 0,
      tissuesUpdated: 0,
      colorsInserted: 0,
      colorsUpdated: 0,
      patternsInserted: 0,
      patternsUpdated: 0,
      tecidoCorInserted: 0,
      tecidoCorUpdated: 0,
      tecidoEstampaInserted: 0,
      tecidoEstampaUpdated: 0,
    }
  }
}
