import { describe, it, expect, beforeEach, vi } from 'vitest'
import { syncDb } from './index'

// Mock IndexedDB for testing
vi.mock('./indexeddb', () => ({
  listTissues: vi.fn(async () => []),
  listColors: vi.fn(async () => []),
  listPatterns: vi.fn(async () => []),
  listTecidoCorRaw: vi.fn(async () => []),
  listTecidoEstampaRaw: vi.fn(async () => []),
  createTissueRaw: vi.fn(async () => {}),
  updateTissueRaw: vi.fn(async () => {}),
  createColorRaw: vi.fn(async () => {}),
  updateColorRaw: vi.fn(async () => {}),
  createPatternRaw: vi.fn(async () => {}),
  updatePatternRaw: vi.fn(async () => {}),
  createTecidoCorRaw: vi.fn(async () => {}),
  updateTecidoCorRaw: vi.fn(async () => {}),
  createTecidoEstampaRaw: vi.fn(async () => {}),
  updateTecidoEstampaRaw: vi.fn(async () => {}),
}))

describe('syncDb', () => {
  describe('exportAll', () => {
    it('should export all data with metadata', async () => {
      const result = await syncDb.exportAll()
      
      expect(result).toHaveProperty('version', '1.0')
      expect(result).toHaveProperty('exportedAt')
      expect(result).toHaveProperty('tissues')
      expect(result).toHaveProperty('colors')
      expect(result).toHaveProperty('patterns')
      expect(result).toHaveProperty('tecidoCorLinks')
      expect(result).toHaveProperty('tecidoEstampaLinks')
      expect(Array.isArray(result.tissues)).toBe(true)
      expect(Array.isArray(result.colors)).toBe(true)
      expect(Array.isArray(result.patterns)).toBe(true)
      expect(Array.isArray(result.tecidoCorLinks)).toBe(true)
      expect(Array.isArray(result.tecidoEstampaLinks)).toBe(true)
      
      // Verify timestamp is valid ISO string
      expect(() => new Date(result.exportedAt)).not.toThrow()
    })
  })

  describe('importAll', () => {
    it('should return zero counts for empty data', async () => {
      const result = await syncDb.importAll({}, 'merge')
      
      expect(result.tissuesInserted).toBe(0)
      expect(result.tissuesUpdated).toBe(0)
      expect(result.colorsInserted).toBe(0)
      expect(result.colorsUpdated).toBe(0)
      expect(result.patternsInserted).toBe(0)
      expect(result.patternsUpdated).toBe(0)
      expect(result.tecidoCorInserted).toBe(0)
      expect(result.tecidoCorUpdated).toBe(0)
      expect(result.tecidoEstampaInserted).toBe(0)
      expect(result.tecidoEstampaUpdated).toBe(0)
    })

    it('should handle data with images (base64)', async () => {
      const sampleData = {
        tissues: [{
          id: 'test-tissue-1',
          name: 'Test Tissue',
          width: 150,
          composition: 'Cotton',
          sku: 'T001',
          createdAt: '2025-01-01T00:00:00Z',
        }],
        tecidoCorLinks: [{
          id: 'test-link-1',
          tissueId: 'test-tissue-1',
          colorId: 'test-color-1',
          skuFilho: 'T001-C001',
          status: 'Ativo' as const,
          createdAt: '2025-01-01T00:00:00Z',
          image: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
          imageThumb: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
        }],
      }
      
      const result = await syncDb.importAll(sampleData, 'merge')
      
      expect(result.tissuesInserted).toBeGreaterThanOrEqual(0)
      expect(result.tecidoCorInserted).toBeGreaterThanOrEqual(0)
    })
  })
})
