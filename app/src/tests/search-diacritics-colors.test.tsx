import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, within, cleanup } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import React from 'react'
import Colors from '@/pages/Colors'
import { MantineProvider } from '@mantine/core'
import { setHueBoundaries } from '@/lib/color-utils'

// Mock DB module with in-memory store for colors
vi.mock('@/lib/db', () => {
  const g: any = globalThis as any
  g.__colorsStore = g.__colorsStore ?? []
  const colors: any[] = g.__colorsStore
  const db = { async init() {} }
  const colorsDb = {
    async listColors() { return [...colors] },
    async createColor(input: any) {
      const id = crypto.randomUUID()
      const createdAt = new Date().toISOString()
      const sku = `C${String(colors.length + 1).padStart(3, '0')}`
      colors.unshift({ id, createdAt, sku, ...input })
    },
    async updateColor(input: any) {
      const idx = colors.findIndex(x => x.id === input.id)
      if (idx >= 0) colors[idx] = { ...colors[idx], ...input }
    },
    async deleteColor(id: string) {
      const idx = colors.findIndex(x => x.id === id)
      if (idx >= 0) colors.splice(idx, 1)
    }
  }
  const settingsDb = {
    async getDeltaThreshold() { return 3.9 },
    async setDeltaThreshold(_: number) {},
    async getHueBoundaries() { return null },
  }
  return { db, colorsDb, settingsDb, __test: { reset: () => { colors.splice(0, colors.length) } } }
})

async function openDrawerNovo() {
  await userEvent.click(screen.getByRole('button', { name: /novo cor/i }))
  await screen.findByRole('dialog')
}

describe('Busca acento-insensível em Cores', () => {
  beforeEach(() => {
    const g: any = globalThis as any
    if (g.__colorsStore) g.__colorsStore.length = 0
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
    render(
      <MantineProvider>
        <Colors />
      </MantineProvider>
    )
  })

  afterEach(() => { cleanup() })

  it('localiza por nome sem acento: coracao -> Coração', async () => {
    await openDrawerNovo()
    const nameEl = screen.getByLabelText(/nome da cor/i)
    await userEvent.type(nameEl, 'Coração Rubro, São Tomé')
    await userEvent.click(screen.getByRole('button', { name: /adicionar cor/i }))

    // Garantir itens criados
    const rows = await screen.findAllByRole('row')
    expect(rows.length).toBeGreaterThanOrEqual(3)

    const search = screen.getByLabelText(/pesquisar/i)
    await userEvent.type(search, 'coracao')

    const after = await screen.findAllByRole('row')
    const body = after.slice(1)
    expect(body.length).toBeGreaterThanOrEqual(1)
    const texts = body.map(r => r.textContent || '')
    // Deve conter Coração Rubro e não necessariamente São Tomé
    expect(texts.join(' ')).toMatch(/Coração Rubro/i)
  })

  it('localiza por nome sem acento: sao tome -> São Tomé', async () => {
    // Criar entradas
    await openDrawerNovo()
    const nameEl = screen.getByLabelText(/nome da cor/i)
    await userEvent.type(nameEl, 'Coração Rubro, São Tomé')
    await userEvent.click(screen.getByRole('button', { name: /adicionar cor/i }))

    const search = screen.getByLabelText(/pesquisar/i)
    await userEvent.clear(search)
    await userEvent.type(search, 'sao tome')

    const after = await screen.findAllByRole('row')
    const body = after.slice(1)
    const texts = body.map(r => r.textContent || '')
    expect(texts.join(' ')).toMatch(/São Tomé/i)
  })
})
