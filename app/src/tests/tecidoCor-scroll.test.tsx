import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, cleanup, fireEvent } from '@testing-library/react'
import React from 'react'
import TecidoCorPage from '@/pages/TecidoCor'
import { MantineProvider } from '@mantine/core'

// Mock DB with many colors to ensure overflow
vi.mock('@/lib/db', () => {
  const g: any = globalThis as any
  g.__tissues = [
    { id: 't1', name: 'Tecido 1', width: 150, composition: '100% Algodão', sku: 'T001', createdAt: new Date().toISOString() },
  ]
  // create > 40 colors to overflow
  g.__colors = Array.from({ length: 60 }, (_, i) => ({
    id: `c${i+1}`,
    name: `Cor ${i+1}`,
    hex: i % 3 === 0 ? '#FFC400' : '#223344',
    sku: `C${String(i+1).padStart(3,'0')}`,
    createdAt: new Date().toISOString(),
  }))
  g.__links = []

  const db = { async init(){}, async listTissues(){ return g.__tissues } }
  const colorsDb = { async listColors(){ return g.__colors } }
  const linksDb = {
    async list(){ return [] },
    async createMany(){ return { created:0, duplicates:0 } },
    async updateStatus(){}, async delete(){}, async setImageFull(){},
  }
  return { db, colorsDb, linksDb }
})

describe('Tecido-Cor - scroll horizontal dos cards', () => {
  beforeEach(() => {
    render(<MantineProvider><TecidoCorPage /></MantineProvider>)
  })
  afterEach(() => cleanup())

  it('converte wheel vertical em rolagem horizontal no container dos cards', async () => {
    const scrollBox = await screen.findByTestId('color-grid-scroll')
    // sanity: deve existir e iniciar em 0
    expect(scrollBox).toBeTruthy()
    const initial = (scrollBox as HTMLElement).scrollLeft
    expect(initial).toBe(0)

    // dispara um wheel vertical
    fireEvent.wheel(scrollBox, { deltaY: 200 })

    // scrollLeft deve ter aumentado (mesmo sem layout real, nosso handler altera a prop diretamente)
    const after = (scrollBox as HTMLElement).scrollLeft
    expect(after).toBeGreaterThan(initial)
  })
})
