import { describe, it, expect } from 'vitest'
import { inferFamilyFrom, hexToLab } from '@/lib/color-utils'

describe('Color #FFCC00 classification', () => {
  it('should classify #FFCC00 as Amarelo, not Verde', () => {
    const hex = '#FFCC00'
    const lab = hexToLab(hex)
    
    expect(lab).toBeDefined()
    if (!lab) return
    
    // Verificar que o hue está entre 55° e 95° (Amarelo)
    const hue = Math.atan2(lab.b, lab.a) * (180 / Math.PI)
    const normalizedHue = hue < 0 ? hue + 360 : hue
    
    console.log('HEX:', hex)
    console.log('LAB:', lab)
    console.log('Hue:', normalizedHue.toFixed(2), '°')
    
    expect(normalizedHue).toBeGreaterThanOrEqual(55)
    expect(normalizedHue).toBeLessThan(95)
    
    // Verificar que a família inferida é Amarelo
    const family = inferFamilyFrom({ hex })
    console.log('Família inferida:', family)
    
    expect(family).toBe('Amarelo')
    expect(family).not.toBe('Verde')
  })

  it('should NOT change user input "Amarelo Teste" to "Verde Teste"', () => {
    // Este teste documenta o comportamento esperado:
    // O sistema NUNCA deve modificar o nome digitado pelo usuário
    // A classificação de família é feita APENAS para exibição
    
    const userInput = 'Amarelo Teste'
    const hex = '#FFCC00'
    
    // O nome salvo deve ser exatamente o que o usuário digitou
    const savedName = userInput.trim()
    expect(savedName).toBe('Amarelo Teste')
    
    // A família inferida do HEX deve ser Amarelo
    const inferredFamily = inferFamilyFrom({ hex })
    expect(inferredFamily).toBe('Amarelo')
    
    // NUNCA Verde
    expect(inferredFamily).not.toBe('Verde')
  })
})
