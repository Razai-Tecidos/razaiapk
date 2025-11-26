import { describe, it } from 'vitest'
import { hexToLab, inferFamilyFrom } from '@/lib/color-utils'

const hexes = [
  '#9C7894',
  '#873767',
  '#6E3866',
  '#9B59B6', // reference currently Rosa (Amethyst)
  '#EC407A', // strong pink should remain Rosa
]

function metrics(hex: string) {
  const lab = hexToLab(hex)
  if (!lab) return undefined
  const { L, a, b } = lab
  const chroma = Math.sqrt(a*a + b*b)
  const hueRaw = (Math.atan2(b, a) * 180) / Math.PI
  const hue = hueRaw < 0 ? hueRaw + 360 : hueRaw
  const light = L / 100
  return { L, a, b, chroma, hue, light }
}

describe('Diagnóstico de roxos que caíram como Rosa', () => {
  it('imprime métricas LAB e família atual', () => {
    console.log('\n═══════════════════════════════════════')
    console.log('  MÉTRICAS: ROXOS / ROSAS LIMITE')
    console.log('═══════════════════════════════════════')
    hexes.forEach(hex => {
      const m = metrics(hex)
      const fam = inferFamilyFrom({ hex })
      if (!m) {
        console.log(`${hex} -> fam=${fam} (LAB inválido)`) ; return
      }
      console.log(`${hex} -> fam=${fam} L=${m.L.toFixed(2)} a=${m.a.toFixed(2)} b=${m.b.toFixed(2)} hue=${m.hue.toFixed(2)}° chroma=${m.chroma.toFixed(2)} light=${(m.light*100).toFixed(1)}% b/a=${(m.b/m.a).toFixed(2)}`)
    })
  })
})
