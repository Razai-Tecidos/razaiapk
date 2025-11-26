import { describe, it, expect, beforeEach } from 'vitest'
import { configure } from '@testing-library/dom'
import { patternsDb, db } from '@/lib/db'

// Ensure JSDOM timers and testing library configured
configure({ asyncUtilTimeout: 2000 })

describe('Estampas (Patterns) - geração de código por família', () => {
  beforeEach(async () => {
    // Reset DB between tests by re-initializing and clearing patterns store if needed
    await db.init()
  })

  it('Usa JA para família Jardim e numera sequencialmente', async () => {
    await patternsDb.createPattern({ family: 'Jardim', name: 'Pink' })
    await patternsDb.createPattern({ family: 'Jardim', name: 'Azul' })
    const list = await patternsDb.listPatterns()
    const jardim = list.filter(p => p.family === 'Jardim')
    expect(jardim.length).toBe(2)
    // como a lista vem ordenada por createdAt desc, JA002 pode vir antes
    const skus = jardim.map(p => p.sku).sort()
    expect(skus).toEqual(['JA001', 'JA002'])
  })

  it('Família que começa com JA mas não é Jardim recebe código diferente (ex.: Japonesa -> JP)', async () => {
    await patternsDb.createPattern({ family: 'Japonesa', name: 'Clássica' })
    const list = await patternsDb.listPatterns()
    const jap = list.find(p => p.family === 'Japonesa')!
    expect(jap.sku.startsWith('JP')).toBe(true)
    expect(jap.sku).toMatch(/^JP\d{3}$/)
  })
})
