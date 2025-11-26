import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, within, cleanup } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import React from 'react'
import TecidoCorPage from '@/pages/TecidoCor'
import { MantineProvider } from '@mantine/core'
import { setHueBoundaries } from '@/lib/color-utils'

// Mock DB for links CRUD and filtering
vi.mock('@/lib/db', () => {
  const g: any = globalThis as any
  // stores
  g.__tissues = [
    { id: 't1', name: 'Tecido 1', width: 150, composition: '100% Algodão', sku: 'T001', createdAt: new Date().toISOString() },
  ]
  g.__colors = [
    { id: 'c1', name: 'Amarelo Sol', hex: '#FFC400', sku: 'AM001', createdAt: new Date().toISOString() },
    { id: 'c2', name: 'Azul Céu', hex: '#0066FF', sku: 'AZ001', createdAt: new Date().toISOString() },
  ]
  g.__links = []

  const db = {
    async init() {},
    async listTissues() { return [...g.__tissues] },
  }
  const colorsDb = { async listColors(){ return [...g.__colors] } }
  const linksDb = {
    async list(){
      const links = [...g.__links]
      return links.map((l:any)=>{
        const t = g.__tissues.find((x:any)=>x.id===l.tissueId)
        const c = g.__colors.find((x:any)=>x.id===l.colorId)
        return {
          ...l,
          tissueSku: t?.sku || 'T???',
          tissueName: t?.name || 'Tecido',
          width: t?.width || 0,
          composition: t?.composition || '',
          colorSku: c?.sku || 'C???',
          colorName: c?.name || 'Cor',
          family: c?.name.split(' ')[0] || '—',
          hex: c?.hex,
          nomeCompleto: `${t?.name || ''} ${c?.name || ''}`.trim(),
        }
      })
    },
    async createMany(tissueId: string, colorIds: string[]){
      let created = 0, duplicates = 0
      for (const cId of colorIds) {
        const t = g.__tissues[0]
        const c = g.__colors.find((x:any)=>x.id===cId)
        if (!c) continue
        const exists = g.__links.some((l:any)=>l.tissueId===tissueId && l.colorId===cId)
        if (exists) { duplicates++; continue }
        g.__links.unshift({ id: 'l'+Math.random(), tissueId, colorId: cId, skuFilho: `${t.sku}-${c.sku}`, status: 'Ativo', createdAt: new Date().toISOString(), imageThumb: undefined })
        created++
      }
      return { created, duplicates }
    },
    async updateStatus(id: string, status: 'Ativo'|'Inativo'){
      const idx = g.__links.findIndex((x:any)=>x.id===id)
      if (idx>=0) g.__links[idx] = { ...g.__links[idx], status }
    },
    async delete(id: string){
      g.__links = g.__links.filter((x:any)=>x.id!==id)
    },
    async setImageFull(){},
  }
  return { db, colorsDb, linksDb }
})

