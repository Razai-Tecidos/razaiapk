import { describe, it } from 'vitest'
import { inferFamilyFrom, hexToLab } from '@/lib/color-utils'

const samples = [
  { hex: '#605739', label: 'Dark Olive Brown' },
  { hex: '#75644B', label: 'Olive Brown Mid' },
  { hex: '#313732', label: 'Dark Neutral Greenish' },
  { hex: '#5E4D35', label: 'Dark Brown Olive' },
]

describe('Diagnóstico tons escuros oliva/marrom', () => {
  it('imprime métricas e família atual', () => {
    console.log('\n═══════════════════════════════════════')
    console.log('  MÉTRICAS: TONS OLIVA/MARROM ESCUROS')
    console.log('═══════════════════════════════════════')
    samples.forEach(s => {
      const lab = hexToLab(s.hex)!
      const { L, a, b } = lab
      const chroma = Math.sqrt(a*a + b*b)
      const hueRad = Math.atan2(b, a)
      const hue = hueRad * 180 / Math.PI + (hueRad < 0 ? 360 : 0)
      const light = L / 100
      const ratio = b / (a === 0 ? 1e-6 : a)
      const fam = inferFamilyFrom({ hex: s.hex })
      console.log(`${s.hex} -> fam=${fam} L=${L.toFixed(2)} a=${a.toFixed(2)} b=${b.toFixed(2)} hue=${hue.toFixed(2)}° chroma=${chroma.toFixed(2)} light=${(light*100).toFixed(1)}% b/a=${ratio.toFixed(2)}  label=${s.label}`)
    })
    console.log('═══════════════════════════════════════\n')
  })
})
