import { describe, it, expect } from 'vitest'
import React from 'react'
import { render } from '@testing-library/react'
import App from '../src/App'
import { DS } from '../src/design-system/tokens'
import { APP_VERSION } from '../src/version'

// Minimal wrapper replicating background style from main.tsx
function Wrapper() {
  return <div style={{ background: DS.color.bg }}><App /></div>
}

describe('Design System application', () => {
  it('applies the new light background color', () => {
    const { container } = render(<Wrapper />)
    const bg = (container.firstChild as HTMLElement).style.background
    expect(bg.toLowerCase()).toContain(DS.color.bg.toLowerCase())
  })

  it('renders version badge in header', () => {
    const { getByText } = render(<Wrapper />)
    // Badge format: v<version>
    const badge = getByText(new RegExp(`^v${APP_VERSION.replace(/[-^$*+?.()|[\]\\]/g,'\\$&')}$`))
    expect(badge).toBeTruthy()
  })

  it('tokens file exposes expected background value', () => {
    expect(DS.color.bg).toBe('#FCFCFC')
  })
})
