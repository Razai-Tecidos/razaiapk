import { describe, it } from 'vitest'
import { hexToLab, inferFamilyFrom } from '@/lib/color-utils'

function metrics(hex: string) {
  const lab = hexToLab(hex)
  if (!lab) return undefined
  const { L, a, b } = lab
  const chroma = Math.sqrt(a * a + b * b)
  const hueRaw = (Math.atan2(b, a) * 180) / Math.PI
  const hue = hueRaw < 0 ? hueRaw + 360 : hueRaw
  const light = L / 100
  return { L, a, b, chroma, hue, light }
}

const bordoList = [
  '#612B33',
  '#4A1526',
  '#672637',
  '#812B38',
  '#542C38',
  '#8F1C2C',
]

const otherList = [
  '#3F2A2F', // captured as Rosa
  '#A67655', // captured as Laranja
  '#AE8260', // captured as Amarelo
  '#762F55', // referência burgundy atual (mantido Vermelho?)
  '#483638', // novo report: captou Vermelho
]

describe('Diagnostics for Bordô and related colors', () => {
  it('prints metrics for proposed Bordô colors and misclassified browns', () => {
    console.log('\n═══════════════════════════════════════')
    console.log('        MÉTRICAS: CANDIDATOS BORDÔ')
    console.log('═══════════════════════════════════════')
    bordoList.forEach(hex => {
      const m = metrics(hex)
      const fam = inferFamilyFrom({ hex })
      if (!m) {
        console.log(`${hex} -> fam=${fam} (LAB inválido)`)
      } else {
        console.log(`${hex} -> fam=${fam} L=${m.L.toFixed(2)} a=${m.a.toFixed(2)} b=${m.b.toFixed(2)} hue=${m.hue.toFixed(2)}° chroma=${m.chroma.toFixed(2)} light=${(m.light*100).toFixed(1)}%`)
      }
    })

    console.log('\n═══════════════════════════════════════')
    console.log('        MÉTRICAS: OUTRAS CORES')
    console.log('═══════════════════════════════════════')
    otherList.forEach(hex => {
      const m = metrics(hex)
      const fam = inferFamilyFrom({ hex })
      if (!m) {
        console.log(`${hex} -> fam=${fam} (LAB inválido)`)
      } else {
        console.log(`${hex} -> fam=${fam} L=${m.L.toFixed(2)} a=${m.a.toFixed(2)} b=${m.b.toFixed(2)} hue=${m.hue.toFixed(2)}° chroma=${m.chroma.toFixed(2)} light=${(m.light*100).toFixed(1)}%`)
      }
    })
  })
})
