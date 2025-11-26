import { describe, it, expect } from 'vitest'
import { inferFamilyFrom, hexToLab, labHueAngle, getHueBoundaries } from '@/lib/color-utils'

describe('Color #9B5C32 (Marrom Cobre) classification', () => {
  it('should analyze #9B5C32 LAB values', () => {
    const hex = '#9B5C32'
    const lab = hexToLab(hex)
    
    expect(lab).toBeDefined()
    if (!lab) return
    
    const hue = labHueAngle(lab)
    const chroma = Math.sqrt(lab.a * lab.a + lab.b * lab.b)
    const light = lab.L / 100
    
    console.log('\n═══════════════════════════════════════════════')
    console.log('         ANÁLISE: #9B5C32 (Marrom Cobre)')
    console.log('═══════════════════════════════════════════════')
    console.log('HEX:', hex)
    console.log('LAB: L=' + lab.L.toFixed(2) + ', a=' + lab.a.toFixed(2) + ', b=' + lab.b.toFixed(2))
    console.log('Hue:', hue.toFixed(2) + '°')
    console.log('Chroma:', chroma.toFixed(2))
    console.log('Lightness:', (light * 100).toFixed(2) + '%')
    console.log('')
    
    const bounds = getHueBoundaries()
    console.log('Boundaries:')
    console.log('  Laranja:', bounds.laranjaStart + '° -', bounds.amareloStart + '°')
    console.log('  Amarelo:', bounds.amareloStart + '° -', bounds.verdeStart + '°')
    console.log('  Marrom: hue 20-55° + L<45%')
    console.log('')
    
    // Verificações
    expect(hue).toBeGreaterThan(55) // Hue está acima de 55°
    expect(hue).toBeLessThan(95) // Hue está abaixo de 95° (range Amarelo)
    
    const family = inferFamilyFrom({ hex })
    console.log('Família inferida:', family)
    console.log('')
    
    // Após expansão, cobre deve ser Marrom
    if (family === 'Marrom') {
      console.log('✓ CORRETO: Classificou como Marrom (cobre)')
      console.log('  Hue=' + hue.toFixed(2) + '° dentro de 20–65° e L=' + lab.L.toFixed(2) + ' < 50')
    } else {
      console.log('❌ PROBLEMA: Esperado Marrom, recebeu', family)
    }
    console.log('═══════════════════════════════════════════════\n')
    
    // O teste deveria passar quando a cor for classificada corretamente
    expect(family).toBe('Marrom')
  })

  it('should understand why user perceives it as Marrom', () => {
    const hex = '#9B5C32'
    const lab = hexToLab(hex)!
    const light = lab.L / 100
    
    console.log('\nPOR QUE PARECE MARROM VISUALMENTE?')
    console.log('──────────────────────────────────')
    console.log('1. L=' + (light * 100).toFixed(2) + '% está próximo de 45% (limite Marrom)')
    console.log('2. Tons de cobre/bronze são percebidos como marrons')
    console.log('3. Hue ~57° está logo após o limite de Marrom (55°)')
    console.log('')
    console.log('SOLUÇÃO POSSÍVEL:')
    console.log('- Expandir Marrom até 65-70° para capturar tons de cobre')
    console.log('- Ou aceitar que "cobre" é tecnicamente amarelo escuro\n')
  })
})
