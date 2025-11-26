import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, within, cleanup } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import React from 'react'
import TecidoCorPage from '@/pages/TecidoCor'
import { MantineProvider } from '@mantine/core'

// Mock minimal DB for links with image support
vi.mock('@/lib/db', () => {
  const g: any = globalThis as any
  // stores
  g.__tissues = g.__tissues ?? [
    { id: 't1', name: 'Tecido 1', width: 150, composition: '100% Algodão', sku: 'T001', createdAt: new Date().toISOString() },
  ]
  g.__colors = g.__colors ?? [
    { id: 'c1', name: 'Amarelo Sol', hex: '#FFC400', sku: 'AM001', createdAt: new Date().toISOString() },
  ]
  g.__links = g.__links ?? []
  const db = {
    async init() {},
    async listTissues() { return [...g.__tissues] }
  }
  const colorsDb = {
    async listColors() { return [...g.__colors] }
  }
  const linksDb = {
    async list() {
      const links = [...g.__links]
      const t = g.__tissues[0]
      const c = g.__colors[0]
      return links.map((l: any) => ({
        ...l,
        tissueSku: t.sku,
        tissueName: t.name,
        width: t.width,
        composition: t.composition,
        colorSku: c.sku,
        colorName: c.name,
        family: 'Amarelo',
        hex: c.hex,
        nomeCompleto: `${t.name} ${c.name}`,
      }))
    },
    async createMany(tissueId: string, colorIds: string[]) {
      let created = 0
      for (const cId of colorIds) {
        const t = g.__tissues[0]
        const c = g.__colors.find((x: any) => x.id === cId)
        if (!c) continue
        const exists = g.__links.some((l: any) => l.tissueId === tissueId && l.colorId === cId)
        if (exists) continue
        g.__links.unshift({ id: 'l' + Math.random(), tissueId, colorId: cId, skuFilho: `${t.sku}-${c.sku}`, status: 'Ativo', createdAt: new Date().toISOString(), imageThumb: undefined })
        created++
      }
      return created
    },
    async updateStatus() { },
    async delete() { },
    async setImage(id: string, image: string | null) {
      const idx = g.__links.findIndex((x: any) => x.id === id)
      if (idx >= 0) g.__links[idx] = { ...g.__links[idx], imageThumb: image ?? undefined }
    },
    async setImageFull(id: string, file: File) {
      const idx = g.__links.findIndex((x: any) => x.id === id)
      if (idx >= 0) {
        g.__links[idx] = { ...g.__links[idx], imageThumb: 'data:image/png;base64,AAAA' }
        // Force a microtask to simulate async update and trigger re-render
        await Promise.resolve()
      }
    },
  }
  return { db, colorsDb, linksDb }
})
 

// Mock FileReader to synchronously return a data URL
class FRMock {
  public result: string | ArrayBuffer | null = null
  public onload: null | (()=>void) = null
  public onerror: null | (()=>void) = null
  readAsDataURL(file: File) {
    // minimal fake data URL
    this.result = 'data:image/png;base64,AAAA'
    if (this.onload) this.onload()
  }
}

describe('Vínculo Tecido-Cor - envio de imagem por vínculo', () => {
  beforeEach(() => {
    ;(globalThis as any).FileReader = FRMock as any
    render(
      <MantineProvider>
        <TecidoCorPage />
      </MantineProvider>
    )
  })
  afterEach(() => cleanup())

  it('Cria vínculo e mostra miniatura após enviar imagem', async () => {
    // Selecionar tecido na lista
  const tecidoList = await screen.findByRole('listbox', { name: /Lista de Tecidos/i })
    const tecido1 = within(tecidoList).getByRole('option', { name: /Tecido 1/i })
    await userEvent.click(tecido1)
    // Selecionar cor (card)
    const colorCard = await screen.findByTitle('Amarelo Sol')
    await userEvent.click(colorCard)
    // Gerar vínculo
  const gerarBtn = await screen.findByRole('button', { name: /gerar vínculo/i })
    expect(gerarBtn).toBeEnabled()
    await userEvent.click(gerarBtn)
    // Aguarda a linha aparecer
    const rowsAfter = await screen.findAllByRole('row')
    expect(rowsAfter.length).toBeGreaterThan(1)
    const bodyRow = rowsAfter[1]
    // Enviar imagem
    const actionsCell = within(bodyRow).getAllByRole('cell').at(-1) as HTMLElement
    const imgButton = within(actionsCell).getByRole('button', { name: /imagem/i })
    await userEvent.click(imgButton)
    const fileInput = actionsCell.querySelector('input[type="file"]') as HTMLInputElement
    const file = new File(['x'], 'x.png', { type: 'image/png' })
    await userEvent.upload(fileInput, file)
    // Verifica miniatura
  const thumb = await screen.findByAltText(/Imagem do vínculo/i)
    expect(thumb).toBeInTheDocument()
  })
})
