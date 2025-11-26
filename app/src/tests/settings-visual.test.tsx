import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, cleanup, within } from '@testing-library/react'
import React from 'react'
import Settings from '@/pages/Settings'
import { MantineProvider } from '@mantine/core'

vi.mock('@/lib/db', () => {
  const settingsDb = {
    async getDeltaThreshold() { return 3.9 },
    async setDeltaThreshold(_: number) {},
    async getHueBoundaries() { return undefined }, // use defaults
    async setHueBoundaries(_: any) {},
  }
  return { settingsDb }
})

describe('Settings visual hue wheel', () => {
  beforeEach(() => {
    render(
      <MantineProvider>
        <Settings />
      </MantineProvider>
    )
  })
  afterEach(() => cleanup())

  it('renders chromatic wheel background and boundary ticks', async () => {
    const wheel = await screen.findByTestId('hue-wheel')
    expect(wheel).toBeInTheDocument()
    const svg = wheel as unknown as SVGSVGElement
    // We now render only boundary ticks (no colored segments)
    const pathCount = svg.querySelectorAll('path[data-family]').length
    expect(pathCount).toBe(0)
    const lineCount = svg.querySelectorAll('line').length
    expect(lineCount).toBeGreaterThanOrEqual(7)
  })
})
