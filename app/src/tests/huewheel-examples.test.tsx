import { describe, it, expect, afterEach } from 'vitest'
import React from 'react'
import { render, screen, cleanup } from '@testing-library/react'
import HueWheel from '@/components/HueWheel'

type Bounds = {
  vermelhoStart: number
  laranjaStart: number
  amareloStart: number
  verdeStart: number
  verdeEnd: number
  azulStart: number
  roxoStart: number
  magentaStart: number
}

const REF: Bounds = {
  vermelhoStart: 345,
  laranjaStart: 20,
  amareloStart: 55,
  verdeStart: 95,
  verdeEnd: 170,
  azulStart: 170,
  roxoStart: 270,
  magentaStart: 310,
}

const CASES: Array<[number, string]> = [
  [10, 'Vermelho'],
  [35, 'Laranja'],
  [80, 'Amarelo'],
  [120, 'Verde'],
  [200, 'Azul'],
  [285, 'Roxo'],
  [330, 'Rosa'],
]

describe('HueWheel examples classification with reference bounds', () => {
  afterEach(() => cleanup())
  for (const [angle, name] of CASES) {
    it(`angle ${angle}° => ${name}`, async () => {
      render(<HueWheel bounds={REF as any} forceHoverAngle={angle} />)
      const label = await screen.findByTestId('hue-hover-label')
      expect(label.textContent?.includes(name)).toBe(true)
    })
  }
})
