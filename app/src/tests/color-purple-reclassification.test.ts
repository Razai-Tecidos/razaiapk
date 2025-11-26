import { describe, it, expect } from 'vitest'
import { inferFamilyFrom } from '@/lib/color-utils'

// Purples previously captured as Rosa, should now be Roxo
const toRoxo = [
  '#9C7894',
  '#6E3866',
  '#873767',
]

describe('Reclassificação de púrpuras (Rosa -> Roxo)', () => {
  it('classifies selected malva/dark purples as Roxo', () => {
    toRoxo.forEach(hex => {
      expect(inferFamilyFrom({ hex })).toBe('Roxo')
    })
  })

  it('classifies Amethyst (#9B59B6) as Roxo (vibrant purple, not pink)', () => {
    // Amethyst is actually purple, not pink - the new classification is more accurate
    expect(inferFamilyFrom({ hex: '#9B59B6' })).toBe('Roxo')
  })

  it('keeps strong pink (#EC407A) as Rosa', () => {
    expect(inferFamilyFrom({ hex: '#EC407A' })).toBe('Rosa')
  })
})
