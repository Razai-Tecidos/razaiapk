import { describe, it, expect } from 'vitest'
import { inferFamilyFrom, hexToLab } from '@/lib/color-utils'

console.log('[VITEST DIAGNOSTIC] color-pink-classification.test.ts loaded')

describe('Pink/Rose color classification fixes', () => {
  console.log('[VITEST DIAGNOSTIC] Pink/Rose describe block executing')
  describe('Light pinks classified as Rosa (not Vermelho)', () => {
    it('classifies #DC8592 as Rosa (light pink)', () => {
      // RGB(220, 133, 146) - light pink/rose
      // Expected: Rosa (hue ~14.5°, a>15, b<a*0.6)
      const family = inferFamilyFrom({ hex: '#DC8592' })
      expect(family).toBe('Rosa')
    })

    it('classifies #E97989 as Rosa (light coral pink)', () => {
      // RGB(233, 121, 137) - coral pink
      const family = inferFamilyFrom({ hex: '#E97989' })
      expect(family).toBe('Rosa')
    })

    it('classifies #F2CCCE as Rosa (very light pink/pastel)', () => {
      // RGB(242, 204, 206) - pastel pink
      const family = inferFamilyFrom({ hex: '#F2CCCE' })
      expect(family).toBe('Rosa')
    })

    it('classifies #C7999E as Rosa (dusty rose)', () => {
      // RGB(199, 153, 158) - dusty rose/mauve
      const family = inferFamilyFrom({ hex: '#C7999E' })
      expect(family).toBe('Rosa')
    })
  })

  describe('Dark burgundy classified as Vermelho (not Rosa)', () => {
    it('classifies #762F55 as Vermelho (dark burgundy)', () => {
      // RGB(118, 47, 85) - dark burgundy/wine
      // Low lightness should not trigger Rosa rule
      const family = inferFamilyFrom({ hex: '#762F55' })
      expect(family).toBe('Vermelho')
    })
  })

  describe('Terracotta/salmon tones classified as Laranja (not Bege)', () => {
    it('classifies #C29188 as Rosa (rosa envelhecido)', () => {
      // RGB(194, 145, 136) - vintage rose / dusty salmon near 35° hue
      // Special-case for "rosa envelhecido" to match perception
      const family = inferFamilyFrom({ hex: '#C29188' })
      expect(family).toBe('Rosa')
    })

    it('classifies #C58C89 as Laranja (dusty coral)', () => {
      // RGB(197, 140, 137) - dusty coral
      const family = inferFamilyFrom({ hex: '#C58C89' })
      expect(family).toBe('Laranja')
    })

    it('classifies #DC9F9F as Rosa (light pink salmon)', () => {
      // RGB(220, 159, 159) - light pink salmon, G=B (neutral), visually pink
      // b* is low (~9), not orange. Chroma ~25 at boundary
      const family = inferFamilyFrom({ hex: '#DC9F9F' })
      expect(family).toBe('Rosa')
    })
  })

  describe('Vibrant coral/salmon correctly as Laranja', () => {
    it('classifies #E9A79E as Rosa (light coral pink)', () => {
      // RGB(233, 167, 158) - light coral pink, visually perceived as pink
      const family = inferFamilyFrom({ hex: '#E9A79E' })
      expect(family).toBe('Rosa')
    })

    it('classifies #EF8883 as Laranja (salmon)', () => {
      // RGB(239, 136, 131) - salmon
      const family = inferFamilyFrom({ hex: '#EF8883' })
      expect(family).toBe('Laranja')
    })

    it('classifies #E4AD8E as Laranja (peach/salmon)', () => {
      // RGB(228, 173, 142) - peach/salmon, hue ~60°
      // Now in expanded Laranja range (20-65°)
      const family = inferFamilyFrom({ hex: '#E4AD8E' })
      expect(family).toBe('Laranja')
    })
  })

  describe('Rosa rule details', () => {
    it('requires a* > 15 for Rosa classification', () => {
      // Low a* should not be Rosa
      expect(inferFamilyFrom({ labL: 60, labA: 10, labB: 3 })).not.toBe('Rosa')
    })

    it('requires b* < a*0.6 for Rosa classification', () => {
      // High b* relative to a* should not be Rosa (more orange)
      expect(inferFamilyFrom({ labL: 60, labA: 20, labB: 20 })).not.toBe('Rosa')
    })

    it('requires light > 0.45 for Rosa classification (dark wine becomes Bordô)', () => {
      // Dark colors (vinho) now fall into Bordô, not Rosa
      expect(inferFamilyFrom({ labL: 30, labA: 35, labB: 5 })).toBe('Bordô')
    })
  })

  describe('Bege exclusion of pinks', () => {
    it('does not classify pinks as Bege (hue < 30°)', () => {
      // Light desaturated pink should be Rosa, not Bege
      const result = inferFamilyFrom({ labL: 70, labA: 18, labB: 8 }) // hue ~24°
      expect(result).not.toBe('Bege')
    })

    it('still classifies beige tones correctly (hue >= 30°)', () => {
      // True beige with hue in safe range
      expect(inferFamilyFrom({ labL: 80, labA: 8, labB: 18 })).toBe('Bege') // hue ~66°
    })
  })

  describe('Dark vibrant pinks (fúcsia profundo)', () => {
    it('classifies #AF1E4A as Rosa (pink escuro vibrante)', () => {
      // RGB(175, 30, 74) - pink/fúcsia profundo, hue ~12°, L~38.8, croma alto
      const family = inferFamilyFrom({ hex: '#AF1E4A' })
      expect(family).toBe('Rosa')
    })
  })
})
