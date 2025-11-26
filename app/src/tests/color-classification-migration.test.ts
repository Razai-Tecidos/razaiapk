import { describe, it, expect, beforeEach } from 'vitest'
import { colorsDb } from '@/lib/db'
import { detectFamilyFromName, familyCodeFor } from '@/lib/color-utils'

describe('Color Classification Migration', () => {
  beforeEach(async () => {
    await colorsDb.clearAllColors()
  })

  describe('Name-based family detection', () => {
    it('should detect family from first word - standard families', () => {
      expect(detectFamilyFromName('Vermelho Carmim')).toBe('Vermelho')
      expect(detectFamilyFromName('Azul Celeste')).toBe('Azul')
      expect(detectFamilyFromName('Verde Musgo')).toBe('Verde')
      expect(detectFamilyFromName('Amarelo Ouro')).toBe('Amarelo')
      expect(detectFamilyFromName('Laranja Queimado')).toBe('Laranja')
      expect(detectFamilyFromName('Roxo Profundo')).toBe('Roxo')
      expect(detectFamilyFromName('Rosa Claro')).toBe('Rosa')
    })

    it('should create custom family from first word', () => {
      expect(detectFamilyFromName('Salmão Rosado')).toBe('Salmão')
      expect(detectFamilyFromName('Terracota Escura')).toBe('Terracota')
      expect(detectFamilyFromName('Cobre Antigo')).toBe('Cobre')
      expect(detectFamilyFromName('Bordô Imperial')).toBe('Bordô')
    })

    it('should handle single-word color names', () => {
      expect(detectFamilyFromName('Vermelho')).toBe('Vermelho')
      expect(detectFamilyFromName('Salmão')).toBe('Salmão')
      expect(detectFamilyFromName('Terracota')).toBe('Terracota')
    })

    it('should handle case variations', () => {
      expect(detectFamilyFromName('vermelho carmim')).toBe('Vermelho')
      expect(detectFamilyFromName('AZUL CELESTE')).toBe('Azul')
      expect(detectFamilyFromName('sAlMãO rOsAdO')).toBe('Salmão')
    })

    it('should handle synonyms (Ciano, Magenta)', () => {
      expect(detectFamilyFromName('Ciano Claro')).toBe('Azul')
      expect(detectFamilyFromName('Magenta Vibrante')).toBe('Rosa')
    })

    it('should return null for empty or invalid names', () => {
      expect(detectFamilyFromName('')).toBeNull()
      expect(detectFamilyFromName('   ')).toBeNull()
    })
  })

  describe('Family code generation', () => {
    it('should generate correct codes for standard families', () => {
      expect(familyCodeFor('Vermelho')).toBe('VM')
      expect(familyCodeFor('Laranja')).toBe('LJ')
      expect(familyCodeFor('Amarelo')).toBe('AM')
      expect(familyCodeFor('Verde')).toBe('VD')
      expect(familyCodeFor('Azul')).toBe('AZ')
      expect(familyCodeFor('Roxo')).toBe('RX')
      expect(familyCodeFor('Rosa')).toBe('MG')
      expect(familyCodeFor('Bordô')).toBe('BO')
      expect(familyCodeFor('Marrom')).toBe('MR')
      expect(familyCodeFor('Bege')).toBe('BG')
      expect(familyCodeFor('Cinza')).toBe('CZ')
      expect(familyCodeFor('Preto')).toBe('PT')
      expect(familyCodeFor('Branco')).toBe('BR')
    })

    it('should generate 2-letter codes for custom families', () => {
      expect(familyCodeFor('Salmão')).toBe('SA')
      expect(familyCodeFor('Terracota')).toBe('TE')
      expect(familyCodeFor('Cobre')).toBe('CO')
      expect(familyCodeFor('Ocre')).toBe('OC')
    })

    it('should handle single-letter family names', () => {
      const code = familyCodeFor('X')
      expect(code).toMatch(/^[A-Z]{2}$/)
      expect(code.length).toBe(2)
    })

    it('should handle empty family name', () => {
      const code = familyCodeFor('')
      expect(code).toBe('OT') // Falls back to "Outros"
    })
  })

  describe('createColor with name-based classification', () => {
    it('should use name FIRST, LAB second for standard families', async () => {
      // Name says "Laranja" but LAB might suggest "Vermelho"
      await colorsDb.createColor({
        name: 'Laranja Queimado',
        hex: '#CC3333',
        labL: 45,
        labA: 45,
        labB: 30
      })

      const colors = await colorsDb.listColors()
      const color = colors[0]
      
      // Should use name-based family "Laranja", not LAB
      expect(color.sku).toMatch(/^LJ\d{3}$/)
    })

    it('should create custom family SKU for "Salmão"', async () => {
      await colorsDb.createColor({
        name: 'Salmão Claro',
        hex: '#FA8072',
        labL: 70,
        labA: 35,
        labB: 20
      })

      const colors = await colorsDb.listColors()
      const color = colors[0]
      
      expect(color.sku).toMatch(/^SA\d{3}$/)
      expect(color.sku).toBe('SA001')
    })

    it('should fall back to LAB when name has no family', async () => {
      // Use a name starting with number to force LAB fallback
      await colorsDb.createColor({
        name: '123 Especial',
        hex: '#FF0000',
        labL: 53,
        labA: 80,
        labB: 67
      })

      const colors = await colorsDb.listColors()
      const color = colors[0]
      
      // With numeric first word, should fall back to LAB (Laranja based on LAB values)
      expect(color.sku).toMatch(/^(VM|LJ)\d{3}$/)
    })

    it('should sequence colors within same family', async () => {
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

      await colorsDb.createColor({
        name: 'Verde Limão',
        hex: '#32CD32',
        labL: 70,
        labA: -50,
        labB: 60
      })

      const colors = await colorsDb.listColors()
      const verdes = colors.filter(c => c.sku.startsWith('VD'))
      
      expect(verdes).toHaveLength(3)
      expect(verdes.some(c => c.sku === 'VD001')).toBe(true)
      expect(verdes.some(c => c.sku === 'VD002')).toBe(true)
      expect(verdes.some(c => c.sku === 'VD003')).toBe(true)
    })
  })

  describe('recalculateAllColorSkus migration', () => {
    it('should recalculate SKUs based on name', async () => {
      // Create colors that might have wrong SKUs (simulating old system)
      await colorsDb.createColor({
        name: 'Laranja Queimado',
        hex: '#D2691E',
        labL: 50,
        labA: 30,
        labB: 40
      })

      await colorsDb.createColor({
        name: 'Laranja Vibrante',
        hex: '#FF8C00',
        labL: 65,
        labA: 35,
        labB: 70
      })

      await colorsDb.createColor({
        name: 'Salmão Rosado',
        hex: '#FA8072',
        labL: 70,
        labA: 35,
        labB: 20
      })

      // Run migration
      const result = await colorsDb.recalculateAllColorSkus()
      
      expect(result.totalUpdated).toBe(3)
      expect(result.familiesProcessed).toBeGreaterThanOrEqual(2) // Laranja + Salmão

      const colors = await colorsDb.listColors()
      
      // Laranjas should have LJ codes
      const laranjas = colors.filter(c => c.name.startsWith('Laranja'))
      expect(laranjas.every(c => c.sku.startsWith('LJ'))).toBe(true)
      
      // Salmão should have SA code
      const salmao = colors.find(c => c.name.startsWith('Salmão'))
      expect(salmao?.sku).toMatch(/^SA\d{3}$/)
    })

    it('should preserve chronological order within families', async () => {
      // Create colors at different times
      await colorsDb.createColor({
        name: 'Azul Antigo',
        hex: '#0000FF',
        labL: 50,
        labA: 20,
        labB: -80
      })

      // Simulate time passing
      await new Promise(resolve => setTimeout(resolve, 10))

      await colorsDb.createColor({
        name: 'Azul Médio',
        hex: '#0080FF',
        labL: 60,
        labA: 10,
        labB: -70
      })

      await new Promise(resolve => setTimeout(resolve, 10))

      await colorsDb.createColor({
        name: 'Azul Recente',
        hex: '#00BFFF',
        labL: 70,
        labA: 0,
        labB: -60
      })

      await colorsDb.recalculateAllColorSkus()

      const colors = await colorsDb.listColors()
      const azuis = colors
        .filter(c => c.name.startsWith('Azul'))
        .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
      
      expect(azuis[0].sku).toBe('AZ001')
      expect(azuis[1].sku).toBe('AZ002')
      expect(azuis[2].sku).toBe('AZ003')
    })

    it('should handle mixed standard and custom families', async () => {
      await colorsDb.createColor({
        name: 'Vermelho Vivo',
        hex: '#FF0000',
        labL: 53,
        labA: 80,
        labB: 67
      })

      await colorsDb.createColor({
        name: 'Terracota Antiga',
        hex: '#CC8866',
        labL: 55,
        labA: 15,
        labB: 25
      })

      await colorsDb.createColor({
        name: 'Azul Profundo',
        hex: '#00008B',
        labL: 30,
        labA: 30,
        labB: -80
      })

      await colorsDb.createColor({
        name: 'Cobre Brilhante',
        hex: '#B87333',
        labL: 50,
        labA: 18,
        labB: 35
      })

      const result = await colorsDb.recalculateAllColorSkus()
      
      expect(result.totalUpdated).toBe(4)
      expect(result.familiesProcessed).toBe(4) // VM, TE, AZ, CO

      const colors = await colorsDb.listColors()
      
      expect(colors.find(c => c.name.startsWith('Vermelho'))?.sku).toMatch(/^VM\d{3}$/)
      expect(colors.find(c => c.name.startsWith('Terracota'))?.sku).toMatch(/^TE\d{3}$/)
      expect(colors.find(c => c.name.startsWith('Azul'))?.sku).toMatch(/^AZ\d{3}$/)
      expect(colors.find(c => c.name.startsWith('Cobre'))?.sku).toMatch(/^CO\d{3}$/)
    })

    it('should handle empty database gracefully', async () => {
      const result = await colorsDb.recalculateAllColorSkus()
      
      expect(result.totalUpdated).toBe(0)
      expect(result.familiesProcessed).toBe(0)
    })
  })

  describe('SKU uniqueness after migration', () => {
    it('should maintain unique SKUs after recalculation', async () => {
      // Create 10 colors in same family
      for (let i = 0; i < 10; i++) {
        await colorsDb.createColor({
          name: `Verde Tipo ${i}`,
          hex: `#${(0x00FF00 + i * 0x001100).toString(16).padStart(6, '0')}`,
          labL: 60 + i,
          labA: -30,
          labB: 40
        })
      }

      await colorsDb.recalculateAllColorSkus()

      const colors = await colorsDb.listColors()
      const skus = colors.map(c => c.sku)
      const uniqueSkus = new Set(skus)
      
      expect(skus.length).toBe(10)
      expect(uniqueSkus.size).toBe(10) // All SKUs must be unique
    })
  })
})
