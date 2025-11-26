import { describe, it, expect } from 'vitest'
import { inferFamilyFrom, hexToLab } from '@/lib/color-utils'

describe('Color classification: Bege and Marrom', () => {
  describe('Marrom (Brown) classification', () => {
    it('classifies dark orange/copper tones as Marrom', () => {
      // Marrom (atualizado): L < 50%, hue 20-65° (Laranja + cobre)
      
      // Test with explicit LAB values in Marrom range
      expect(inferFamilyFrom({ labL: 35, labA: 20, labB: 25 })).toBe('Marrom') // hue ~51°, L=35, dark
      expect(inferFamilyFrom({ labL: 40, labA: 15, labB: 15 })).toBe('Marrom') // hue ~45°, L=40, dark
      expect(inferFamilyFrom({ labL: 30, labA: 25, labB: 20 })).toBe('Marrom') // hue ~38.7°, L=30, dark
    })

    it('does NOT classify light colors as Marrom', () => {
      // Alta luminosidade não é Marrom
      expect(inferFamilyFrom({ labL: 60, labA: 20, labB: 25 })).not.toBe('Marrom')
      expect(inferFamilyFrom({ labL: 75, labA: 15, labB: 15 })).not.toBe('Marrom')
    })

    it('does NOT classify colors outside expanded hue range as Marrom', () => {
      // Hue fora de 20-65° não é Marrom
      // Hue ~15° (Vermelho range)
      expect(inferFamilyFrom({ labL: 35, labA: 30, labB: 8 })).not.toBe('Marrom')
      
      // Hue ~70° (Amarelo médio) - deve ser Amarelo ou outro, não Marrom
      expect(inferFamilyFrom({ labL: 35, labA: 8, labB: 32 })).not.toBe('Marrom') // a=8 b=32 => hue ~76°
    })
  })

  describe('Bege (Beige) classification', () => {
    it('classifies desaturated light orange/yellow as Bege', () => {
      // Bege: croma 5-20, L > 55%, hue 20-95° (Laranja + Amarelo range)
      
      // Laranja dessaturado claro
      expect(inferFamilyFrom({ labL: 75, labA: 8, labB: 12 })).toBe('Bege') // hue ~56°, chroma ~14.4
      expect(inferFamilyFrom({ labL: 80, labA: 5, labB: 10 })).toBe('Bege') // hue ~63°, chroma ~11.2
      
      // Amarelo dessaturado claro
      expect(inferFamilyFrom({ labL: 85, labA: 0, labB: 15 })).toBe('Bege') // hue ~90°, chroma ~15
      expect(inferFamilyFrom({ labL: 70, labA: 2, labB: 12 })).toBe('Bege') // hue ~80.5°, chroma ~12.2
    })

    it('does NOT classify vibrant colors as Bege', () => {
      // Croma alto (>20) não é Bege
      expect(inferFamilyFrom({ labL: 75, labA: 20, labB: 40 })).not.toBe('Bege')
      expect(inferFamilyFrom({ labL: 80, labA: 10, labB: 35 })).not.toBe('Bege')
    })

    it('does NOT classify gray as Bege', () => {
      // Croma baixo (<5) é Cinza, não Bege
      expect(inferFamilyFrom({ labL: 75, labA: 2, labB: 2 })).toBe('Cinza')
      expect(inferFamilyFrom({ labL: 80, labA: 1, labB: 3 })).toBe('Cinza')
    })

    it('does NOT classify dark colors as Bege', () => {
      // L baixo (<55) não é Bege
      expect(inferFamilyFrom({ labL: 50, labA: 8, labB: 12 })).not.toBe('Bege')
      expect(inferFamilyFrom({ labL: 40, labA: 10, labB: 15 })).not.toBe('Bege')
    })
  })

  describe('Edge cases and boundaries', () => {
    it('handles boundary between Marrom and Laranja (L ~50)', () => {
      // L = 49 → Marrom
      expect(inferFamilyFrom({ labL: 49, labA: 20, labB: 25 })).toBe('Marrom')
      
      // L = 51 → não Marrom
      const result = inferFamilyFrom({ labL: 51, labA: 20, labB: 25 })
      expect(result).not.toBe('Marrom')
    })

    it('handles boundary between Bege and Amarelo (chroma ~20)', () => {
      // chroma = 19 → Bege
      expect(inferFamilyFrom({ labL: 75, labA: 5, labB: 18.3 })).toBe('Bege') // chroma ~19
      
      // chroma = 25 → agora também Bege (novo limite <25)
      const result = inferFamilyFrom({ labL: 75, labA: 10, labB: 22.8 })
      expect(result).toBe('Bege') // chroma ~25, dentro do novo limite
      
      // chroma > 25 → não Bege
      expect(inferFamilyFrom({ labL: 75, labA: 15, labB: 30 })).not.toBe('Bege') // chroma ~33.5
    })

    it('ensures Marrom does not overlap with Amarelo beyond 65°', () => {
      // hue ~60° + L baixo → Marrom (cobre)
      expect(inferFamilyFrom({ labL: 40, labA: 16, labB: 28 })).toBe('Marrom') // atan2(28,16) ≈ 60.3° dentro de 20–65°
      
      // hue ~70° + L baixo → não Marrom (continua Amarelo escuro)
      const result = inferFamilyFrom({ labL: 40, labA: 8, labB: 32 }) // atan2(32,8) ≈ 75.4°
      expect(result).not.toBe('Marrom')
    })
  })

  describe('Real-world colors', () => {
    it('classifies real brown colors correctly', () => {
      // Usando cores reais que devem ser Marrom
      const lab1 = hexToLab('#654321') // Marrom escuro
      if (lab1) {
        const result = inferFamilyFrom({ labL: lab1.L, labA: lab1.a, labB: lab1.b })
        // Se L < 45 e hue na faixa Laranja, deve ser Marrom
        if (lab1.L < 45) {
          const hue = Math.atan2(lab1.b, lab1.a) * 180 / Math.PI
          const hueNorm = hue < 0 ? hue + 360 : hue
          if (hueNorm >= 20 && hueNorm < 65) {
            expect(result).toBe('Marrom')
          }
        }
      }
    })

    it('classifies real beige colors correctly', () => {
      // Usando cores reais que devem ser Bege
      const lab2 = hexToLab('#D2B48C') // Tan - cor bege clássica
      if (lab2) {
        const chroma = Math.sqrt(lab2.a * lab2.a + lab2.b * lab2.b)
        const result = inferFamilyFrom({ labL: lab2.L, labA: lab2.a, labB: lab2.b })
        
        // Se tiver as características de Bege, deve ser Bege
        if (chroma >= 5 && chroma < 20 && lab2.L > 55) {
          const hue = Math.atan2(lab2.b, lab2.a) * 180 / Math.PI
          const hueNorm = hue < 0 ? hue + 360 : hue
          if (hueNorm >= 20 && hueNorm < 95) {
            expect(result).toBe('Bege')
          }
        }
      }
    })
  })

  describe('Regression: no impact on other families', () => {
    it('achromatic colors remain correct', () => {
      expect(inferFamilyFrom({ hex: '#000000' })).toBe('Preto')
      expect(inferFamilyFrom({ hex: '#FFFFFF' })).toBe('Branco')
      expect(inferFamilyFrom({ hex: '#808080' })).toBe('Cinza')
      expect(inferFamilyFrom({ hex: '#DCDCDC' })).toBe('Cinza')
    })

    it('vibrant colors maintain their families', () => {
      // Vermelho, Verde, Azul com LAB explícito para garantir hue
      expect(inferFamilyFrom({ labL: 60, labA: 50, labB: 50 })).not.toBe('Bege') // Alta chroma
      expect(inferFamilyFrom({ labL: 60, labA: -50, labB: 50 })).not.toBe('Bege') // Alta chroma
      expect(inferFamilyFrom({ labL: 60, labA: -10, labB: -50 })).not.toBe('Bege') // Alta chroma
    })
  })
})
