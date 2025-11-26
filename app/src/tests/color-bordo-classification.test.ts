import { describe, it, expect } from 'vitest'
import { inferFamilyFrom } from '@/lib/color-utils'

const bordoHexes = [
  '#612B33',
  '#4A1526',
  '#672637',
  '#812B38',
  '#542C38',
  '#8F1C2C',
]

describe('Bordô family classification', () => {
  it('classifies provided hex codes as Bordô', () => {
    bordoHexes.forEach(hex => {
      const fam = inferFamilyFrom({ hex })
      expect(fam).toBe('Bordô')
    })
  })

  it('keeps #762F55 as Vermelho (not Bordô due to b* negativo)', () => {
    const fam = inferFamilyFrom({ hex: '#762F55' })
    expect(fam).toBe('Vermelho')
  })

  it('classifies #483638 as Bordô (vinho escuro desaturado)', () => {
    expect(inferFamilyFrom({ hex: '#483638' })).toBe('Bordô')
  })
})
