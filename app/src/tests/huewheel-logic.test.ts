import { describe, it, expect } from 'vitest'
import { classifyAngle } from '@/components/HueWheel'

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

// Temporary reference visual limits from the request
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

describe('HueWheel logic classification', () => {
  it('classifies example angles with reference bounds (no offset)', () => {
    expect(classifyAngle(10, REF as any)).toBe('Vermelho')
    expect(classifyAngle(35, REF as any)).toBe('Laranja')
    expect(classifyAngle(80, REF as any)).toBe('Amarelo')
    expect(classifyAngle(120, REF as any)).toBe('Verde')
    expect(classifyAngle(200, REF as any)).toBe('Azul')
    expect(classifyAngle(285, REF as any)).toBe('Roxo')
    expect(classifyAngle(330, REF as any)).toBe('Rosa')
  })

  it('handles wrap-around families (e.g., Vermelho 345–20)', () => {
    // Just around the wrap
    expect(classifyAngle(350, REF as any)).toBe('Vermelho')
    expect(classifyAngle(2, REF as any)).toBe('Vermelho')
    expect(classifyAngle(22, REF as any)).toBe('Laranja')
  })

  it('never returns empty for angles mid-ranges', () => {
    for (const a of [0, 60, 100, 150, 210, 300, 340]) {
      const fam = classifyAngle(a, REF as any)
      expect(fam).not.toBe('—')
    }
  })
})
