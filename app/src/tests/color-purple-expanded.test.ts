import { describe, it, expect } from 'vitest'
import { inferFamilyFrom } from '@/lib/color-utils'

describe('Purple/Roxo classification - expanded coverage', () => {
  describe('User-reported purples now classified as Roxo', () => {
    it('classifies #57385C as Roxo (dark purple)', () => {
      // RGB(87, 56, 92) - dark purple/eggplant
      // LAB: L=28.45, a=20.70, b=-16.01, hue=322.27°
      const family = inferFamilyFrom({ hex: '#57385C' })
      expect(family).toBe('Roxo')
    })

    it('classifies #80355D as Roxo (medium purple)', () => {
      // RGB(128, 53, 93) - medium purple/magenta
      // LAB: L=33.83, a=37.10, b=-7.92, hue=347.95°
      const family = inferFamilyFrom({ hex: '#80355D' })
      expect(family).toBe('Roxo')
    })

    it('classifies #372643 as Roxo (very dark purple/violet)', () => {
      // RGB(55, 38, 67) - very dark purple, almost black with purple tone
      // LAB: L=18.38, a=14.62, b=-15.27, hue=313.75°
      const family = inferFamilyFrom({ hex: '#372643' })
      expect(family).toBe('Roxo')
    })

    it('classifies #9D4283 as Roxo (vibrant magenta)', () => {
      // RGB(157, 66, 131) - vibrant magenta
      // LAB: L=42.32, a=45.79, b=-18.34, hue=338.17°
      const family = inferFamilyFrom({ hex: '#9D4283' })
      expect(family).toBe('Roxo')
    })

    it('classifies #97376B as Roxo (dark magenta)', () => {
      // RGB(151, 55, 107) - dark magenta
      // LAB: L=38.51, a=45.57, b=-9.38, hue=348.37°
      const family = inferFamilyFrom({ hex: '#97376B' })
      expect(family).toBe('Roxo')
    })
  })

  describe('Existing purple controls remain Roxo', () => {
    it('keeps previous malva purples as Roxo', () => {
      expect(inferFamilyFrom({ hex: '#9C7894' })).toBe('Roxo') // hue 332.79°
      expect(inferFamilyFrom({ hex: '#873767' })).toBe('Roxo') // hue 344.16°
      expect(inferFamilyFrom({ hex: '#6E3866' })).toBe('Roxo') // hue 331.65°
    })
  })

  describe('Pink/Rosa controls remain unchanged', () => {
    it('keeps vibrant pink/magenta as Rosa', () => {
      // #EC407A has hue ~6°, b/a ~0.11 (positive b*, not purple)
      expect(inferFamilyFrom({ hex: '#EC407A' })).toBe('Rosa')
    })

    it('keeps light pinks as Rosa', () => {
      expect(inferFamilyFrom({ hex: '#DC8592' })).toBe('Rosa') // light pink
      expect(inferFamilyFrom({ hex: '#E97989' })).toBe('Rosa') // coral pink
      expect(inferFamilyFrom({ hex: '#F2CCCE' })).toBe('Rosa') // pastel pink
    })
  })

  describe('Purple Material Design colors now Roxo', () => {
    it('classifies Material Design purples as Roxo (not Rosa)', () => {
      // These are actually purples, not pinks - the change is correct
      expect(inferFamilyFrom({ hex: '#9B59B6' })).toBe('Roxo') // Amethyst
      expect(inferFamilyFrom({ hex: '#8E44AD' })).toBe('Roxo') // Wisteria
      expect(inferFamilyFrom({ hex: '#6A1B9A' })).toBe('Roxo') // Deep Purple
      expect(inferFamilyFrom({ hex: '#8E24AA' })).toBe('Roxo') // Purple A700
      expect(inferFamilyFrom({ hex: '#9C27B0' })).toBe('Roxo') // Material Purple
    })
  })

  describe('Red/Vermelho controls remain unchanged', () => {
    it('keeps dark burgundy as Vermelho', () => {
      // #762F55 is burgundy wine with slight purple tone but visually wine/red
      expect(inferFamilyFrom({ hex: '#762F55' })).toBe('Vermelho')
    })
  })
})
