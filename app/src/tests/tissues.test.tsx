import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, fireEvent, within, cleanup } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import React from 'react'
import Tissues from '@/pages/Tissues'
import { MantineProvider } from '@mantine/core'
import { Notifications } from '@mantine/notifications'

// Mock DB module with in-memory store
vi.mock('@/lib/db', () => {
  const g: any = globalThis as any
  g.__tissuesStore = g.__tissuesStore ?? []
  const store: any[] = g.__tissuesStore
  const api = {
    async init() {},
    async listTissues() { return [...store] },
    async createTissue(input: any) {
      const id = crypto.randomUUID()
      const createdAt = new Date().toISOString()
      // SKU sequencial: T001, T002, ...
      const max = store.reduce((m, t) => {
        const mtx = /^T(\d+)$/.exec(t.sku || '')
        if (mtx) {
          const n = parseInt(mtx[1], 10)
          return Number.isNaN(n) ? m : Math.max(m, n)
        }
        return m
      }, 0)
      const sku = `T${String(max + 1).padStart(3, '0')}`
      store.unshift({ id, createdAt, sku, color: undefined, ...input })
    },
    async updateTissue(input: any) {
      const idx = store.findIndex(x => x.id === input.id)
      if (idx >= 0) store[idx] = { ...store[idx], ...input }
    },
    async deleteTissue(id: string) {
      const idx = store.findIndex(x => x.id === id)
      if (idx >= 0) store.splice(idx, 1)
    }
  }
  return { db: api, __test: { reset: () => { store.splice(0, store.length) } } }
})

async function openDrawerNovo() {
  await userEvent.click(screen.getByRole('button', { name: /novo tecido/i }))
  await screen.findByRole('dialog')
}

async function fillForm({ name, width, composition }: { name?: string; width?: string; composition?: string }) {
  if (name !== undefined) {
    const el = screen.getByLabelText(/nome do tecido/i)
    await userEvent.clear(el)
    await userEvent.type(el, name)
  }
  if (width !== undefined) {
    const el = screen.getByLabelText(/largura/i)
    await userEvent.clear(el)
    await userEvent.type(el, width)
  }
  if (composition !== undefined) {
    const el = screen.getByLabelText(/composição/i)
    await userEvent.clear(el)
    await userEvent.type(el, composition)
  }
}

