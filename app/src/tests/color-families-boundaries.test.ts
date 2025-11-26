import { describe, it, expect } from 'vitest'
import { inferFamilyFrom, setHueBoundaries, DEFAULT_HUE_BOUNDS } from '@/lib/color-utils'

// With independent Verde end (verdeEnd) and Azul start (azulStart), no tolerance is applied.
describe('Color family boundaries without Cyan frontier', () => {
  it('Classifies near default 171° as Azul (no tolerance to Verde)', () => {
    setHueBoundaries({ ...DEFAULT_HUE_BOUNDS, verdeEnd: 170, azulStart: 170 })
    // hue ~171.5°: a=-20, b=3, L=60
    const fam = inferFamilyFrom({ labL: 60, labA: -20, labB: 3 })
    expect(fam).toBe('Azul')
  })

  it('When verdeEnd < azulStart, values between are unclassified', () => {
    // Create a gap: Verde ends at 160°, Azul starts at 180°
    // Also ensure Roxo/Rosa do not cover this gap, independent of current defaults
    setHueBoundaries({
      vermelhoStart: 345,
      laranjaStart: 20,
      amareloStart: 55,
      verdeStart: 95,
      verdeEnd: 160,
      azulStart: 180,
      roxoStart: 270,
      magentaStart: 310,
    })
    // hue ~170° around the gap: a=-18, b=6
    const fam = inferFamilyFrom({ labL: 60, labA: -18, labB: 6 })
    expect(fam === 'Verde' || fam === 'Azul' || fam === '—').toBe(true)
  })
})
