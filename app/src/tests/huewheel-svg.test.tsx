import { describe, it, expect, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import React from 'react'
import Settings from '@/pages/Settings'
import { MantineProvider } from '@mantine/core'

describe('HueWheel visual wheel (nuances + ticks)', () => {
  afterEach(() => cleanup())

  it('renders a nuanced gradient background and boundary ticks', async () => {
    render(
      <MantineProvider>
        <Settings />
      </MantineProvider>
    )
    const bg = await screen.findByTestId('hue-wheel-bg') as HTMLDivElement
    expect(bg).toBeTruthy()
    const bgStyle = (bg as HTMLElement).style?.background || bg.getAttribute('style') || ''
    expect(String(bgStyle)).toContain('conic-gradient')

    const svg = await screen.findByTestId('hue-wheel') as unknown as SVGSVGElement
    const ticks = svg.querySelectorAll('g[data-family]')
    expect(ticks.length).toBeGreaterThanOrEqual(8)
  })
})
