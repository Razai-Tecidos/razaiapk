import { defineConfig } from 'vitest/config'
// Bisecting: remove react plugin & setupFiles; keep jsdom & alias for '@/'
import react from '@vitejs/plugin-react'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
const __dirname = path.dirname(fileURLToPath(import.meta.url))

// Step 3: reintroduce react plugin; expect failure replicates original issue if plugin is culprit.
export default defineConfig({
  plugins: [react()],
  resolve: { alias: { '@': path.resolve(__dirname, './src') } },
  test: {
    environment: 'jsdom',
    include: ['src/tests/**/*.{test,spec}.{ts,tsx}'],
    setupFiles: ['./src/tests/setup-env.ts']
  }
})
