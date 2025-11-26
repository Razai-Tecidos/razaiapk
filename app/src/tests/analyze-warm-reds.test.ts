import { describe, it } from 'vitest'
import { inferFamilyFrom, hexToLab } from '@/lib/color-utils'

const reds = [
  '#CC3227', '#9A2626', '#750919', '#D12626', '#E15B55', '#BA3543'
]

describe('Diagnóstico: vermelhos captados como marrom/laranja', () => {
  it('imprime métricas LAB e família atual', () => {
    console.log('\n═══════════════════════════════════════')
    console.log('  MÉTRICAS: VERMELHOS REPORTADOS')
    console.log('═══════════════════════════════════════')
    reds.forEach(hex => {
      const lab = hexToLab(hex)!
      const { L, a, b } = lab
      const chroma = Math.sqrt(a*a + b*b)
      const hueRad = Math.atan2(b, a)
      const hue = hueRad * 180 / Math.PI + (hueRad < 0 ? 360 : 0)
      const light = L / 100
      const ratio = b / (a === 0 ? 1e-6 : a)
      const fam = inferFamilyFrom({ hex })
      console.log(`${hex} -> fam=${fam} L=${L.toFixed(2)} a=${a.toFixed(2)} b=${b.toFixed(2)} hue=${hue.toFixed(2)}° chroma=${chroma.toFixed(2)} light=${(light*100).toFixed(1)}% b/a=${ratio.toFixed(2)}`)
    })
    console.log('═══════════════════════════════════════\n')
  })
})
