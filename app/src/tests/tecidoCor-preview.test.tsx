import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import React from 'react'
import TecidoCorPage from '@/pages/TecidoCor'
import { MantineProvider } from '@mantine/core'

vi.mock('@/lib/db', () => {
  const g: any = globalThis as any
  g.__tissues = [
    { id: 't1', name: 'Tecido 1', width: 150, composition: '100% Algodão', sku: 'T001', createdAt: new Date().toISOString() },
  ]
  g.__colors = [
    { id: 'c1', name: 'Amarelo Sol', hex: '#FFC400', sku: 'AM001', createdAt: new Date().toISOString() },
  ]
  g.__links = [
    { id: 'l1', tissueId: 't1', colorId: 'c1', skuFilho: 'T001-AM001', status: 'Ativo', createdAt: new Date().toISOString(), imageThumb: 'data:image/png;base64,AAAA' },
  ]
  const db = { async init(){}, async listTissues(){ return g.__tissues } }
  const colorsDb = { async listColors(){ return g.__colors } }
  const linksDb = {
    async list(){
      return g.__links.map((l:any)=>({
        ...l,
        tissueSku: 'T001', tissueName: 'Tecido 1', width:150, composition:'100% Algodão',
        colorSku: 'AM001', colorName: 'Amarelo Sol', family: 'Amarelo', hex: '#FFC400', nomeCompleto: 'Tecido 1 Amarelo Sol'
      }))
    },
    async createMany(){ return { created:0, duplicates:0 } }, async updateStatus(){}, async delete(){}, async setImageFull(){}, async setImage(){},
  }
  return { db, colorsDb, linksDb }
})

describe('Preview de imagem de vínculo', () => {
  beforeEach(() => {
    render(<MantineProvider><TecidoCorPage /></MantineProvider>)
  })
  afterEach(() => cleanup())

  it('Abre e fecha modal ao clicar miniatura', async () => {
    const thumb = await screen.findByAltText(/Imagem do vínculo/i)
    await userEvent.click(thumb)
    const dialog = await screen.findByRole('dialog', { name: /Pré-visualização da imagem/i })
    expect(dialog).toBeInTheDocument()
    // fechar clicando overlay
    await userEvent.click(dialog)
    expect(screen.queryByRole('dialog')).toBeNull()
  })
})
