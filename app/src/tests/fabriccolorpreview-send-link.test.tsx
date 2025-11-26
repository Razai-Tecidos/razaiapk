// Test shim: provide loose types via 'any' casts instead of ts-nocheck
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import React from 'react'
import { FabricColorPreview } from '@/components/FabricColorPreview'

// Declara factory para mock antes de qualquer import consumidor.
vi.mock('@/lib/db', () => {
  return {
    linksDb: {
      setImageFull: vi.fn(async (_id: string, _file: File) => {/*simulate saved*/})
    }
  }
})

// Mock canvas and Image por teste (isolado para não interferir em outros)
beforeEach(() => {
  const originalCreate = Document.prototype.createElement
  vi.spyOn(document, 'createElement').mockImplementation((tag: any) => {
    const el = originalCreate.call(document as any, tag)
    if (tag === 'canvas') {
      ;(el as HTMLCanvasElement).getContext = () => ({
        drawImage(){},
        putImageData(){},
        fillRect(){},
        beginPath(){},
        stroke(){},
        arc(){},
        clearRect(){},
        fill(){},
        getImageData(_x:number,_y:number,w:number,h:number){
          return new ImageData(w, h)
        },
        strokeStyle:'',
        fillStyle:''
      }) as any
      ;(el as HTMLCanvasElement).toBlob = (cb: any) => cb(new Blob(['fake'], { type: 'image/png' }))
      Object.defineProperty(el, 'width', { value: 120, writable: true })
      Object.defineProperty(el, 'height', { value: 80, writable: true })
    }
    return el
  })
  class MockImage {
    public src = ''
    public naturalWidth = 120
    public naturalHeight = 80
    public width = 120
    public height = 80
    public onload: null | (()=>void) = null
    public onerror: null | (()=>void) = null
    constructor() { setTimeout(()=> this.onload && this.onload(), 0) }
  }
  ;(globalThis as any).Image = MockImage as any
})
afterEach(() => {
  vi.restoreAllMocks()
})

function makeColor(hex: string, name: string) {
  return { hex, name, lab: { L: 50, a: 0, b: 0 } }
}

describe('FabricColorPreview - Enviar ao Vínculo', () => {
  it('Chama linksDb.setImageFull ao clicar Enviar ao Vínculo com cor selecionada', async () => {
    const colors = [makeColor('#FFCC00','Amarelo'), makeColor('#228B22','Verde')]
    const linksForColors = [ { skuFilho: 'T001-AM001', id: 'link1' }, { skuFilho: 'T001-VE001', id: 'link2' } ]
    render(<FabricColorPreview colors={colors as any} linksForColors={linksForColors} tissueName="Tecido Alpha" />)
    const fileInput = screen.getByLabelText(/Imagem do tecido/i)
    const file = new File(['x'], 'base.png', { type: 'image/png' })
    await userEvent.upload(fileInput, file)
    const select = await screen.findByRole('combobox')
    // Aguarda habilitação do select (baseTexture processado)
    await waitFor(() => expect(select).toBeEnabled())
    await userEvent.selectOptions(select, '0')
    const btnReady = screen.getByRole('button', { name: /Enviar ao Vínculo/i })
    expect(btnReady).toBeEnabled()
    const btnEnviar = screen.getByRole('button', { name: /Enviar ao Vínculo/i })
    await userEvent.click(btnEnviar)
    const { linksDb } = await import('@/lib/db')
    expect(linksDb.setImageFull).toHaveBeenCalledTimes(1)
    expect(linksDb.setImageFull).toHaveBeenCalledWith('link1', expect.any(File))
  })
})
