import { describe, it } from 'vitest'
import { hexToLab, labHueAngle } from '../lib/color-utils'

describe('Análise #C29188', () => {
  it('mostra LAB/hue/chroma/light', () => {
    const hex = '#C29188'
    const lab = hexToLab(hex)
    if (!lab) return
    const { L, a, b } = lab
    const light = L / 100
    const chroma = Math.sqrt(a * a + b * b)
    const hue = labHueAngle({ L, a, b })

    console.log('\n#C29188 Metrics')
    console.log({ L, a, b, light, chroma, hue, ratio: b / a })
  })
})
