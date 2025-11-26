import { describe, it, expect, beforeEach } from 'vitest'
import { db, colorsDb, patternsDb, linksDb, patternLinksDb } from '@/lib/db'
import { buildFullBackup, buildFullBackupJson } from '@/lib/backup'
import { importFullBackupExact } from '@/lib/import'
import type { Tissue } from '@/types/tissue'
import type { Color } from '@/types/color'
import type { Pattern } from '@/types/pattern'

/**
 * TESTE END-TO-END COMPLETO: Export → Import Roundtrip
 * 
 * Simula o fluxo completo do usuário:
 * 1. Cria tecidos, cores, estampas
 * 2. Cria vínculos tecido-cor (links)
 * 3. Cria vínculos tecido-estampa (patternLinks)
 * 4. Exporta tudo via buildFullBackup
 * 5. Limpa o banco de dados
 * 6. Importa o backup via importFullBackupExact
 * 7. Valida que TODOS os dados foram restaurados corretamente
 */
describe('Full Export-Import Roundtrip with Links', () => {
  beforeEach(async () => {
    await db.init()
  })

  it('Should export and reimport all data including links and patternLinks', async () => {
    // ========================================
    // FASE 1: CRIAR DADOS INICIAIS
    // ========================================
    
    // Criar tecidos
    await db.createTissue({ name: 'Helanca Premium', width: 160, composition: '96% poliéster 4% elastano' })
    await db.createTissue({ name: 'Malha PV', width: 150, composition: '67% poliéster 33% viscose' })
    const allTissues = await db.listTissues()
    expect(allTissues.length).toBe(2)
    const tissue1 = allTissues.find(t => t.name === 'Helanca Premium')!
    const tissue2 = allTissues.find(t => t.name === 'Malha PV')!
    expect(tissue1).toBeTruthy()
    expect(tissue2).toBeTruthy()

    // Criar cores
    await colorsDb.createColor({ name: 'Azul Royal', hex: '#0000FF' })
    await colorsDb.createColor({ name: 'Vermelho Cereja', hex: '#DC143C' })
    await colorsDb.createColor({ name: 'Verde Folha', hex: '#228B22' })
    const allColors = await colorsDb.listColors()
    expect(allColors.length).toBe(3)
    const color1 = allColors.find(c => c.name === 'Azul Royal')!
    const color2 = allColors.find(c => c.name === 'Vermelho Cereja')!
    const color3 = allColors.find(c => c.name === 'Verde Folha')!
    expect(color1).toBeTruthy()
    expect(color2).toBeTruthy()
    expect(color3).toBeTruthy()

    // Criar estampas
    await patternsDb.createPattern({ family: 'Jardim', name: 'Flores Vermelhas' })
    await patternsDb.createPattern({ family: 'Geométrico', name: 'Listras Azuis' })
    const allPatterns = await patternsDb.listPatterns()
    expect(allPatterns.length).toBe(2)
    const pattern1 = allPatterns.find(p => p.name === 'Flores Vermelhas')!
    const pattern2 = allPatterns.find(p => p.name === 'Listras Azuis')!

    // Criar vínculos tecido-cor (links)
    const linkResult1 = await linksDb.createMany(tissue1.id, [color1.id, color2.id])
    expect(linkResult1.created).toBe(2)
    const linkResult2 = await linksDb.createMany(tissue2.id, [color3.id])
    expect(linkResult2.created).toBe(1)

    // Criar vínculos tecido-estampa (patternLinks)
    const plResult1 = await patternLinksDb.createMany(tissue1.id, [pattern1.id])
    expect(plResult1.created).toBe(1)
    const plResult2 = await patternLinksDb.createMany(tissue2.id, [pattern2.id])
    expect(plResult2.created).toBe(1)

    // Validar estado inicial
    const initialTissues = await db.listTissues()
    const initialColors = await colorsDb.listColors()
    const initialPatterns = await patternsDb.listPatterns()
    const initialLinks = await linksDb.list()
    const initialPatternLinks = await patternLinksDb.list()

    expect(initialTissues.length).toBe(2)
    expect(initialColors.length).toBe(3)
    expect(initialPatterns.length).toBe(2)
    expect(initialLinks.length).toBe(3) // 2 links do tissue1 + 1 do tissue2
    expect(initialPatternLinks.length).toBe(2) // 1 do tissue1 + 1 do tissue2

    console.log('[roundtrip] Estado inicial validado:')
    console.log('  - Tecidos:', initialTissues.length)
    console.log('  - Cores:', initialColors.length)
    console.log('  - Estampas:', initialPatterns.length)
    console.log('  - Links (tecido-cor):', initialLinks.length)
    console.log('  - PatternLinks (tecido-estampa):', initialPatternLinks.length)

    // ========================================
    // FASE 2: EXPORTAR
    // ========================================
    
    const exportPayload = await buildFullBackup()
    const exportJson = await buildFullBackupJson()

    // Validar estrutura do export
    expect(exportPayload.schema).toBe('razai-tools.full-export')
    expect(exportPayload.version).toBe(4)
    expect(exportPayload.counts.tissues).toBe(2)
    expect(exportPayload.counts.colors).toBe(3)
    expect(exportPayload.counts.patterns).toBe(2)
    expect(exportPayload.counts.links).toBe(3)
    expect(exportPayload.counts.patternLinks).toBe(2)
    expect(exportPayload.integrity.hashHex).toMatch(/^[0-9a-f]{64}$/)

    console.log('[roundtrip] Export gerado com sucesso')
    console.log('  - Hash de integridade:', exportPayload.integrity.hashHex.slice(0, 16) + '...')

    // Validar que os arrays estão presentes e populados
    expect(Array.isArray(exportPayload.tissues)).toBe(true)
    expect(Array.isArray(exportPayload.colors)).toBe(true)
    expect(Array.isArray(exportPayload.patterns)).toBe(true)
    expect(Array.isArray(exportPayload.links)).toBe(true)
    expect(Array.isArray(exportPayload.patternLinks)).toBe(true)
    expect(exportPayload.tissues.length).toBe(2)
    expect(exportPayload.colors.length).toBe(3)
    expect(exportPayload.patterns.length).toBe(2)
    expect(exportPayload.links.length).toBe(3)
    expect(exportPayload.patternLinks.length).toBe(2)

    // ========================================
    // FASE 3: LIMPAR BANCO DE DADOS
    // ========================================
    
    // Deletar todos os vínculos primeiro (foreign keys)
    for (const link of initialLinks) {
      await linksDb.delete(link.id)
    }
    for (const pl of initialPatternLinks) {
      await patternLinksDb.delete(pl.id)
    }
    
    // Deletar entidades principais
    for (const t of initialTissues) {
      await db.deleteTissue(t.id)
    }
    for (const c of initialColors) {
      await colorsDb.deleteColor(c.id)
    }
    for (const p of initialPatterns) {
      await patternsDb.deletePattern(p.id)
    }

    // Validar que o banco está vazio
    const emptyTissues = await db.listTissues()
    const emptyColors = await colorsDb.listColors()
    const emptyPatterns = await patternsDb.listPatterns()
    const emptyLinks = await linksDb.list()
    const emptyPatternLinks = await patternLinksDb.list()

    expect(emptyTissues.length).toBe(0)
    expect(emptyColors.length).toBe(0)
    expect(emptyPatterns.length).toBe(0)
    expect(emptyLinks.length).toBe(0)
    expect(emptyPatternLinks.length).toBe(0)

    console.log('[roundtrip] Banco de dados limpo')

    // ========================================
    // FASE 4: IMPORTAR
    // ========================================
    
    const importResult = await importFullBackupExact(exportJson)

    console.log('[roundtrip] Import concluído:')
    console.log('  - Tecidos inseridos:', importResult.inserted.tissues)
    console.log('  - Cores inseridas:', importResult.inserted.colors)
    console.log('  - Estampas inseridas:', importResult.inserted.patterns)
    console.log('  - Links inseridos:', importResult.inserted.links)
    console.log('  - PatternLinks inseridos:', importResult.inserted.patternLinks)

    // Validar que os dados foram inseridos
    expect(importResult.inserted.tissues).toBe(2)
    expect(importResult.inserted.colors).toBe(3)
    expect(importResult.inserted.patterns).toBe(2)
    expect(importResult.inserted.links).toBe(3)
    expect(importResult.inserted.patternLinks).toBe(2)

    // ========================================
    // FASE 5: VALIDAR DADOS RESTAURADOS
    // ========================================
    
    const finalTissues = await db.listTissues()
    const finalColors = await colorsDb.listColors()
    const finalPatterns = await patternsDb.listPatterns()
    const finalLinks = await linksDb.list()
    const finalPatternLinks = await patternLinksDb.list()

    // Validar contagens
    expect(finalTissues.length).toBe(2)
    expect(finalColors.length).toBe(3)
    expect(finalPatterns.length).toBe(2)
    expect(finalLinks.length).toBe(3)
    expect(finalPatternLinks.length).toBe(2)

    console.log('[roundtrip] Estado final validado:')
    console.log('  - Tecidos:', finalTissues.length)
    console.log('  - Cores:', finalColors.length)
    console.log('  - Estampas:', finalPatterns.length)
    console.log('  - Links (tecido-cor):', finalLinks.length)
    console.log('  - PatternLinks (tecido-estampa):', finalPatternLinks.length)

    // Validar dados específicos dos tecidos
    const helanca = finalTissues.find(t => t.name === 'Helanca Premium')
    const malha = finalTissues.find(t => t.name === 'Malha PV')
    expect(helanca).toBeTruthy()
    expect(malha).toBeTruthy()
    expect(helanca!.width).toBe(160)
    expect(malha!.width).toBe(150)

    // Validar dados específicos das cores
    const azul = finalColors.find(c => c.name === 'Azul Royal')
    const vermelho = finalColors.find(c => c.name === 'Vermelho Cereja')
    const verde = finalColors.find(c => c.name === 'Verde Folha')
    expect(azul).toBeTruthy()
    expect(vermelho).toBeTruthy()
    expect(verde).toBeTruthy()
    expect(azul!.hex).toBe('#0000FF')
    expect(vermelho!.hex).toBe('#DC143C')
    expect(verde!.hex).toBe('#228B22')

    // Validar dados específicos das estampas
    const flores = finalPatterns.find(p => p.name === 'Flores Vermelhas')
    const listras = finalPatterns.find(p => p.name === 'Listras Azuis')
    expect(flores).toBeTruthy()
    expect(listras).toBeTruthy()
    expect(flores!.family).toBe('Jardim')
    expect(listras!.family).toBe('Geométrico')

    // Validar vínculos tecido-cor
    const helancaLinks = finalLinks.filter(l => l.tissueId === helanca!.id)
    const malhaLinks = finalLinks.filter(l => l.tissueId === malha!.id)
    expect(helancaLinks.length).toBe(2) // Azul Royal + Vermelho Cereja
    expect(malhaLinks.length).toBe(1) // Verde Folha

    // Validar que os vínculos apontam para as cores corretas
    const helancaColorIds = helancaLinks.map(l => l.colorId).sort()
    expect(helancaColorIds).toContain(azul!.id)
    expect(helancaColorIds).toContain(vermelho!.id)
    expect(malhaLinks[0].colorId).toBe(verde!.id)

    // Validar vínculos tecido-estampa
    const helancaPatternLinks = finalPatternLinks.filter(pl => pl.tissueId === helanca!.id)
    const malhaPatternLinks = finalPatternLinks.filter(pl => pl.tissueId === malha!.id)
    expect(helancaPatternLinks.length).toBe(1) // Flores Vermelhas
    expect(malhaPatternLinks.length).toBe(1) // Listras Azuis

    // Validar que os vínculos apontam para as estampas corretas
    expect(helancaPatternLinks[0].patternId).toBe(flores!.id)
    expect(malhaPatternLinks[0].patternId).toBe(listras!.id)

    // Validar propriedades dos vínculos (skuFilho, status, etc)
    expect(helancaLinks.every(l => l.status === 'Ativo')).toBe(true)
    expect(helancaPatternLinks.every(pl => pl.status === 'Ativo')).toBe(true)
    expect(helancaLinks.every(l => l.skuFilho.startsWith(helanca!.sku))).toBe(true)
    expect(helancaPatternLinks.every(pl => pl.skuFilho.startsWith(helanca!.sku))).toBe(true)

    console.log('[roundtrip] ✅ TESTE COMPLETO: Todos os dados foram exportados e reimportados corretamente!')
  })
})
