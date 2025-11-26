import { describe, it, expect } from 'vitest'

function sum(a: number, b: number) { return a + b }

describe('sanity', () => {
  it('adds 1 + 2 = 3', () => {
    expect(sum(1,2)).toBe(3)
  })
})
