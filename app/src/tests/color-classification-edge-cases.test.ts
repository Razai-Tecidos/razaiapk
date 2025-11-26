import { describe, it, expect } from 'vitest'
import { inferFamilyFrom, hexToLab } from '@/lib/color-utils'

describe('Color classification: Edge cases', () => {
  describe('Light desaturated yellows as Bege', () => {
    it('classifies #ECE6CC as Bege (light desaturated yellow)', () => {
      // #ECE6CC: RGB(236, 230, 204) - very light cream/beige
      // Expected LAB: L≈91, a≈-0.4, b≈13.3, chroma≈13.3, hue≈92°
      const lab = hexToLab('#ECE6CC')
      expect(lab).toBeDefined()
      if (!lab) return
      
      console.log('  #ECE6CC LAB:', { L: lab.L.toFixed(2), a: lab.a.toFixed(2), b: lab.b.toFixed(2) })
      console.log('  Chroma:', Math.sqrt(lab.a * lab.a + lab.b * lab.b).toFixed(2))
      
      const family = inferFamilyFrom({ hex: '#ECE6CC' })
      expect(family).toBe('Bege')
    })

    it('classifies similar light desaturated colors as Bege', () => {
      // Light cream/beige tones with chroma between 5-25
      expect(inferFamilyFrom({ labL: 90, labA: 2, labB: 15 })).toBe('Bege') // chroma≈15.1, hue≈82°
      expect(inferFamilyFrom({ labL: 85, labA: 5, labB: 20 })).toBe('Bege') // chroma≈20.6, hue≈76°
      expect(inferFamilyFrom({ labL: 92, labA: -1, labB: 12 })).toBe('Bege') // chroma≈12.04, hue≈94.8°
    })
  })

  describe('Very dark blue colors', () => {
    it('classifies #19192C as Azul (very dark blue with dominant negative b*)', () => {
      // #19192C: RGB(25, 25, 44) - very dark blue
      // Expected LAB: L≈7.2, a≈2.66, b≈-7.24, chroma≈7.7, hue≈290°
      // Despite hue being in Roxo range, should be Azul due to dominant negative b*
      const lab = hexToLab('#19192C')
      expect(lab).toBeDefined()
      if (!lab) return
      
      console.log('  #19192C LAB:', { L: lab.L.toFixed(2), a: lab.a.toFixed(2), b: lab.b.toFixed(2) })
      console.log('  Chroma:', Math.sqrt(lab.a * lab.a + lab.b * lab.b).toFixed(2))
      console.log('  Hue:', (Math.atan2(lab.b, lab.a) * 180 / Math.PI + 360) % 360)
      
      const family = inferFamilyFrom({ hex: '#19192C' })
      expect(family).toBe('Azul')
    })

    it('classifies similar dark blues as Azul', () => {
      // Very dark colors (L < 20%) with dominant negative b* (blue component)
      expect(inferFamilyFrom({ labL: 15, labA: 3, labB: -8 })).toBe('Azul') // |b| > |a|, b < -5
      expect(inferFamilyFrom({ labL: 10, labA: 2, labB: -10 })).toBe('Azul') // |b| > |a|, b < -5
      expect(inferFamilyFrom({ labL: 18, labA: 4, labB: -6 })).toBe('Azul') // |b| > |a|, b < -5
    })

    it('does NOT classify dark purples with equal a* and b* as Azul', () => {
      // If a* and b* are similar in magnitude, should follow normal hue classification
      expect(inferFamilyFrom({ labL: 15, labA: 8, labB: -8 })).not.toBe('Azul') // |a| = |b|, hue ~315° (Rosa range)
      
      // Dark color with weak b* (not < -5) falls back to hue-based classification
      // Use positive a* to get hue in Roxo range (~285°), not Azul
      expect(inferFamilyFrom({ labL: 12, labA: 4, labB: -4 })).not.toBe('Azul') // hue ~315° (Rosa), b=-4 not < -5
    })
  })

  describe('Boundary between Bege and Amarelo', () => {
    it('classifies high chroma yellows as Amarelo, not Bege', () => {
      // Chroma >= 25 should be chromatic Amarelo
      expect(inferFamilyFrom({ labL: 90, labA: 10, labB: 30 })).toBe('Amarelo') // chroma≈31.6
      expect(inferFamilyFrom({ labL: 85, labA: 15, labB: 35 })).toBe('Amarelo') // chroma≈38.1
    })

    it('classifies low lightness as not Bege', () => {
      // L <= 55% should not be Bege
      expect(inferFamilyFrom({ labL: 50, labA: 5, labB: 15 })).not.toBe('Bege')
      expect(inferFamilyFrom({ labL: 40, labA: 8, labB: 18 })).not.toBe('Bege')
    })
  })
})
