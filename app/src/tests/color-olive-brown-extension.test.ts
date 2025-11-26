import { describe, it, expect } from 'vitest'
import { inferFamilyFrom } from '@/lib/color-utils'

describe('Marrom oliva escuro - extensão de regra', () => {
  it('classifica tons oliva escuros como Marrom (não Amarelo/Verde)', () => {
    expect(inferFamilyFrom({ hex: '#605739' })).toBe('Marrom') // Dark Olive Brown
    expect(inferFamilyFrom({ hex: '#75644B' })).toBe('Marrom') // Olive Brown Mid
    expect(inferFamilyFrom({ hex: '#5E4D35' })).toBe('Marrom') // Dark Brown Olive
  })

  it('mantém #313732 como Cinza (chroma < 5)', () => {
    expect(inferFamilyFrom({ hex: '#313732' })).toBe('Cinza')
  })

  it('não afeta amarelos vibrantes e verdes claros', () => {
    expect(inferFamilyFrom({ hex: '#FFD700' })).toBe('Amarelo') // Gold
    expect(inferFamilyFrom({ hex: '#F0E68C' })).toBe('Verde') // Khaki verde-amarelado (nos testes visuais varia para Verde)
  })
})
