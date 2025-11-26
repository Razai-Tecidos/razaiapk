import { describe, it, expect } from 'vitest'
import { importFromContent } from '@/lib/import'
import type { Tissue } from '@/types/tissue'
import type { Color, ColorInput } from '@/types/color'

function makeId(prefix: string, n: number) {
  return `${prefix}${n}`
}

describe('Importação de vínculos (JSON/CSV)', () => {
  it('Cria tecidos, cores e vínculos a partir de JSON', async () => {
    // estado simulado do banco
    const tissues: Tissue[] = []
    const colors: Color[] = []
    const links = new Set<string>()
    let tSeq = 1, cSeq = 1

    const deps = {
      async listTissues() { return [...tissues].sort((a,b)=> (b.createdAt||'').localeCompare(a.createdAt||'')) },
      async listColors() { return [...colors].sort((a,b)=> (b.createdAt||'').localeCompare(a.createdAt||'')) },
      async createTissue(input: { name:string; width:number; composition:string }) {
        const id = makeId('TID', tSeq)
        const sku = `T${String(tSeq).padStart(3,'0')}`
        const created: Tissue = { id, name: input.name, width: input.width, composition: input.composition, createdAt: new Date(2025,0,1,tSeq).toISOString(), sku }
        tissues.unshift(created)
        tSeq++
        return created
      },
      async createColor(input: ColorInput) {
        const id = makeId('CID', cSeq)
        const sku = `AZ${String(cSeq).padStart(3,'0')}`
        const created: Color = { id, name: input.name, hex: input.hex, labL: input.labL, labA: input.labA, labB: input.labB, createdAt: new Date(2025,0,1,cSeq).toISOString(), sku }
        colors.unshift(created)
        cSeq++
        return created
      },
      async createManyLinks(tissueId: string, colorIds: string[]) {
        let created = 0, duplicates = 0
        for (const cid of colorIds) {
          const key = `${tissueId}|${cid}`
          if (links.has(key)) duplicates++
          else { links.add(key); created++ }
        }
        return { created, duplicates }
      },
    }

    const json = JSON.stringify({ items: [
      { tissueName: 'Linho', width: 150, composition: '100% linho', colorName: 'Azul', hex: '#336699' },
      { tissueName: 'Linho', width: 150, composition: '100% linho', colorName: 'Verde', hex: '#00aa00' },
    ]})

    const res1 = await importFromContent('dados.json', json, ',', deps)
    expect(res1.createdT).toBe(1)
    expect(res1.createdC).toBe(2)
    expect(res1.createdL).toBe(2)
    expect(res1.duplicates).toBe(0)

    // repetindo deve resultar em duplicados de vínculos (tecido/cor já existentes)
    const res2 = await importFromContent('dados.json', json, ',', deps)
    expect(res2.createdT).toBe(0)
    expect(res2.createdC).toBe(0)
    expect(res2.createdL).toBe(0)
    expect(res2.duplicates).toBe(2)
  })

  it('Lê CSV com delimitador ; e mapeia colunas exportadas', async () => {
    const tissues: Tissue[] = [
      { id: 'TID1', name: 'Tecido 1', width: 160, composition: '—', sku: 'T001', createdAt: '2025-01-01T00:00:00.000Z' }
    ]
    const colors: Color[] = []
    const links = new Set<string>()
    let cSeq = 1

    const deps = {
      async listTissues() { return tissues },
      async listColors() { return colors },
      async createTissue() { return undefined },
      async createColor(input: ColorInput) {
        const id = makeId('CID', cSeq)
        const sku = `AM${String(cSeq).padStart(3,'0')}`
        const created: Color = { id, name: input.name, hex: input.hex, labL: input.labL, labA: input.labA, labB: input.labB, createdAt: '2025-01-01T00:00:00.000Z', sku }
        colors.push(created)
        cSeq++
        return created
      },
      async createManyLinks(tissueId: string, colorIds: string[]) {
        let created = 0, duplicates = 0
        for (const cid of colorIds) {
          const key = `${tissueId}|${cid}`
          if (links.has(key)) duplicates++
          else { links.add(key); created++ }
        }
        return { created, duplicates }
      },
    }

    const header = 'sku_filho;nome_completo;tecido_nome;tecido_sku;cor_nome;cor_sku;familia;hex;largura;composicao;status;data_criacao;tissue_id;color_id\n'
    const row = 'T001-AM001;"Tecido 1 Amarelo";Tecido 1;T001;Amarelo;;Amarelos;#FFC400;160;100% algodão;Ativo;2025-01-01T00:00:00.000Z;;\n'
    const csv = header + row

    const res = await importFromContent('links.csv', csv, ';', deps)
    expect(res.createdT).toBe(0) // tecido já existia
    expect(res.createdC).toBe(1)
    expect(res.createdL).toBe(1)
    expect(res.duplicates).toBe(0)
  })

  it('Importa backup JSON completo sem arrays de vínculos (ausentes) e não cria nada', async () => {
    const json = JSON.stringify({
      schema: 'razai-tools.full-export',
      version: 3,
      generatedAt: new Date().toISOString(),
      counts: { tissues: 1, colors: 1, patterns: 1, links: 0, patternLinks: 0 },
      tissues: [ { id:'t1', name:'Helanca', width:160, composition:'—', sku:'T001', createdAt:'2025-01-01T00:00:00.000Z' } ],
      colors: [ { id:'c1', name:'Azul Razai', sku:'AZ001', createdAt:'2025-01-01T00:00:00.000Z' } ],
      patterns: [ { id:'p1', family:'Jardim', name:'Pink', sku:'JA001', createdAt:'2025-01-02T00:00:00.000Z' } ]
      // links e patternLinks ausentes de propósito
    })
    const deps = {
      async listTissues() { return [] },
      async listColors() { return [] },
      async createTissue() { return undefined },
      async createColor() { return undefined },
      async createManyLinks() { return { created: 0, duplicates: 0 } },
    }
    const res = await importFromContent('backup.json', json, ',', deps as any)
    expect(res).toEqual({ createdT: 0, createdC: 0, createdL: 0, duplicates: 0 })
  })
})
