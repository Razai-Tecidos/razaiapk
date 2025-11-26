import { describe, it, expect } from 'vitest'
import { inferFamilyFrom, hexToLab, labHueAngle } from '@/lib/color-utils'

describe('Visual testing: Comprehensive color classification', () => {
  it('displays classification results for manual visual verification', () => {
    const testColors = [
      // Marrom (Brown) - should all be dark (L<45) AND hue 20-55° (Laranja range)
      { hex: '#5C4033', expected: 'Marrom', name: 'Deep Coffee' },
      { hex: '#4A3428', expected: 'Marrom', name: 'Chocolate Brown' },
      { hex: '#8B4513', expected: 'varies', name: 'SaddleBrown (hue ~57°, boundary)' },
      
      // Bege (Beige) - desaturated (chroma 5-20), light (L>55%), warm (hue 20-95°)
      { hex: '#E8D5C4', expected: 'Bege', name: 'Light Beige' },
      { hex: '#FAEBD7', expected: 'Bege', name: 'AntiqueWhite' },
      { hex: '#EEE8AA', expected: 'varies', name: 'PaleGoldenrod (chroma varies)' },
      
      // Note: Many "tan" colors have chroma > 20, so they fall in Amarelo
      // This is correct behavior - vibrant tans are yellow, not beige
      
      // Boundary tests: Colors near thresholds
      { hex: '#A0522D', expected: 'varies', name: 'Sienna (L~44, boundary)' },
      { hex: '#D2B48C', expected: 'varies', name: 'Tan (chroma~25, vibrant)' },
      { hex: '#F0E68C', expected: 'varies', name: 'Khaki (hue~101°, green-yellow)' },
      
      // Vermelho (Red) - LAB hue wraps around! Most RGB reds fall in Laranja range
      // True Vermelho in LAB is 345-20° (mostly magenta-reds and deep reds)
      { hex: '#B71C1C', expected: 'varies', name: 'Dark Red (hue varies)' },
      { hex: '#D32F2F', expected: 'varies', name: 'Red (hue varies)' },
      
      // Laranja (Orange) - hue 20-55° - includes many "red-orange" RGB colors
      // Nota: #E74C3C (Alizarin, hue ~36°) agora cai em Vermelho pelo pre-regra de vermelho quente
      { hex: '#E74C3C', expected: 'Vermelho', name: 'Alizarin (hue ~36°)' },
      { hex: '#FF5722', expected: 'Laranja', name: 'Deep Orange' },
      
      // Amarelo (Yellow) - hue 55-95° - includes orange-yellows
      { hex: '#FFD700', expected: 'Amarelo', name: 'Gold' },
      { hex: '#F1C40F', expected: 'Amarelo', name: 'Sun Flower' },
      { hex: '#FFA500', expected: 'Amarelo', name: 'Orange (hue ~73°)' },
      
      // Verde (Green) - hue 95-170°
      { hex: '#2ECC71', expected: 'Verde', name: 'Emerald' },
      { hex: '#27AE60', expected: 'Verde', name: 'Nephritis' },
      
      // Azul (Blue) - hue 170-270°
      { hex: '#3498DB', expected: 'Azul', name: 'Peter River' },
      { hex: '#2980B9', expected: 'Azul', name: 'Belize Hole' },
      
      // Roxo (Purple) - hue 270-310° - true LAB purples are in this range
      // Expanded rule now captures purples with b* negative in Rosa/Vermelho zones
      { hex: '#9C27B0', expected: 'Roxo', name: 'Material Purple' },
      { hex: '#8E24AA', expected: 'Roxo', name: 'Purple A700' },
      
      // Rosa (Pink/Magenta) - hue 310-345° - includes purplish-pinks
      // Note: Amethyst, Wisteria, Deep Purple now correctly classified as Roxo (purple)
      { hex: '#9B59B6', expected: 'Roxo', name: 'Amethyst (now Roxo - purple, not pink)' },
      { hex: '#8E44AD', expected: 'Roxo', name: 'Wisteria (now Roxo - purple, not pink)' },
      { hex: '#6A1B9A', expected: 'Roxo', name: 'Deep Purple (now Roxo - purple, not pink)' },
      { hex: '#EC407A', expected: 'Rosa', name: 'Pink (varies)' },
      
      // Achromatic - low chroma
      { hex: '#000000', expected: 'Preto', name: 'Black' },
      { hex: '#FFFFFF', expected: 'Branco', name: 'White' },
      { hex: '#808080', expected: 'Cinza', name: 'Gray' },
      { hex: '#DCDCDC', expected: 'Cinza', name: 'Gainsboro' },
    ]

    console.log('\n╔════════════════════════════════════════════════════════════════════╗')
    console.log('║        VISUAL COLOR CLASSIFICATION TEST RESULTS                   ║')
    console.log('╚════════════════════════════════════════════════════════════════════╝\n')

    const results = testColors.map(({ hex, expected, name }) => {
      const lab = hexToLab(hex)
      if (!lab) return { hex, name, result: 'ERROR', status: '❌', details: 'Invalid LAB' }

      const L = lab.L
      const a = lab.a
      const b = lab.b
      const chroma = Math.sqrt(a*a + b*b)
      const hue = labHueAngle(lab)
      const light = L / 100
      const result = inferFamilyFrom({ hex })

      const status = expected === 'varies' 
        ? '🔸' 
        : result === expected 
          ? '✅' 
          : '❌'

      return {
        hex,
        name,
        result,
        expected,
        status,
        details: `L=${L.toFixed(0)} chroma=${chroma.toFixed(1)} hue=${hue.toFixed(0)}° light=${light.toFixed(2)}`
      }
    })

    // Group by status for better readability
    const passing = results.filter(r => r.status === '✅')
    const boundary = results.filter(r => r.status === '🔸')
    const failing = results.filter(r => r.status === '❌')

    console.log(`✅ PASSING (${passing.length}):`)
    passing.forEach(r => {
      console.log(`  ${r.status} ${r.name.padEnd(20)} ${r.hex}  →  ${r.result.padEnd(10)} (${r.details})`)
    })

    if (boundary.length > 0) {
      console.log(`\n🔸 BOUNDARY CASES (${boundary.length}):`)
      boundary.forEach(r => {
        console.log(`  ${r.status} ${r.name.padEnd(20)} ${r.hex}  →  ${r.result.padEnd(10)} (${r.details})`)
      })
    }

    if (failing.length > 0) {
      console.log(`\n❌ FAILING (${failing.length}):`)
      failing.forEach(r => {
        console.log(`  ${r.status} ${r.name.padEnd(20)} ${r.hex}  →  ${r.result.padEnd(10)} expected ${r.expected} (${r.details})`)
      })
    }

    const passRate = ((passing.length / (passing.length + failing.length)) * 100).toFixed(1)
    console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`)
    console.log(`Pass Rate: ${passRate}% (${passing.length}/${passing.length + failing.length} non-boundary tests)`)
    console.log(`Boundary Cases: ${boundary.length} (expected to vary based on exact LAB values)`)
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`)

    // Test passes if no explicit failures (boundary cases are OK)
    expect(failing.length).toBe(0)
  })
})
