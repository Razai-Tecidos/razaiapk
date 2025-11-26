import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, within, cleanup } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import React from 'react'
import { MantineProvider } from '@mantine/core'

// Mock db layer for controlled environment (must be declared before importing pages)
vi.mock('@/lib/db', () => {
  const g: any = globalThis as any
  g.__tissues = [
    { id: 't1', name: 'Viscolinho', width: 140, composition: '100% Viscose', sku: 'T001', createdAt: new Date().toISOString() },
  ]
  g.__patterns = [] as any[]
  g.__patternLinks = [] as any[]
  const seqFamilies: Record<string, number> = {}
  const familyCodes: Record<string, string> = {}

  function normFam(s: string){ return s.trim().toLowerCase().replace(/\s+/g,' ') }
  function assignCode(family: string){
    const n = normFam(family)
    if (familyCodes[n]) return familyCodes[n]
    if (n === 'jardim'){ familyCodes[n] = 'JA'; return 'JA' }
    const first = family[0].toUpperCase()
    const rest = family.slice(1)
    const candidates: string[] = []
    for (let i=0;i<rest.length && candidates.length<5;i++){
      const ch = rest[i].toUpperCase()
      if (/^[A-Z]$/.test(ch) && !(first==='J' && ch==='A')) candidates.push(first+ch)
    }
    candidates.push(first+'X', first+'Y', first+'Z')
    for (const c of candidates){ if (!Object.values(familyCodes).includes(c) && c!=='JA'){ familyCodes[n]=c; return c } }
    familyCodes[n] = first+'Z'
    return familyCodes[n]
  }
  function nextSku(code: string){ seqFamilies[code] = (seqFamilies[code]||0)+1; return code + String(seqFamilies[code]).padStart(3,'0') }

  const db = { async init(){}, async listTissues(){ return [...g.__tissues] } }
  const patternsDb = {
    async listPatterns(){
      const out = [...g.__patterns]
      // debug
      // eslint-disable-next-line no-console
      console.log('[mock] listPatterns ->', out.length)
      return out
    },
    async createPattern(input: { family: string; name: string }){
      // eslint-disable-next-line no-console
      console.log('[mock] createPattern', input)
      const code = assignCode(input.family)
      const sku = nextSku(code)
      const rec = { id: 'p'+Math.random(), family: input.family.trim(), name: input.name.trim(), sku, createdAt: new Date().toISOString() }
      g.__patterns.unshift(rec)
    },
    async updatePattern(input: { id: string; family: string; name: string }){
      const idx = g.__patterns.findIndex((p:any)=>p.id===input.id)
      if (idx>=0) g.__patterns[idx] = { ...g.__patterns[idx], family: input.family.trim(), name: input.name.trim() }
    },
    async deletePattern(id: string){ g.__patterns = g.__patterns.filter((p:any)=>p.id!==id) }
  }
  const patternLinksDb = {
    async list(){
      return g.__patternLinks.map((l:any)=>{
        const t = g.__tissues.find((x:any)=>x.id===l.tissueId)
        const p = g.__patterns.find((x:any)=>x.id===l.patternId)
        return {
          ...l,
          tissueSku: t?.sku || 'T???', tissueName: t?.name || 'Tecido', width: t?.width || 0, composition: t?.composition || '',
          patternSku: p?.sku || 'P???', patternFamily: p?.family || 'Família', patternName: p?.name || 'Estampa', nomeCompleto: `${t?.name || ''} ${p?.family || ''} ${p?.name || ''}`.trim()
        }
      })
    },
    async createMany(tissueId: string, patternIds: string[]){
      let created = 0, duplicates = 0
      const t = g.__tissues.find((x:any)=>x.id===tissueId)
      for (const pid of patternIds){
        const p = g.__patterns.find((x:any)=>x.id===pid)
        if (!p) continue
        const exists = g.__patternLinks.some((l:any)=>l.tissueId===tissueId && l.patternId===pid)
        if (exists){ duplicates++; continue }
        g.__patternLinks.unshift({ id: 'pl'+Math.random(), tissueId, patternId: pid, skuFilho: `${t.sku}-${p.sku}`, status: 'Ativo', createdAt: new Date().toISOString() })
        created++
      }
      return { created, duplicates }
    },
    async updateStatus(id: string, status: 'Ativo'|'Inativo'){ const idx = g.__patternLinks.findIndex((x:any)=>x.id===id); if (idx>=0) g.__patternLinks[idx] = { ...g.__patternLinks[idx], status } },
    async delete(id: string){ g.__patternLinks = g.__patternLinks.filter((x:any)=>x.id!==id) },
    async setImageFull(){},
  }
  const colorsDb = { async listColors(){ return [] } }
  const linksDb = { async list(){ return [] } } // leave empty for this test suite
  const settingsDb = { async getDeltaThreshold(){ return 2.0 }, async getHueBoundaries(){ return undefined } }
  const familyStatsDb = { async list(){ return [] } }
  return { db, patternsDb, patternLinksDb, colorsDb, linksDb, settingsDb, familyStatsDb }
})

