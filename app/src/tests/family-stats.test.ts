import { describe, it, expect, beforeEach } from 'vitest'
import { familyStatsDb, colorsDb } from '@/lib/db'
import { labHueAngle } from '@/lib/color-utils'

describe('Family Statistics System', () => {
  beforeEach(async () => {
    // Clear all data before each test
    await colorsDb.clearAllColors()
    // Also clear family stats
    if (typeof window !== 'undefined') {
      const { getDb } = await import('@/lib/db/indexeddb')
      const db = await getDb()
      await db.clear('family_stats')
    }
  })

  describe('familyStatsDb.updateStat', () => {
    it('should create new stat for first color in family', async () => {
      await familyStatsDb.updateStat('Vermelho', 10)
      
      const stats = await familyStatsDb.list()
      const vermelho = stats.find(s => s.familyName === 'Vermelho')
      
      expect(vermelho).toBeDefined()
      expect(vermelho?.hueMin).toBe(10)
      expect(vermelho?.hueMax).toBe(10)
      expect(vermelho?.hueAvg).toBe(10)
      expect(vermelho?.colorCount).toBe(1)
    })

    it('should update existing stat when adding second color', async () => {
      await familyStatsDb.updateStat('Vermelho', 10)
      await familyStatsDb.updateStat('Vermelho', 20)
      
      const stats = await familyStatsDb.list()
      const vermelho = stats.find(s => s.familyName === 'Vermelho')
      
      expect(vermelho?.hueMin).toBe(10)
      expect(vermelho?.hueMax).toBe(20)
      expect(vermelho?.hueAvg).toBe(15) // (10 + 20) / 2
      expect(vermelho?.colorCount).toBe(2)
    })

    it('should handle hue wrap-around correctly (350° + 10°)', async () => {
      await familyStatsDb.updateStat('Vermelho', 350)
      await familyStatsDb.updateStat('Vermelho', 10)
      
      const stats = await familyStatsDb.list()
      const vermelho = stats.find(s => s.familyName === 'Vermelho')
      
      expect(vermelho?.hueMin).toBe(10)
      expect(vermelho?.hueMax).toBe(350)
      expect(vermelho?.colorCount).toBe(2)
    })

    it('should calculate incremental average correctly', async () => {
      await familyStatsDb.updateStat('Azul', 200)
      await familyStatsDb.updateStat('Azul', 210)
      await familyStatsDb.updateStat('Azul', 230)
      
      const stats = await familyStatsDb.list()
      const azul = stats.find(s => s.familyName === 'Azul')
      
      // Average: (200 + 210 + 230) / 3 = 213.33...
      expect(azul?.hueAvg).toBeCloseTo(213.33, 1)
      expect(azul?.colorCount).toBe(3)
    })
  })

  describe('createColor integration', () => {
    it('should automatically update stats when creating color with name-based family', async () => {
      await colorsDb.createColor({
        name: 'Laranja Queimado',
        hex: '#D2691E',
        labL: 50,
        labA: 30,
        labB: 40
      })

      const stats = await familyStatsDb.list()
      const laranja = stats.find(s => s.familyName === 'Laranja')
      
      expect(laranja).toBeDefined()
      expect(laranja?.colorCount).toBe(1)
      
      const expectedHue = labHueAngle({ L: 50, a: 30, b: 40 })
      expect(laranja?.hueAvg).toBeCloseTo(expectedHue, 1)
    })

    it('should create new custom family "Salmão" and track stats', async () => {
      await colorsDb.createColor({
        name: 'Salmão Claro',
        hex: '#FA8072',
        labL: 70,
        labA: 35,
        labB: 20
      })

      const stats = await familyStatsDb.list()
      const salmao = stats.find(s => s.familyName === 'Salmão')
      
      expect(salmao).toBeDefined()
      expect(salmao?.colorCount).toBe(1)
      expect(salmao?.familyName).toBe('Salmão')
    })

    it('should accumulate stats for multiple colors in same family', async () => {
      await colorsDb.createColor({
        name: 'Verde Musgo',
        hex: '#8FBC8F',
        labL: 60,
        labA: -20,
        labB: 15
      })

      await colorsDb.createColor({
        name: 'Verde Esmeralda',
        hex: '#50C878',
        labL: 65,
        labA: -40,
        labB: 25
      })

      const stats = await familyStatsDb.list()
      const verde = stats.find(s => s.familyName === 'Verde')
      
      expect(verde).toBeDefined()
      expect(verde?.colorCount).toBe(2)
      expect(verde?.hueMin).toBeLessThan(verde!.hueMax)
    })

    it('should use LAB fallback when name has no family', async () => {
      // Nome começando com número força fallback para LAB
      await colorsDb.createColor({
        name: '123 Teste',
        hex: '#FF0000',
        labL: 53,
        labA: 80,
        labB: 67
      })

      const stats = await familyStatsDb.list()
      // Should fall back to LAB classification (likely "Vermelho" or "Laranja")
      expect(stats.length).toBeGreaterThan(0)
      
      const colors = await colorsDb.listColors()
      const color = colors.find(c => c.name === '123 Teste')
      expect(color?.sku).toMatch(/^(VM|LJ|AZ|VD|AM|RX|MG|BO|MR|BG|CZ|PT|BR)/)
    })
  })

  describe('familyStatsDb.recalculateAll', () => {
    it('should rebuild all stats from scratch', async () => {
      // Create some colors
      await colorsDb.createColor({
        name: 'Azul Celeste',
        hex: '#87CEEB',
        labL: 75,
        labA: -10,
        labB: -25
      })

      await colorsDb.createColor({
        name: 'Azul Marinho',
        hex: '#000080',
        labL: 20,
        labA: 20,
        labB: -50
      })

      await colorsDb.createColor({
        name: 'Roxo Profundo',
        hex: '#6A0DAD',
        labL: 30,
        labA: 50,
        labB: -60
      })

      // Recalculate all stats
      const result = await familyStatsDb.recalculateAll()
      
      expect(result.totalColors).toBe(3)
      expect(result.totalFamilies).toBeGreaterThanOrEqual(2) // At least Azul and Roxo

      const stats = await familyStatsDb.list()
      const azul = stats.find(s => s.familyName === 'Azul')
      const roxo = stats.find(s => s.familyName === 'Roxo')
      
      expect(azul?.colorCount).toBe(2)
      expect(roxo?.colorCount).toBe(1)
    })

    it('should handle empty database', async () => {
      const result = await familyStatsDb.recalculateAll()
      
      expect(result.totalColors).toBe(0)
      expect(result.totalFamilies).toBe(0)
      
      const stats = await familyStatsDb.list()
      expect(stats).toHaveLength(0)
    })

    it('should clear old stats before recalculating', async () => {
      // Create initial stats
      await familyStatsDb.updateStat('Teste', 100)
      
      let stats = await familyStatsDb.list()
      expect(stats.some(s => s.familyName === 'Teste')).toBe(true)
      
      // Recalculate with no colors
      await familyStatsDb.recalculateAll()
      
      stats = await familyStatsDb.list()
      expect(stats.some(s => s.familyName === 'Teste')).toBe(false)
    })
  })

  describe('Custom family support', () => {
    it('should create stats for custom family "Terracota"', async () => {
      await colorsDb.createColor({
        name: 'Terracota Escura',
        hex: '#CC8866',
        labL: 55,
        labA: 15,
        labB: 25
      })

      const stats = await familyStatsDb.list()
      const terracota = stats.find(s => s.familyName === 'Terracota')
      
      expect(terracota).toBeDefined()
      expect(terracota?.familyName).toBe('Terracota')
    })

    it('should handle multiple custom families', async () => {
      await colorsDb.createColor({
        name: 'Salmão Rosado',
        hex: '#FA8072',
        labL: 70,
        labA: 35,
        labB: 20
      })

      await colorsDb.createColor({
        name: 'Cobre Antigo',
        hex: '#B87333',
        labL: 50,
        labA: 18,
        labB: 35
      })

      await colorsDb.createColor({
        name: 'Bordô Imperial',
        hex: '#800020',
        labL: 25,
        labA: 45,
        labB: 10
      })

      const stats = await familyStatsDb.list()
      
      expect(stats.some(s => s.familyName === 'Salmão')).toBe(true)
      expect(stats.some(s => s.familyName === 'Cobre')).toBe(true)
      expect(stats.some(s => s.familyName === 'Bordô')).toBe(true)
      expect(stats.length).toBeGreaterThanOrEqual(3)
    })
  })

  describe('Stats ordering', () => {
    it('should return stats ordered by hueAvg', async () => {
      await colorsDb.createColor({
        name: 'Amarelo Ouro',
        hex: '#FFD700',
        labL: 80,
        labA: 5,
        labB: 75
      })

      await colorsDb.createColor({
        name: 'Vermelho Sangue',
        hex: '#8B0000',
        labL: 30,
        labA: 50,
        labB: 40
      })

      await colorsDb.createColor({
        name: 'Azul Anil',
        hex: '#4B0082',
        labL: 25,
        labA: 30,
        labB: -50
      })

      const stats = await familyStatsDb.list()
      
      // Stats should be ordered by hueAvg (circular order)
      for (let i = 1; i < stats.length; i++) {
        // Allow for circular wrap-around
        const prevHue = stats[i - 1].hueAvg
        const currHue = stats[i].hueAvg
        
        // Either increasing or wrapping around (359 -> 0)
        const isIncreasing = currHue >= prevHue
        const isWrapping = prevHue > 300 && currHue < 60
        
        expect(isIncreasing || isWrapping).toBe(true)
      }
    })
  })

  describe('Edge cases', () => {
    it('should handle color with no LAB data', async () => {
      await colorsDb.createColor({
        name: 'Verde Teste',
        hex: '#00FF00',
        // No LAB data provided
      })

      const stats = await familyStatsDb.list()
      const verde = stats.find(s => s.familyName === 'Verde')
      
      // When LAB data is missing, stats are NOT created (hue calculation requires LAB)
      // Family and SKU are still assigned based on name, but stats tracking is skipped
      expect(verde).toBeUndefined()
    })

    it('should handle very similar hues in same family', async () => {
      await colorsDb.createColor({
        name: 'Azul A',
        hex: '#0000FF',
        labL: 50,
        labA: 20,
        labB: -80
      })

      await colorsDb.createColor({
        name: 'Azul B',
        hex: '#0000FE',
        labL: 50,
        labA: 20,
        labB: -79
      })

      const stats = await familyStatsDb.list()
      const azul = stats.find(s => s.familyName === 'Azul')
      
      expect(azul?.colorCount).toBe(2)
      expect(azul).toBeDefined()
      expect(azul!.hueMax - azul!.hueMin).toBeLessThan(5) // Very close hues
    })

    it('should handle color with extreme LAB values', async () => {
      await colorsDb.createColor({
        name: 'Preto Absoluto',
        hex: '#000000',
        labL: 0,
        labA: 0,
        labB: 0
      })

      const colors = await colorsDb.listColors()
      expect(colors.length).toBe(1)
      
      // Preto should be classified correctly even with L=0
      const preto = colors[0]
      expect(preto.sku).toMatch(/^PT/)
    })
  })

  describe('Performance', () => {
    it('should handle batch color creation efficiently', async () => {
      const startTime = Date.now()
      
      // Create 50 colors
      const promises = []
      for (let i = 0; i < 50; i++) {
        promises.push(
          colorsDb.createColor({
            name: `Cor ${i}`,
            hex: `#${Math.floor(Math.random() * 16777215).toString(16).padStart(6, '0')}`,
            labL: 50 + Math.random() * 30,
            labA: Math.random() * 100 - 50,
            labB: Math.random() * 100 - 50
          })
        )
      }
      
      await Promise.all(promises)
      
      const endTime = Date.now()
      const duration = endTime - startTime
      
      // Should complete in reasonable time (< 5 seconds)
      expect(duration).toBeLessThan(5000)
      
      const colors = await colorsDb.listColors()
      expect(colors.length).toBe(50)
    })
  })
})
