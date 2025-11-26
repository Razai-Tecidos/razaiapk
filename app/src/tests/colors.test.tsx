import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, within, cleanup } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import React from 'react'
import Colors from '@/pages/Colors'
import { MantineProvider } from '@mantine/core'
import { setHueBoundaries } from '@/lib/color-utils'

// Mock DB module with in-memory stores for colors (and stub tissues to avoid conflicts)
vi.mock('@/lib/db', () => {
  const g: any = globalThis as any
  g.__colorsStore = g.__colorsStore ?? []
  const colors: any[] = g.__colorsStore
  function nextSku() {
    const max = colors.reduce((m, t) => {
      const mtx = /^C(\d+)$/.exec(t.sku || '')
      if (mtx) {
        const n = parseInt(mtx[1], 10)
        return Number.isNaN(n) ? m : Math.max(m, n)
      }
      return m
    }, 0)
    return `C${String(max + 1).padStart(3, '0')}`
  }

  const db = { async init() {} }
  const colorsDb = {
    async listColors() { return [...colors] },
    async createColor(input: any) {
      const id = crypto.randomUUID()
      const createdAt = new Date().toISOString()
      // Detect family from name with synonyms (ciano -> azul, magenta/rosa -> rosa), fallback to Outros
      const name: string = input.name || ''
      const fam = (() => {
        const s = name.trim().toLowerCase()
        if (s === 'ciano' || s.startsWith('ciano ')) return 'azul'
        if (s === 'magenta' || s.startsWith('magenta ')) return 'rosa'
        if (s === 'rosa' || s.startsWith('rosa ')) return 'rosa'
        const fams = ['vermelho','laranja','amarelo','verde','azul','roxo','rosa','marrom','cinza','preto','branco']
        const found = fams.find(f => s === f || s.startsWith(f + ' '))
        return found || 'outros'
      })()
      const codeMap: Record<string,string> = { vermelho:'VM', laranja:'LJ', amarelo:'AM', verde:'VD', azul:'AZ', roxo:'RX', rosa:'MG', marrom:'MR', cinza:'CZ', preto:'PT', branco:'BR', outros:'OT' }
      const code = codeMap[fam]
      const max = colors.reduce((m, t) => {
        const mtx = new RegExp('^' + code + '(\\d+)$').exec(t.sku || '')
        if (mtx) {
          const n = parseInt(mtx[1], 10)
          return Number.isNaN(n) ? m : Math.max(m, n)
        }
        return m
      }, 0)
      const sku = `${code}${String(max + 1).padStart(3, '0')}`
      colors.unshift({ id, createdAt, sku, ...input })
    },
    async updateColor(input: any) {
      const idx = colors.findIndex(x => x.id === input.id)
      if (idx >= 0) colors[idx] = { ...colors[idx], ...input }
    },
    async deleteColor(id: string) {
      const idx = colors.findIndex(x => x.id === id)
      if (idx >= 0) colors.splice(idx, 1)
    }
  }
  return { db, colorsDb, __test: { reset: () => { colors.splice(0, colors.length) } } }
})

async function openDrawerNovo() {
  await userEvent.click(screen.getByRole('button', { name: /novo cor/i }))
  await screen.findByRole('dialog')
}

