import { defineConfig } from 'vitest/config'
export default defineConfig({
  test: {
    environment: 'node',
    include: ['app/src/tests/simple-sanity.test.ts','src/tests/simple-sanity.test.ts'],
    root: '.'
  }
})