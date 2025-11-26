import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, cleanup, fireEvent } from '@testing-library/react'
import React from 'react'
import Settings from '@/pages/Settings'
import { MantineProvider } from '@mantine/core'
import { setHueBoundaries, DEFAULT_HUE_BOUNDS } from '@/lib/color-utils'

// Atualizado: sem edição direta dos limites na UI; testamos comportamento de hover nos limites padrão
vi.mock('@/lib/db', () => {
  const settingsDb = {
    async getDeltaThreshold() { return 3.9 },
    async setDeltaThreshold(_: number) {},
    async getHueBoundaries() { return undefined },
    async setHueBoundaries(_: any) {},
  }
  return { settingsDb }
})

function moveAtAngle(svg: SVGSVGElement, angleDeg: number) {
  // Geometria atual da HueWheel: size base=240, labelPadding=30 => svgSize=300, centro=150
  const baseSize = 240
  const labelPadding = 30
  const svgSize = baseSize + labelPadding * 2 // 300
  const cx = svgSize / 2
  const cy = svgSize / 2
  const innerR = 78
  const outerR = 108
  const r = (innerR + outerR) / 2 // ponto médio do anel
  const rad = angleDeg * Math.PI / 180
  const clientX = cx + r * Math.cos(rad)
  const clientY = cy + r * Math.sin(rad)
  vi.spyOn(svg, 'getBoundingClientRect').mockImplementation(() => ({ left: 0, top: 0, right: svgSize, bottom: svgSize, width: svgSize, height: svgSize, x: 0, y: 0, toJSON() { return {} } } as any))
  fireEvent.mouseMove(svg, { clientX, clientY })
}

function getHighlightedFamilies(svg: SVGSVGElement) {
  return Array.from(svg.querySelectorAll('g[data-highlighted="true"]')).map(g => (g as SVGGElement).getAttribute('data-family'))
}

describe('Settings hover alignment (modelo fixo)', () => {
  beforeEach(() => {
    // Garante limites padrão
    setHueBoundaries({ ...DEFAULT_HUE_BOUNDS })
    render(
      <MantineProvider>
        <Settings />
      </MantineProvider>
    )
  })
  afterEach(() => cleanup())

  it('hover 0° mostra Vermelho e destaca Vermelho/Laranja', async () => {
    const svg = await screen.findByTestId('hue-wheel') as unknown as SVGSVGElement
    moveAtAngle(svg, 0)
    const label = await screen.findByTestId('hue-hover-label')
    expect(label).toHaveTextContent(/Vermelho/i)
    const hi = getHighlightedFamilies(svg)
    expect(hi).toEqual(expect.arrayContaining(['Vermelho','Laranja']))
  })

  it('ângulo logo abaixo do início de Vermelho mostra Rosa/Vermelho', async () => {
    const startVermelho = DEFAULT_HUE_BOUNDS.vermelhoStart
    const below = (startVermelho - 1 + 360) % 360
    const svg = await screen.findByTestId('hue-wheel') as unknown as SVGSVGElement
    moveAtAngle(svg, below)
    const label = await screen.findByTestId('hue-hover-label')
    expect(label).toHaveTextContent(/Rosa/i)
    const hi = getHighlightedFamilies(svg)
    expect(hi).toEqual(expect.arrayContaining(['Rosa','Vermelho']))
  })

  it('ângulo logo acima do início de Vermelho mostra Vermelho/Laranja', async () => {
    const startVermelho = DEFAULT_HUE_BOUNDS.vermelhoStart
    const above = (startVermelho + 1) % 360
    const svg = await screen.findByTestId('hue-wheel') as unknown as SVGSVGElement
    moveAtAngle(svg, above)
    const label = await screen.findByTestId('hue-hover-label')
    expect(label).toHaveTextContent(/Vermelho/i)
    const hi = getHighlightedFamilies(svg)
    expect(hi).toEqual(expect.arrayContaining(['Vermelho','Laranja']))
  })
})