describe('Cadastro de Cores - multi nomes, inferência e dE', () => {
  beforeEach(() => {
    const g: any = globalThis as any
    if (g.__colorsStore) g.__colorsStore.length = 0
    // Use reference contiguous bounds to make family inference deterministic in tests
    setHueBoundaries({
      vermelhoStart: 345,
      laranjaStart: 20,
      amareloStart: 55,
      verdeStart: 95,
      verdeEnd: 170,
      azulStart: 170,
      roxoStart: 270,
      magentaStart: 310,
    })
    render(
      <MantineProvider>
        <Colors />
      </MantineProvider>
    )
  })

  afterEach(() => { cleanup() })

  it('Cria múltiplas cores a partir de nomes separados por vírgula', async () => {
    await openDrawerNovo()
    const nameEl = screen.getByLabelText(/nome da cor/i)
    await userEvent.type(nameEl, 'Azul A, Azul B, Azul C')
    await userEvent.click(screen.getByRole('button', { name: /adicionar cor/i }))

    const rows = await screen.findAllByRole('row')
    const body = rows.slice(1)
    expect(body).toHaveLength(3)
    const text = body.map(r => r.textContent || '')
    expect(text.join(' ')).toMatch(/Azul A/)
    expect(text.join(' ')).toMatch(/Azul B/)
    expect(text.join(' ')).toMatch(/Azul C/)

    // SKU sequenciais AZ001..AZ003 por família Azul
    const skuTexts = body.map(r => within(r).getAllByRole('cell')[4].textContent || '')
    expect(skuTexts.join(' ')).toMatch(/AZ001/)
    expect(skuTexts.join(' ')).toMatch(/AZ002/)
    expect(skuTexts.join(' ')).toMatch(/AZ003/)
  })

  it('Edição: adiciona HEX e infere família', async () => {
    // criar 2 entradas via vírgula
    await openDrawerNovo()
    await userEvent.type(screen.getByLabelText(/nome da cor/i), 'Azul A, Azul B')
    await userEvent.click(screen.getByRole('button', { name: /adicionar cor/i }))

    const rows = await screen.findAllByRole('row')
    const rowA = rows[1]
    await userEvent.click(rowA)
    await userEvent.click(screen.getByRole('button', { name: /editar/i }))

    const hexEl = screen.getByPlaceholderText('#FF0000')
    await userEvent.clear(hexEl)
    await userEvent.type(hexEl, '#00aaff')
    await userEvent.click(screen.getByRole('button', { name: /salvar/i }))

    const rows2 = await screen.findAllByRole('row')
    const rowA2 = rows2[1]
  const familyCell = within(rowA2).getAllByRole('cell')[3]
  expect(familyCell).toHaveTextContent(/Azul/i)
  })

  it('dE (CIE76) para a cor mais próxima é calculado quando possível', async () => {
    // criar 2 cores e definir HEX próximos
    await openDrawerNovo()
    await userEvent.type(screen.getByLabelText(/nome da cor/i), 'C1, C2')
    await userEvent.click(screen.getByRole('button', { name: /adicionar cor/i }))

    // Editar primeira
    let rows = await screen.findAllByRole('row')
    await userEvent.click(rows[1])
    await userEvent.click(screen.getByRole('button', { name: /editar/i }))
    const hex = screen.getByPlaceholderText('#FF0000')
    await userEvent.clear(hex)
    await userEvent.type(hex, '#00a0ff')
    await userEvent.click(screen.getByRole('button', { name: /salvar/i }))

    // Editar segunda
    rows = await screen.findAllByRole('row')
    // Garantir seleção única do segundo item: usar cabeçalho para limpar seleção
    const headerCb = screen.getByRole('checkbox', { name: /selecionar todos/i })
    await userEvent.click(headerCb) // seleciona todos
    await userEvent.click(headerCb) // limpa todos
    await userEvent.click(rows[2])  // seleciona apenas a segunda linha
    const editar2 = screen.getByRole('button', { name: /editar/i })
    expect(editar2).toBeEnabled()
  await userEvent.click(editar2)
  const hex2 = await screen.findByPlaceholderText('#FF0000')
    await userEvent.clear(hex2)
    await userEvent.type(hex2, '#0098ff')
    await userEvent.click(screen.getByRole('button', { name: /salvar/i }))

    // Checar dE (última coluna): deve ser número e pequeno
    const after = await screen.findAllByRole('row')
    const dECell = within(after[1]).getAllByRole('cell')[8]
    const val = parseFloat(dECell.textContent || 'NaN')
    expect(Number.isFinite(val)).toBe(true)
    expect(val).toBeLessThanOrEqual(10)
  })

  it('Exclusão em massa com selecionar todos', async () => {
    await openDrawerNovo()
    await userEvent.type(screen.getByLabelText(/nome da cor/i), 'X, Y, Z')
    await userEvent.click(screen.getByRole('button', { name: /adicionar cor/i }))

    // Selecionar todos
    const headerCheckbox = screen.getByRole('checkbox', { name: /selecionar todos/i })
    await userEvent.click(headerCheckbox)
    await userEvent.click(screen.getByRole('button', { name: /excluir/i }))
    const dialog = await screen.findByRole('dialog')
    await userEvent.click(within(dialog).getByRole('button', { name: /sim/i }))
    expect(await screen.findByText(/Nenhuma cor cadastrada/i)).toBeInTheDocument()
  })

  it('Não bloqueia criação/edição quando ΔE00 < limiar (apenas avisa)', async () => {
    // Ajustar limiar para 3.0
    const thr = screen.getByLabelText(/limiar delta e/i)
    await userEvent.clear(thr)
    await userEvent.type(thr, '3.0')

    // Criar uma cor de referência com HEX
    await openDrawerNovo()
    await userEvent.type(screen.getByLabelText(/nome da cor/i), 'Ref Azul')
    const hex = screen.getByPlaceholderText('#FF0000')
    await userEvent.type(hex, '#00a0ff')
    await userEvent.click(screen.getByRole('button', { name: /adicionar cor/i }))

    // Tentar criar outra muito próxima (ΔE00 pequeno)
    await openDrawerNovo()
    await userEvent.type(screen.getByLabelText(/nome da cor/i), 'Quase Azul')
    const hex2 = screen.getByPlaceholderText('#FF0000')
    await userEvent.type(hex2, '#009fff')
    const addBtn = screen.getByRole('button', { name: /adicionar cor/i })
    expect(addBtn).toBeEnabled()
    const conflict = await screen.findByText(/Conflito: ΔE00/i)
    expect(conflict).toBeInTheDocument()
    await userEvent.click(addBtn)
    // Deve existir 2 linhas de dados agora (além do header)
    const rows = await screen.findAllByRole('row')
    expect(rows.length).toBeGreaterThanOrEqual(3)
  })

  it('Não duplica família quando o nome já inicia com a mesma família', async () => {
    // Criar cor apenas com nome
    await openDrawerNovo()
    await userEvent.type(screen.getByLabelText(/nome da cor/i), 'Amarelo Sol')
    await userEvent.click(screen.getByRole('button', { name: /adicionar cor/i }))

    // Editar para adicionar HEX amarelo e forçar inferência "Amarelo"
    const rows1 = await screen.findAllByRole('row')
    await userEvent.click(rows1[1])
    await userEvent.click(screen.getByRole('button', { name: /editar/i }))
    const hexEl = await screen.findByPlaceholderText('#FF0000')
    await userEvent.clear(hexEl)
    await userEvent.type(hexEl, '#FFC400')
    await userEvent.click(screen.getByRole('button', { name: /salvar/i }))

    const rows2 = await screen.findAllByRole('row')
    const nameCell = within(rows2[1]).getAllByRole('cell')[1]
    expect(nameCell).toHaveTextContent(/^Amarelo Sol$/)
    expect(nameCell).not.toHaveTextContent(/Amarelo\s+Amarelo/i)
  })

  it('Mantém família inferida quando difere do primeiro termo do nome', async () => {
    // Criar com nome começando em "Verde"
    await openDrawerNovo()
    await userEvent.type(screen.getByLabelText(/nome da cor/i), 'Verde Feno')
    await userEvent.click(screen.getByRole('button', { name: /adicionar cor/i }))

  // Editar para adicionar HEX ciano (agora agrupado em família Azul)
    const rows1 = await screen.findAllByRole('row')
    await userEvent.click(rows1[1])
    await userEvent.click(screen.getByRole('button', { name: /editar/i }))
    const hexEl = await screen.findByPlaceholderText('#FF0000')
    await userEvent.clear(hexEl)
    await userEvent.type(hexEl, '#00FFFF')
    await userEvent.click(screen.getByRole('button', { name: /salvar/i }))

    const rows2 = await screen.findAllByRole('row')
    const nameCell = within(rows2[1]).getAllByRole('cell')[1]
  expect(nameCell).toHaveTextContent(/^Azul Feno$/)
  })

  it('Renderiza prévia (swatch) com HEX quando informado', async () => {
    await openDrawerNovo()
    await userEvent.type(screen.getByLabelText(/nome da cor/i), 'Amarelo Sol')
    const hexEl = screen.getByPlaceholderText('#FF0000')
    await userEvent.type(hexEl, '#FFC400')
    await userEvent.click(screen.getByRole('button', { name: /adicionar cor/i }))

    const rows = await screen.findAllByRole('row')
    const nameCell = within(rows[1]).getAllByRole('cell')[1]
    // swatch usa title com o HEX
    expect(within(nameCell).getByTitle('#FFC400')).toBeInTheDocument()
  })

  it('Exibe barras de ação fixas (topo e no drawer)', async () => {
    // Barra do topo deve ser sticky
    const topBar = screen.getByTestId('actions-bar-top')
    expect(topBar).toBeInTheDocument()
    expect(topBar).toHaveStyle({ position: 'sticky' })

    // Abrir o drawer e verificar barra de ações fixa no rodapé
    await openDrawerNovo()
    const drawerBar = await screen.findByTestId('drawer-actions')
    expect(drawerBar).toBeInTheDocument()
    expect(drawerBar).toHaveStyle({ position: 'sticky' })
  })
})
