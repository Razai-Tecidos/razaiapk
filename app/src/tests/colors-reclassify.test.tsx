import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, within, cleanup } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import React from 'react'
import Colors from '@/pages/Colors'
import { MantineProvider } from '@mantine/core'
import { setHueBoundaries } from '@/lib/color-utils'

// Mock DB for colors
vi.mock('@/lib/db', () => {
  const g: any = globalThis as any
  g.__colorsStore2 = g.__colorsStore2 ?? []
  const colors: any[] = g.__colorsStore2

  const db = { async init() {} }
  const colorsDb = {
    async listColors() { return [...colors] },
    async createColor(input: any) {
      const id = crypto.randomUUID()
      const createdAt = new Date().toISOString()
      // Generate a basic incremental SKU to satisfy table expectations
      const max = colors.reduce((m, t) => {
        const mtx = /(\d+)$/.exec(t.sku || '')
        if (mtx) {
          const n = parseInt(mtx[1], 10)
          return Number.isNaN(n) ? m : Math.max(m, n)
        }
        return m
      }, 0)
      const sku = `C${String(max + 1).padStart(3, '0')}`
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
  return { db, colorsDb, __test2: { reset: () => { colors.splice(0, colors.length) } } }
})

async function openDrawerNovo() {
  await userEvent.click(screen.getByRole('button', { name: /novo cor/i }))
  await screen.findByRole('dialog')
}

async function openEdit() {
  await userEvent.click(screen.getByRole('button', { name: /editar/i }))
  await screen.findByRole('dialog')
}

describe('Colors reclassify batch action', () => {
  beforeEach(() => {
    const g: any = globalThis as any
    if (g.__colorsStore2) g.__colorsStore2.length = 0
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

  it('applies inferred family to names and persists them', async () => {
    // Create a color named "Verde Feno"
    await openDrawerNovo()
    await userEvent.type(screen.getByLabelText(/nome da cor/i), 'Verde Feno')
    await userEvent.click(screen.getByRole('button', { name: /adicionar cor/i }))

    // Edit to set HEX ciano (#00FFFF) which under contiguous bounds is Azul
    const rows1 = await screen.findAllByRole('row')
    await userEvent.click(rows1[1])
    await openEdit()
    const hexEl = await screen.findByPlaceholderText('#FF0000')
    await userEvent.clear(hexEl)
    await userEvent.type(hexEl, '#00FFFF')
    await userEvent.click(screen.getByRole('button', { name: /salvar/i }))
    // Close drawer manually as it stays open on edit
    await userEvent.click(screen.getByRole('button', { name: /cancelar/i }))

    // Reclassify
    const rebtn = await screen.findByRole('button', { name: /reclassificar nomes/i })
    await userEvent.click(rebtn)
    const dialog = await screen.findByRole('dialog')
    await userEvent.click(within(dialog).getByRole('button', { name: /sim/i }))

    // Open edit again to assert the persisted name was updated to "Azul Feno"
    const rows2 = await screen.findAllByRole('row')
    await userEvent.click(rows2[1])
    await openEdit()
    const nameInput = await screen.findByLabelText(/nome da cor/i)
    expect((nameInput as HTMLInputElement).value).toMatch(/^Azul Feno$/)
  })
})
