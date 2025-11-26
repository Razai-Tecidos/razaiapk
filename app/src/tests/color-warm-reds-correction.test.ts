import { describe, it, expect } from 'vitest'
import { inferFamilyFrom } from '@/lib/color-utils'

describe('Correção: vermelhos quentes (20–40°) devem ser Vermelho', () => {
  it('classifica os vermelhos reportados como Vermelho', () => {
    expect(inferFamilyFrom({ hex: '#CC3227' })).toBe('Vermelho')
    expect(inferFamilyFrom({ hex: '#9A2626' })).toBe('Vermelho')
    expect(inferFamilyFrom({ hex: '#750919' })).toBe('Vermelho')
    expect(inferFamilyFrom({ hex: '#D12626' })).toBe('Vermelho')
    expect(inferFamilyFrom({ hex: '#BA3543' })).toBe('Vermelho')
  })

  it('reclassifica também #E15B55 como Vermelho (vermelho salmão vivo)', () => {
    expect(inferFamilyFrom({ hex: '#E15B55' })).toBe('Vermelho')
  })
})
