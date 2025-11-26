import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import React from 'react'
import Settings from '@/pages/Settings'
import { MantineProvider } from '@mantine/core'

vi.mock('@/lib/db', () => {
  const settingsDb = {
    async getDeltaThreshold() { return 3.9 },
    async setDeltaThreshold(_: number) {},
    async getHueBoundaries() { return undefined }, // fallback to defaults
    async setHueBoundaries(_: any) {},
  }
  return { settingsDb }
})

describe('Settings help and preview', () => {
  beforeEach(() => {
    render(
      <MantineProvider>
        <Settings />
      </MantineProvider>
    )
  })
  afterEach(() => cleanup())

  it('shows explanatory help text and intervals preview', async () => {
    // Help block
    expect(await screen.findByText(/Como funcionam os limites de cor/i)).toBeInTheDocument()
  // Preview uses defaults (azulStart → roxoStart) conforme padrões atuais
  expect(screen.getByText(/Azul: 170° – 270°/i)).toBeInTheDocument()
    expect(screen.getByText(/Rosa:/i)).toBeInTheDocument()
  })
})
