import { test, expect } from 'vitest'

console.log('[simple-sanity] test typeof =', typeof test)
console.log('[simple-sanity] import.meta.env keys =', Object.keys((import.meta as any).env || {}))

test('basic addition', () => {
  console.log('[simple-sanity] inside test body')
  expect(1 + 1).toBe(2)
})
