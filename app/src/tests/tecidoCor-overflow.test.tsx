import { describe, it, expect, beforeEach, afterEach, afterAll, vi } from 'vitest'
// Mock DB to evitar acesso real ao IndexedDB em ambiente de teste (jsdom)
vi.mock('@/lib/db', () => {
  const g: any = globalThis as any
  g.__tissues = [
    { id: 't1', name: 'Tecido 1', width: 150, composition: '100% Algodão', sku: 'T001', createdAt: new Date().toISOString() },
  ]
  g.__colors = Array.from({ length: 5 }).map((_, i) => ({
    id: 'c'+i,
    name: 'Cor '+i,
    hex: '#'+(i%10)+ (i%10) + (i%10) + '000',
    sku: 'C'+String(i).padStart(3,'0'),
    createdAt: new Date().toISOString()
  }))
  const db = { async init(){}, async listTissues(){ return [...g.__tissues] } }
  const colorsDb = { async listColors(){ return [...g.__colors] } }
  const linksDb = { async list(){ return [] }, async createMany(){ return { created:0, duplicates:0 } }, async updateStatus(){}, async delete(){}, async setImageFull(){} }
  return { db, colorsDb, linksDb }
})
import { render, screen, cleanup } from '@testing-library/react'
import React from 'react'
import TecidoCorPage from '@/pages/TecidoCor'
import { MantineProvider } from '@mantine/core'

describe('TecidoCor - Estrutura de overflow da grade de cores', () => {
  beforeEach(() => {
    render(
      <MantineProvider>
        <TecidoCorPage />
      </MantineProvider>
    )
  })
  afterEach(() => {
    cleanup()
    vi.clearAllMocks()
  })
  afterAll(() => {
    // Restaurar módulos para não impactar outros testes
    vi.unmock('@/lib/db')
    vi.resetModules()
  })

  it('scroll container tem overflow-x:auto e trilho interno com width:max-content', async () => {
    // aguardar montagem básica
    await screen.findByRole('listbox', { name: /Lista de Tecidos/i })

    const scroller = await screen.findByTestId('color-grid-scroll') as HTMLDivElement
    expect(scroller).toBeTruthy()

    // Verifica propriedades inline setadas pelo componente
    expect(scroller.style.overflowX).toBe('auto')
    expect(scroller.style.overflowY).toBe('hidden')

    // track é a div interna grid (primeiro filho do scroller)
    const track = scroller.querySelector('div > div') as HTMLDivElement | null || scroller.firstElementChild as HTMLDivElement | null
    expect(track).toBeTruthy()
    if (track) {
      expect(track.style.display).toBe('grid')
      expect(track.style.width).toBe('max-content')
    }
  })
})
