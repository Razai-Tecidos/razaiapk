import { describe, it, expect, afterEach } from 'vitest'
import React from 'react'
import { render, screen, cleanup } from '@testing-library/react'
import { MantineProvider } from '@mantine/core'
import Patterns from '@/pages/Patterns'

function wrap(ui: React.ReactElement){
  return <MantineProvider>{ui}</MantineProvider>
}

describe('Patterns visual - sticky action bars and multi-add hint', () => {
  afterEach(() => cleanup())

  it('renders sticky top actions bar', async () => {
    render(wrap(<Patterns />))
    const top = await screen.findByTestId('actions-bar-top')
    expect(top).toBeInTheDocument()
    expect(top).toHaveStyle({ position: 'sticky' })
  })

  it('drawer shows sticky actions bar', async () => {
    render(wrap(<Patterns />))
    const newBtn = screen.getByRole('button', { name: /nova estampa/i })
    newBtn.click()
    const drawerBar = await screen.findByTestId('drawer-actions')
    expect(drawerBar).toBeInTheDocument()
    expect(drawerBar).toHaveStyle({ position: 'sticky' })
  })
})
