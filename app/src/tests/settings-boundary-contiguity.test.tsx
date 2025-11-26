import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, cleanup, fireEvent } from '@testing-library/react'
import React from 'react'
import Settings from '@/pages/Settings'
import { MantineProvider } from '@mantine/core'

// Simplificado: limites não são mais editáveis na UI, testamos contiguidade via hover
vi.mock('@/lib/db', () => {
  const settingsDb = {
    async getDeltaThreshold() { return 3.9 },
    async setDeltaThreshold(_: number) {},
    async getHueBoundaries() { return undefined }, // usa defaults internos
    async setHueBoundaries(_: any) {},
  }
  return { settingsDb }
})

function moveAtAngle(svg: SVGSVGElement, angleDeg: number) {
  // Geometria atual: base size=240, labelPadding=30 => svgSize=300, centro=150
  const baseSize = 240
  const labelPadding = 30
  const svgSize = baseSize + labelPadding * 2
  const cx = svgSize/2, cy = svgSize/2
  const innerR = 78, outerR = 108
  const r = (innerR + outerR)/2
  const rad = angleDeg * Math.PI / 180
  const clientX = cx + r * Math.cos(rad)
  const clientY = cy + r * Math.sin(rad)
  vi.spyOn(svg, 'getBoundingClientRect').mockImplementation(() => ({ left: 0, top: 0, right: svgSize, bottom: svgSize, width: svgSize, height: svgSize, x: 0, y: 0, toJSON() { return {} } } as any))
  fireEvent.mouseMove(svg, { clientX, clientY })
}

describe('Settings boundary contiguity (novo modelo fixo)', () => {
  beforeEach(() => {
    render(
      <MantineProvider>
        <Settings />
      </MantineProvider>
    )
  })
  afterEach(() => cleanup())

  it('classifica ângulos representativos em famílias esperadas (limites contínuos)', async () => {
    const svg = await screen.findByTestId('hue-wheel') as unknown as SVGSVGElement
    const cases: Array<[number,string]> = [
      [0, 'Vermelho'],         // dentro de Vermelho (345°-20° wrap)
      [25, 'Laranja'],          // dentro de Laranja (20°-65°)
      [70, 'Amarelo'],          // dentro de Amarelo (65°-95°) -> 70°
      [110, 'Verde'],           // dentro de Verde (95°-170°)
      [175, 'Azul'],            // dentro de Azul (170°-270°)
      [285, 'Roxo'],            // dentro de Roxo (270°-310°)
      [325, 'Rosa'],            // dentro de Rosa (310°-345°)
    ]
    for (const [deg, fam] of cases) {
      moveAtAngle(svg, deg)
      const label = await screen.findByTestId('hue-hover-label')
      expect(label.textContent).toMatch(new RegExp(fam, 'i'))
    }
  })
})
