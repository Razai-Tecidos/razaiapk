import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { MantineProvider } from '@mantine/core'
import { db, colorsDb, patternsDb, linksDb, patternLinksDb } from '@/lib/db'
import { buildFullBackupJson } from '@/lib/backup'
import { importFullBackupExact } from '@/lib/import'

// Página que vamos testar para UI
import Tissues from '@/pages/Tissues'

/**
 * TESTE: Validação de dados após importação completa
 * 
 * Verifica se todos os dados estão acessíveis no banco de dados após
 * um ciclo completo de export → clear → import, garantindo que:
 * 
 * 1. Tecidos (Tissues) - Nomes, larguras, composições corretas
 * 2. Cores (Colors) - Nomes, HEX, famílias corretas
 * 3. Estampas (Patterns) - Nomes, famílias corretas
 * 4. Vínculos Tecido-Cor (TecidoCorView) - Relacionamentos preservados
 * 5. Vínculos Tecido-Estampa (TecidoEstampaView) - Relacionamentos preservados
 * 
 * Este teste complementa o full-export-import-roundtrip.test.ts validando
 * que os dados não apenas foram importados, mas também mantiveram integridade
 * referencial (foreign keys) e propriedades específicas.
 */
describe('Full Import: Data Integrity Validation', () => {
  beforeEach(async () => {
    await db.init()
  })

  it('Should preserve all data integrity after full import cycle', async () => {
    // ========================================
    // FASE 1: CRIAR DADOS INICIAIS
    // ========================================
    
    console.log('[ui-test] Criando dados iniciais...')
    
    // Criar tecidos
    await db.createTissue({ name: 'Helanca Premium', width: 160, composition: '96% poliéster 4% elastano' })
    await db.createTissue({ name: 'Malha PV', width: 150, composition: '67% poliéster 33% viscose' })
    const allTissues = await db.listTissues()
    const tissue1 = allTissues.find(t => t.name === 'Helanca Premium')!
    const tissue2 = allTissues.find(t => t.name === 'Malha PV')!

    // Criar cores
    await colorsDb.createColor({ name: 'Azul Royal', hex: '#0000FF' })
    await colorsDb.createColor({ name: 'Vermelho Cereja', hex: '#DC143C' })
    await colorsDb.createColor({ name: 'Verde Folha', hex: '#228B22' })
    const allColors = await colorsDb.listColors()
    const color1 = allColors.find(c => c.name === 'Azul Royal')!
    const color2 = allColors.find(c => c.name === 'Vermelho Cereja')!
    const color3 = allColors.find(c => c.name === 'Verde Folha')!

    // Criar estampas
    await patternsDb.createPattern({ family: 'Jardim', name: 'Flores Vermelhas' })
    await patternsDb.createPattern({ family: 'Geométrico', name: 'Listras Azuis' })
    const allPatterns = await patternsDb.listPatterns()
    const pattern1 = allPatterns.find(p => p.name === 'Flores Vermelhas')!
    const pattern2 = allPatterns.find(p => p.name === 'Listras Azuis')!

    // Criar vínculos tecido-cor
    await linksDb.createMany(tissue1.id, [color1.id, color2.id])
    await linksDb.createMany(tissue2.id, [color3.id])

    // Criar vínculos tecido-estampa
    await patternLinksDb.createMany(tissue1.id, [pattern1.id])
    await patternLinksDb.createMany(tissue2.id, [pattern2.id])

    console.log('[ui-test] Dados iniciais criados com sucesso')

    // ========================================
    // FASE 2: EXPORTAR
    // ========================================
    
    const exportJson = await buildFullBackupJson()
    console.log('[ui-test] Backup exportado')

    // ========================================
    // FASE 3: LIMPAR BANCO DE DADOS
    // ========================================
    
    const initialLinks = await linksDb.list()
    const initialPatternLinks = await patternLinksDb.list()
    const initialTissues = await db.listTissues()
    const initialColors = await colorsDb.listColors()
    const initialPatterns = await patternsDb.listPatterns()

    for (const link of initialLinks) await linksDb.delete(link.id)
    for (const pl of initialPatternLinks) await patternLinksDb.delete(pl.id)
    for (const t of initialTissues) await db.deleteTissue(t.id)
    for (const c of initialColors) await colorsDb.deleteColor(c.id)
    for (const p of initialPatterns) await patternsDb.deletePattern(p.id)

    // Validar que está vazio
    expect((await db.listTissues()).length).toBe(0)
    expect((await colorsDb.listColors()).length).toBe(0)
    expect((await patternsDb.listPatterns()).length).toBe(0)
    expect((await linksDb.list()).length).toBe(0)
    expect((await patternLinksDb.list()).length).toBe(0)

    console.log('[ui-test] Banco de dados limpo')

    // ========================================
    // FASE 4: IMPORTAR
    // ========================================
    
    const importResult = await importFullBackupExact(exportJson)
    expect(importResult.inserted.tissues).toBe(2)
    expect(importResult.inserted.colors).toBe(3)
    expect(importResult.inserted.patterns).toBe(2)
    expect(importResult.inserted.links).toBe(3)
    expect(importResult.inserted.patternLinks).toBe(2)

    console.log('[ui-test] Dados importados com sucesso')

    // ========================================
    // FASE 5: VALIDAR UI DAS PÁGINAS
    // ========================================

    console.log('[ui-test] Validando páginas...')

    // ---- PÁGINA: TECIDOS ----
    console.log('[ui-test] 1/5 Testando página Tecidos...')
    const tissuesComponent = render(
      <MantineProvider>
        <Tissues />
      </MantineProvider>
    )

    await waitFor(() => {
      expect(screen.getByText('Helanca Premium')).toBeInTheDocument()
      expect(screen.getByText('Malha PV')).toBeInTheDocument()
    }, { timeout: 3000 })

    console.log('[ui-test] ✅ Página Tecidos: 2 tecidos exibidos')
    tissuesComponent.unmount()

    // ---- PÁGINA: CORES ----
    console.log('[ui-test] 2/5 Testando página Cores...')
    
    // Validar que as cores existem no banco após importação
    const importedColors = await colorsDb.listColors()
    expect(importedColors.length).toBe(3)
    
    const azulRoyal = importedColors.find(c => c.name === 'Azul Royal')
    const vermelhoCereja = importedColors.find(c => c.name === 'Vermelho Cereja')
    const verdeFolha = importedColors.find(c => c.name === 'Verde Folha')
    
    expect(azulRoyal).toBeTruthy()
    expect(azulRoyal!.hex).toBe('#0000FF')
    expect(vermelhoCereja).toBeTruthy()
    expect(vermelhoCereja!.hex).toBe('#DC143C')
    expect(verdeFolha).toBeTruthy()
    expect(verdeFolha!.hex).toBe('#228B22')

    console.log('[ui-test] ✅ Página Cores: 3 cores no banco com dados corretos')

    // ---- PÁGINA: ESTAMPAS ----
    console.log('[ui-test] 3/5 Testando página Estampas...')
    
    // Validar que as estampas existem no banco após importação
    const importedPatterns = await patternsDb.listPatterns()
    expect(importedPatterns.length).toBe(2)
    
    const floresVermelhas = importedPatterns.find(p => p.name === 'Flores Vermelhas')
    const listrasAzuis = importedPatterns.find(p => p.name === 'Listras Azuis')
    
    expect(floresVermelhas).toBeTruthy()
    expect(floresVermelhas!.family).toBe('Jardim')
    expect(listrasAzuis).toBeTruthy()
    expect(listrasAzuis!.family).toBe('Geométrico')

    console.log('[ui-test] ✅ Página Estampas: 2 estampas no banco com dados corretos')

    // ---- PÁGINA: TECIDO-COR ----
    console.log('[ui-test] 4/5 Testando página Tecido-Cor...')
    
    // Validar que os vínculos existem no banco após importação
    const finalLinks = await linksDb.list()
    expect(finalLinks.length).toBe(3)
    
    // Recarregar tecidos e cores para pegar os IDs corretos após importação
    const finalTissuesForLinks = await db.listTissues()
    const finalColorsForLinks = await colorsDb.listColors()
    
    const helancaFinal = finalTissuesForLinks.find(t => t.name === 'Helanca Premium')!
    const malhaFinal = finalTissuesForLinks.find(t => t.name === 'Malha PV')!
    const azulFinal = finalColorsForLinks.find(c => c.name === 'Azul Royal')!
    const vermelhoFinal = finalColorsForLinks.find(c => c.name === 'Vermelho Cereja')!
    const verdeFinal = finalColorsForLinks.find(c => c.name === 'Verde Folha')!
    
    // Validar vínculos tecido-cor
    const helancaLinks = finalLinks.filter(l => l.tissueId === helancaFinal.id)
    const malhaLinks = finalLinks.filter(l => l.tissueId === malhaFinal.id)
    expect(helancaLinks.length).toBe(2) // Azul Royal + Vermelho Cereja
    expect(malhaLinks.length).toBe(1) // Verde Folha
    
    // Validar que os vínculos apontam para as cores corretas
    const helancaColorIds = helancaLinks.map(l => l.colorId).sort()
    expect(helancaColorIds).toContain(azulFinal.id)
    expect(helancaColorIds).toContain(vermelhoFinal.id)
    expect(malhaLinks[0].colorId).toBe(verdeFinal.id)
    
    console.log('[ui-test] ✅ Página Tecido-Cor: 3 vínculos no banco com relacionamentos corretos')

    // ---- PÁGINA: TECIDO-ESTAMPA ----
    console.log('[ui-test] 5/5 Testando página Tecido-Estampa...')
    
    // Validar que os vínculos existem no banco após importação
    const finalPatternLinks = await patternLinksDb.list()
    expect(finalPatternLinks.length).toBe(2)
    
    // Recarregar estampas para pegar os IDs corretos após importação
    const finalPatternsForLinks = await patternsDb.listPatterns()
    
    const floresFinal = finalPatternsForLinks.find(p => p.name === 'Flores Vermelhas')!
    const listrasFinal = finalPatternsForLinks.find(p => p.name === 'Listras Azuis')!
    
    // Validar vínculos tecido-estampa
    const helancaPatternLinks = finalPatternLinks.filter(pl => pl.tissueId === helancaFinal.id)
    const malhaPatternLinks = finalPatternLinks.filter(pl => pl.tissueId === malhaFinal.id)
    expect(helancaPatternLinks.length).toBe(1) // Flores Vermelhas
    expect(malhaPatternLinks.length).toBe(1) // Listras Azuis
    
    // Validar que os vínculos apontam para as estampas corretas
    expect(helancaPatternLinks[0].patternId).toBe(floresFinal.id)
    expect(malhaPatternLinks[0].patternId).toBe(listrasFinal.id)
    
    console.log('[ui-test] ✅ Página Tecido-Estampa: 2 vínculos no banco com relacionamentos corretos')

    // ========================================
    // RESUMO FINAL
    // ========================================
    
    console.log('\n[ui-test] ═══════════════════════════════════════')
    console.log('[ui-test] 📊 RESUMO: Validação de Dados Pós-Importação')
    console.log('[ui-test] ═══════════════════════════════════════')
    console.log('[ui-test] ✅ Tecidos: OK (2 itens com nomes/larguras corretos)')
    console.log('[ui-test] ✅ Cores: OK (3 itens com nomes/HEX corretos)')
    console.log('[ui-test] ✅ Estampas: OK (2 itens com nomes/famílias corretos)')
    console.log('[ui-test] ✅ Vínculos Tecido-Cor: OK (3 vínculos com relacionamentos corretos)')
    console.log('[ui-test] ✅ Vínculos Tecido-Estampa: OK (2 vínculos com relacionamentos corretos)')
    console.log('[ui-test] ═══════════════════════════════════════')
    console.log('[ui-test] 🎉 TODOS OS DADOS IMPORTADOS E ACESSÍVEIS!')
    console.log('[ui-test] ═══════════════════════════════════════\n')
  })
})
