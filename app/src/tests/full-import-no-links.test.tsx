import { describe, it, expect, beforeEach } from 'vitest'
import React from 'react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MantineProvider } from '@mantine/core'
import Exportacoes from '@/pages/Exportacoes'
import { db, colorsDb, patternsDb, linksDb, patternLinksDb } from '@/lib/db'
import { makeFullExport } from '@/lib/export'

function wrap(ui: React.ReactElement){
  return <MantineProvider>{ui}</MantineProvider>
}

describe('Importa backup sem vínculos e popula dados', () => {
  beforeEach(async () => {
    await db.init()
  })

  it('Cria tecidos, cores e estampas; não cria vínculos', async () => {
    const backup = await makeFullExport({
      tissues: [ { id:'t1', name:'Helanca', width:160, composition:'—', sku:'T001', createdAt:'2025-01-01T00:00:00.000Z' } ],
      colors: [
        { id:'c1', name:'Azul Razai', sku:'AZ001', createdAt:'2025-01-01T00:00:00.000Z' },
        { id:'c2', name:'Amarelo Sol', hex:'#FFC400', sku:'AM001', createdAt:'2025-01-02T00:00:00.000Z' }
      ],
      patterns: [ { id:'p1', family:'Jardim', name:'Pink', sku:'JA001', createdAt:'2025-01-04T00:00:00.000Z' } ],
      links: [],
      patternLinks: [],
      familyStats: [],
      settings: { deltaThreshold: 3.9 }
    })

    render(wrap(<Exportacoes />))
    const file = new File([JSON.stringify(backup)], 'backup.json', { type: 'application/json' })
    const input = screen.getByLabelText(/Importar arquivo/i)
    await userEvent.upload(input, file)

  // Allow async import to finish (IDB writes may take longer on CI); poll briefly
  await new Promise(r => setTimeout(r, 20))
  for (let i=0;i<20;i++) {
    const pats = await patternsDb.listPatterns()
    if (pats.length >= 1) break
    await new Promise(r => setTimeout(r, 20))
  }

    const [tissues, colors, patterns, links, plinks] = await Promise.all([
      db.listTissues(),
      colorsDb.listColors(),
      patternsDb.listPatterns(),
      linksDb.list(),
      patternLinksDb.list(),
    ])

    expect(tissues.length).toBeGreaterThanOrEqual(1)
    expect(colors.length).toBeGreaterThanOrEqual(2)
    expect(patterns.length).toBeGreaterThanOrEqual(1)
    // v4 exact import still results in zero links when backup has none
    expect(links.length).toBe(0)
    expect(plinks.length).toBe(0)
  })
})
