import { describe, it, expect } from 'vitest'
import { inferFamilyFrom } from '@/lib/color-utils'

describe('Extended Marrom classification for medium-light warm browns', () => {
  it('classifies #A67655 as Marrom (warm medium brown)', () => {
    expect(inferFamilyFrom({ hex: '#A67655' })).toBe('Marrom')
  })
  it('classifies #AE8260 as Marrom (warm light brown)', () => {
    expect(inferFamilyFrom({ hex: '#AE8260' })).toBe('Marrom')
  })
})