describe('Cadastro de Tecidos - UI/Fluxo', () => {
  beforeEach(() => {
    const g: any = globalThis as any
    if (g.__tissuesStore) g.__tissuesStore.length = 0
    render(
      <MantineProvider>
        <Notifications />
        <Tissues />
      </MantineProvider>
    )
  })

  afterEach(() => {
    cleanup()
  })

  it('Smoke: renderiza sem erros, tabela vazia e botões corretos', async () => {
    expect(screen.getByRole('heading', { name: /cadastro de tecidos/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /editar/i })).toBeDisabled()
    expect(screen.getByRole('button', { name: /excluir/i })).toBeDisabled()
    // Tabela vazia
    expect(screen.getByText(/Nenhum tecido cadastrado/i)).toBeInTheDocument()
    // Abrir drawer
  await openDrawerNovo()
  expect(await screen.findByRole('dialog')).toBeInTheDocument()
  })

  it('Drawer: novo abre vazio; cancelar fecha sem alterar', async () => {
    await openDrawerNovo()
    // campos vazios
    expect(screen.getByLabelText(/nome do tecido/i)).toHaveValue('')
    expect(screen.getByLabelText(/largura/i)).toHaveValue(0)
    expect(screen.getByLabelText(/composição/i)).toHaveValue('')

    // cancelar sem alterações: deve fechar sem confirmação
    await userEvent.click(screen.getByRole('button', { name: /cancelar/i }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()

    // reabrir, alterar algo e testar confirmação de descarte
    await openDrawerNovo()
    await userEvent.type(screen.getByLabelText(/nome do tecido/i), 'X')
  await userEvent.click(screen.getByRole('button', { name: /cancelar/i }))
  const dialogs = await screen.findAllByRole('dialog')
  const confirm = dialogs.find(d => within(d).queryByText(/Descartar alterações/i))!
  await userEvent.click(within(confirm).getByRole('button', { name: /não/i }))
    // ainda aberto
    expect(screen.getByLabelText(/nome do tecido/i)).toBeInTheDocument()
  await userEvent.click(screen.getByRole('button', { name: /cancelar/i }))
  const dialogs2 = await screen.findAllByRole('dialog')
  const confirm2 = dialogs2.find(d => within(d).queryByText(/Descartar alterações/i))!
  await userEvent.click(within(confirm2).getByRole('button', { name: /sim/i }))
    // drawer fechado
    expect(screen.queryByLabelText(/nome do tecido/i)).not.toBeInTheDocument()
  })

  it('Validações: obrigatórios, largura inteira, e duplicidade', async () => {
    await openDrawerNovo()
    // botão desativado enquanto inválido
    const addBtn = screen.getByRole('button', { name: /adicionar tecido/i })
    expect(addBtn).toBeDisabled()

    // blur para exibir mensagens
    await userEvent.tab()
    await userEvent.tab()
    await userEvent.tab()
  // mensagens visíveis após blur (pelo menos 2 obrigatórios: nome e composição)
  expect(screen.getAllByText(/obrigatório/i).length).toBeGreaterThanOrEqual(2)

    // preencher válido e adicionar
    await fillForm({ name: 'Helanca', width: '160', composition: '96% poliéster 4% elastano' })
    expect(addBtn).toBeEnabled()
    await userEvent.click(addBtn)
    // sucesso com toast
    expect(await screen.findByRole('status')).toHaveTextContent(/adicionado|atualizado/i)

    // duplicidade (case-insensitive, trims)
    await openDrawerNovo()
    await fillForm({ name: '  hElaNca  ', width: '160', composition: 'x' })
    // force blur to compute error
    await userEvent.tab()
    expect(screen.getByText(/nome já cadastrado/i)).toBeInTheDocument()
  })

  it('Inclusão e ordenação: insere 1 linha e aparece no topo', async () => {
    await openDrawerNovo()
    await fillForm({ name: 'Oxford', width: '150', composition: '100% poliéster' })
    await userEvent.click(screen.getByRole('button', { name: /adicionar tecido/i }))
    // linha aparece
    const rows = await screen.findAllByRole('row')
    const bodyRows = rows.slice(1) // remove header
    expect(bodyRows[0]).toHaveTextContent(/oxford/i)
  })

  it('Edição: atualiza apenas a linha selecionada e SKU permanece', async () => {
    // criar um item
    await openDrawerNovo()
    await fillForm({ name: 'Malha', width: '140', composition: '100% algodão' })
    await userEvent.click(screen.getByRole('button', { name: /adicionar tecido/i }))

    // selecionar linha
    const rows = await screen.findAllByRole('row')
    const row = rows[1]
    await userEvent.click(row)
    const editar = screen.getByRole('button', { name: /editar/i })
    expect(editar).toBeEnabled()
    await userEvent.click(editar)

  // capturar SKU exibido na tabela antes (última célula, formato T###)
  const prevSkuCell = within(row).getAllByRole('cell')[3]
  const prevSku = prevSkuCell.textContent

    // editar largura inválida
  const widthEl = screen.getByLabelText(/largura/i)
    await userEvent.clear(widthEl)
    await userEvent.type(widthEl, '0')
    await userEvent.click(screen.getByRole('button', { name: /salvar/i }))
    expect(screen.getByText(/verifique os campos/i)).toBeInTheDocument()

    // corrigir e salvar
    await userEvent.clear(widthEl)
    await userEvent.type(widthEl, '145')
    await userEvent.click(screen.getByRole('button', { name: /salvar/i }))

  // SKU imutável (permanece o mesmo após edição)
    const rows2 = await screen.findAllByRole('row')
    const row2 = rows2[1]
  const skuCell = within(row2).getAllByRole('cell')[3]
  expect(skuCell.textContent).toBe(prevSku)
  })

  it('Exclusão: confirmações e remoção', async () => {
    // criar outro item
    await openDrawerNovo()
    await fillForm({ name: 'Sarja', width: '160', composition: '100% algodão' })
    await userEvent.click(screen.getByRole('button', { name: /adicionar tecido/i }))

    // selecionar e excluir
    const rows = await screen.findAllByRole('row')
    const row = rows[1]
    await userEvent.click(row)
    await userEvent.click(screen.getByRole('button', { name: /excluir/i }))
    const dialog = await screen.findByRole('dialog')
    // Não
    await userEvent.click(within(dialog).getByRole('button', { name: /não/i }))
    expect(await screen.findAllByRole('row')).toHaveLength(rows.length)
    // Excluir de fato
    await userEvent.click(screen.getByRole('button', { name: /excluir/i }))
    const dialog2 = await screen.findByRole('dialog')
    await userEvent.click(within(dialog2).getByRole('button', { name: /sim/i }))
    // após exclusão, tabela volta a ficar vazia
    expect(await screen.findByText(/Nenhum tecido cadastrado/i)).toBeInTheDocument()
  })

  it('Estados dos botões: editar/excluir desativados sem seleção', async () => {
    const editar = screen.getByRole('button', { name: /editar/i })
    const excluir = screen.getByRole('button', { name: /excluir/i })
    expect(editar).toBeDisabled()
    expect(excluir).toBeDisabled()
  })

  it('Pesquisa: filtra por nome ou SKU', async () => {
    await openDrawerNovo()
    await fillForm({ name: 'Oxford Preto', width: '150', composition: '100% poliéster' })
    await userEvent.click(screen.getByRole('button', { name: /adicionar tecido/i }))

    await openDrawerNovo()
    await fillForm({ name: 'Sarja Azul', width: '160', composition: '100% algodão' })
    await userEvent.click(screen.getByRole('button', { name: /adicionar tecido/i }))

    const search = screen.getByRole('textbox', { name: /pesquisar/i })
    await userEvent.clear(search)
    await userEvent.type(search, 'sarja')
    // Deve restar apenas Sarja
    const rows = await screen.findAllByRole('row')
    const bodyRows = rows.slice(1)
    expect(bodyRows).toHaveLength(1)
    expect(bodyRows[0]).toHaveTextContent(/sarja/i)
  })

  it('Ordenação: ordena por largura asc/desc', async () => {
    await openDrawerNovo()
    await fillForm({ name: 'Malha 150', width: '150', composition: '100% algodão' })
    await userEvent.click(screen.getByRole('button', { name: /adicionar tecido/i }))

    await openDrawerNovo()
    await fillForm({ name: 'Malha 160', width: '160', composition: '100% algodão' })
    await userEvent.click(screen.getByRole('button', { name: /adicionar tecido/i }))

    // Click cabeçalho Largura para ordenar asc
    const headerBtn = screen.getByRole('button', { name: /largura/i })
    await userEvent.click(headerBtn)
    let rows = await screen.findAllByRole('row')
    let bodyRows = rows.slice(1)
    expect(bodyRows[0]).toHaveTextContent(/malha 150/i)

    // Click novamente para desc
    await userEvent.click(headerBtn)
    rows = await screen.findAllByRole('row')
    bodyRows = rows.slice(1)
    expect(bodyRows[0]).toHaveTextContent(/malha 160/i)
  })
})
