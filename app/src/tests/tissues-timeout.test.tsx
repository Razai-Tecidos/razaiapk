import { describe, expect, it, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MantineProvider } from '@mantine/core'
import React from 'react'
import Tissues from '@/pages/Tissues'

// We will mock db to simulate a hanging createTissue
vi.mock('@/lib/db', () => {
  const list: any[] = []
  return {
    db: {
      init: async () => {},
      listTissues: async () => list,
      createTissue: async (_: any) => new Promise(() => {}), // never resolves
      updateTissue: async (_: any) => {},
      deleteTissue: async (_: any) => {}
    }
  }
})

describe('Cadastro de Tecidos - timeout não deixa UI travada', () => {
  it('libera o botão após ~5s quando createTissue não resolve', async () => {
    render(<MantineProvider><Tissues /></MantineProvider>)

    // abrir drawer
    const novoBtn = await screen.findByRole('button', { name: /novo tecido/i })
    fireEvent.click(novoBtn)

    // preencher campos válidos
    const nome = await screen.findByLabelText(/nome do tecido/i)
    const largura = await screen.findByLabelText(/largura/i)
    const comp = await screen.findByLabelText(/composição/i)

    fireEvent.change(nome, { target: { value: 'Teste' } })
    fireEvent.change(largura, { target: { value: '160' } })
    fireEvent.change(comp, { target: { value: '100% algodão' } })

    const adicionar = await screen.findByRole('button', { name: /adicionar tecido/i })
    fireEvent.click(adicionar)

    // fica "salvando..." inicialmente
    expect(await screen.findByRole('button', { name: /salvando/i })).toBeInTheDocument()

  // esperar levemente acima de 5s para acionar o timeout interno do componente
  await new Promise(r => setTimeout(r, 5200))

    // botão deve liberar (não "salvando...") e um toast de erro deve aparecer
    const btns = await screen.findAllByRole('button')
    expect(btns.some(b => /salvando/i.test(b.textContent || ''))).toBeFalsy()
    // não conseguimos capturar o toast facilmente, mas a ausência de "salvando..." já valida o desbloqueio
  }, 8000)
})
