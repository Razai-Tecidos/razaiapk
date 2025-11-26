import { describe, it, expect } from 'vitest'
import { inferFamilyFrom } from '../lib/color-utils'

describe('User-reported color batch verification', () => {
  it('verifies all 10 user-reported colors classify correctly', () => {
    const colors = [
      { hex: '#DC8592', expected: 'Rosa', description: 'light pink, previously Vermelho' },
      { hex: '#E97989', expected: 'Rosa', description: 'light coral pink, previously Vermelho' },
      { hex: '#F2CCCE', expected: 'Rosa', description: 'very light pastel pink, previously Vermelho' },
      { hex: '#C7999E', expected: 'Rosa', description: 'dusty rose, previously Vermelho' },
      { hex: '#762F55', expected: 'Vermelho', description: 'dark burgundy, previously Rosa' },
      { hex: '#C29188', expected: 'Rosa', description: 'rosa envelhecido (vintage rose), previously Laranja' },
      { hex: '#C58C89', expected: 'Laranja', description: 'dusty coral, previously Bege' },
      { hex: '#DC9F9F', expected: 'Rosa', description: 'light pink salmon (visually pink, not orange)' },
      { hex: '#E9A79E', expected: 'Rosa', description: 'light coral pink (visually pink)' },
      { hex: '#EF8883', expected: 'Laranja', description: 'salmon, was correct' },
    ]

    console.log('\n╔════════════════════════════════════════════════════════════════════╗')
    console.log('║        USER-REPORTED COLORS - FINAL VERIFICATION                   ║')
    console.log('╚════════════════════════════════════════════════════════════════════╝\n')

    const results = colors.map(({ hex, expected, description }) => {
      const actual = inferFamilyFrom({ hex })
      const status = actual === expected ? '✅' : '❌'
      return { hex, expected, actual, status, description, correct: actual === expected }
    })

    results.forEach(({ hex, expected, actual, status, description }) => {
      console.log(`${status} ${hex}  →  ${actual.padEnd(9)}  (expected: ${expected.padEnd(9)})`)
      console.log(`   ${description}\n`)
    })

    const correctCount = results.filter(r => r.correct).length
    const totalCount = results.length
    const percentage = ((correctCount / totalCount) * 100).toFixed(1)

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    console.log(`Pass Rate: ${percentage}% (${correctCount}/${totalCount} correct)\n`)

    // Assert all are correct
    results.forEach(({ hex, expected, actual }) => {
      expect(actual).toBe(expected)
    })
  })
})