describe('Vínculo Tecido-Cor - CRUD e filtros', () => {
  beforeEach(() => {
    // Ensure family filters align with expected classic ranges
    setHueBoundaries({
      vermelhoStart: 345,
      laranjaStart: 20,
      amareloStart: 55,
      verdeStart: 95,
      verdeEnd: 170,
      azulStart: 170,
      roxoStart: 270,
      magentaStart: 310,
    })
    ;(globalThis as any).__links = []
    render(
      <MantineProvider>
        <TecidoCorPage />
      </MantineProvider>
    )
  })
  afterEach(() => cleanup())

  it('Cria múltiplos vínculos e previne duplicados', async () => {
    // selecionar tecido (lista à esquerda)
  const tecidoList = await screen.findByRole('listbox', { name: /Lista de Tecidos/i })
    const tecido1 = within(tecidoList).getByRole('option', { name: /Tecido 1/i })
    await userEvent.click(tecido1)
    // selecionar duas cores
  const amareloBtn = await screen.findByTitle('Amarelo Sol')
  const azulBtn = await screen.findByTitle('Azul Céu')
  await userEvent.click(amareloBtn)
  await userEvent.click(azulBtn)
    // gerar vínculos
    const gerarBtn = await screen.findByRole('button', { name: /gerar vínculo/i })
    expect(gerarBtn).toBeEnabled()
    await userEvent.click(gerarBtn)
    // deve ter 2 linhas de dados
    const rows = await screen.findAllByRole('row')
    expect(rows.length).toBeGreaterThan(2) // header + 2
    const bodyRows = rows.slice(1)
    expect(bodyRows.length).toBe(2)

    // re-selecionar as mesmas cores e tentar novamente
  await userEvent.click(amareloBtn)
  await userEvent.click(azulBtn)
    await userEvent.click(gerarBtn)

    // toast de duplicados deve aparecer
    const toast = await screen.findByRole('status')
    expect(toast.textContent || '').toMatch(/duplicado\(s\) ignorado\(s\)/i)

    // quantidade de linhas permanece 2
    const rowsAfter = await screen.findAllByRole('row')
    expect(rowsAfter.slice(1).length).toBe(2)
  })

  it('Alterna status Ativo/Inativo', async () => {
    // garantir um vínculo existente
  const tecidoList = await screen.findByRole('listbox', { name: /Lista de Tecidos/i })
    const tecido1 = within(tecidoList).getByRole('option', { name: /Tecido 1/i })
    await userEvent.click(tecido1)
  const amareloBtn = await screen.findByTitle('Amarelo Sol')
  await userEvent.click(amareloBtn)
    const gerarBtn = await screen.findByRole('button', { name: /gerar vínculo/i })
    await userEvent.click(gerarBtn)

    const rows = await screen.findAllByRole('row')
    const row = rows[1]
    expect(within(row).getByText(/Ativo/)).toBeInTheDocument()
    const toggleBtn = within(row).getByRole('button', { name: /Inativar/i })
    await userEvent.click(toggleBtn)
    // status deve virar Inativo
    await screen.findByText(/Inativo/)
  })

  it('Exclui vínculo', async () => {
    // criar 1
  const tecidoList = await screen.findByRole('listbox', { name: /Lista de Tecidos/i })
    const tecido1 = within(tecidoList).getByRole('option', { name: /Tecido 1/i })
    await userEvent.click(tecido1)
  const azulBtn = await screen.findByTitle('Azul Céu')
  await userEvent.click(azulBtn)
    const gerarBtn = await screen.findByRole('button', { name: /gerar vínculo/i })
    await userEvent.click(gerarBtn)

    const rows = await screen.findAllByRole('row')
    expect(rows.length).toBeGreaterThan(1)
    const row = rows[1]
    const excluirBtn = within(row).getByRole('button', { name: /Excluir/i })
    await userEvent.click(excluirBtn)

    // depois deve exibir placeholder "Nenhum vínculo"
    expect(await screen.findByText(/Nenhum vínculo/i)).toBeInTheDocument()
  })

  it('Filtra por família', async () => {
    // criar dois vínculos
  const tecidoList = await screen.findByRole('listbox', { name: /Lista de Tecidos/i })
    const tecido1 = within(tecidoList).getByRole('option', { name: /Tecido 1/i })
    await userEvent.click(tecido1)
  const amareloBtn = await screen.findByTitle('Amarelo Sol')
  const azulBtn = await screen.findByTitle('Azul Céu')
  await userEvent.click(amareloBtn)
  await userEvent.click(azulBtn)
    const gerarBtn = await screen.findByRole('button', { name: /gerar vínculo/i })
    await userEvent.click(gerarBtn)

    // aplicar filtro Família = Amarelo
    const filtroFamilia = await screen.findByLabelText(/Filtro Família/i)
    await userEvent.selectOptions(filtroFamilia, 'Amarelo')

    // deve exibir 1 linha de dados
    const rows = await screen.findAllByRole('row')
    expect(rows.slice(1).length).toBe(1)

    // limpar filtros
    const limparBtn = await screen.findByRole('button', { name: /Limpar filtros/i })
    await userEvent.click(limparBtn)
    const rowsAfter = await screen.findAllByRole('row')
    expect(rowsAfter.slice(1).length).toBe(2)
  })
})