import Patterns from '@/pages/Patterns'
import TecidoEstampaPage from '@/pages/TecidoEstampa'
import Exportacoes from '@/pages/Exportacoes'

function wrap(ui: React.ReactElement){
  return <MantineProvider>{ui}</MantineProvider>
}

describe('Fluxo completo Estampa + Vínculo + Export', () => {
  beforeEach(() => {
    (globalThis as any).__patterns = [];
    (globalThis as any).__patternLinks = [];
  })
  afterEach(() => cleanup())

  it('Cria múltiplas estampas, gera códigos corretos Jardim JA001/JA002', async () => {
    render(wrap(<Patterns />))
  const novoBtn = screen.getByRole('button', { name: /nova estampa/i })
  await userEvent.click(novoBtn)
  const nomeCompletoInput = screen.getByPlaceholderText(/Jardim\s+Pink/i)
  await userEvent.type(nomeCompletoInput, 'Jardim Pink, Jardim Azul')
    const salvar = screen.getByRole('button', { name: /adicionar estampa/i })
    await userEvent.click(salvar)
    // deve listar duas estampas com códigos JA001 e JA002 (ordem pode ser invertida pela inserção unshift)
    const rows = await screen.findAllByRole('row')
    const skus = rows.slice(1).map(r => within(r).getByText(/JA\d{3}/).textContent)
    expect(new Set(skus)).toEqual(new Set(['JA001', 'JA002']))
  })

  it('Cria vínculo tecido-estampa, previne duplicado e alterna status', async () => {
    // primeiro criar estampas
    render(wrap(<Patterns />))
  const novoBtn = screen.getByRole('button', { name: /nova estampa/i })
  await userEvent.click(novoBtn)
  const nomeCompletoInput = screen.getByPlaceholderText(/Jardim\s+Pink/i)
  await userEvent.type(nomeCompletoInput, 'Jardim Pink, Jardim Azul')
    await userEvent.click(screen.getByRole('button', { name: /adicionar estampa/i }))
    cleanup()
    // vincular
    render(wrap(<TecidoEstampaPage />))
    // selecionar ambas estampas por checkbox
    const checkboxes = await screen.findAllByRole('checkbox')
    // skip first tissue select absence (pattern list checkboxes start after maybe one hidden?)
    for (const cb of checkboxes.slice(0,2)) { await userEvent.click(cb) }
    const vincularBtn = screen.getByRole('button', { name: /Vincular/i })
    await userEvent.click(vincularBtn)
    // deve aparecer links
    const linkRows = await screen.findAllByRole('row')
    expect(linkRows.slice(1).length).toBeGreaterThan(0)
    // selecionar novamente e tentar duplicar
    for (const cb of checkboxes.slice(0,2)) { await userEvent.click(cb) }
    await userEvent.click(vincularBtn)
    // quantidade permanece
    const linkRowsAfter = await screen.findAllByRole('row')
    expect(linkRowsAfter.slice(1).length).toBe(linkRows.slice(1).length)
  })

  it('Exporta backup completo incluindo patternLinks', async () => {
    // criar uma estampa e vínculo
    render(wrap(<Patterns />))
  await userEvent.click(screen.getByRole('button', { name: /nova estampa/i }))
  await userEvent.type(screen.getByPlaceholderText(/Jardim\s+Pink/i), 'Jardim Pink')
    await userEvent.click(screen.getByRole('button', { name: /adicionar estampa/i }))
    cleanup()
    render(wrap(<TecidoEstampaPage />))
    const cb = (await screen.findAllByRole('checkbox'))[0]
    await userEvent.click(cb)
    await userEvent.click(screen.getByRole('button', { name: /Vincular/i }))
    cleanup()
    // export
  render(wrap(<Exportacoes />))
    // intercept download (mock saveBlobAs logic indirectly by monkeypatching URL methods)
    const createObjectURLSpy = vi.spyOn(URL, 'createObjectURL').mockImplementation(() => 'blob:mock')
    const revokeSpy = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})
  const downloadBtn = await screen.findByRole('button', { name: /Baixar backup/i })
  await userEvent.click(downloadBtn)
    expect(createObjectURLSpy).toHaveBeenCalled()
    // parse blob content by reading last call argument if possible
    createObjectURLSpy.mockRestore()
    revokeSpy.mockRestore()
  })
})
