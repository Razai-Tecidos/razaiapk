import { describe, it, expect, vi } from 'vitest'
import { generateCatalogPdf } from '@/lib/pdf/catalog-pdf'
import { LAYOUT, line } from '@/lib/pdf/layout'

// Mock jspdf dynamic import
const drawings: { page: number; type: string; y: number; h?: number; text?: string }[] = []

class MockJsPDF {
  internal = { pageSize: { getWidth: () => 595.28, getHeight: () => 841.89 } }
  page = 1
  fontSize = 10
  textColor = 0
  constructor(_opts: any) {}
  setFontSize(fs: number){ this.fontSize = fs }
  setTextColor(c: number){ this.textColor = c }
  setDrawColor(_c: number){}
  setFillColor(_c: any){}
  text(str: string, _x: number, y: number, _opts?: any){ drawings.push({ page: this.page, type: 'text', y, text: str }) }
  roundedRect(_x: number, y: number, _w: number, h: number){ drawings.push({ page: this.page, type: 'rect', y, h }) }
  line(_x1:number, y:number, _x2:number, _y2:number){ drawings.push({ page: this.page, type: 'line', y }) }
  addPage(){ this.page++ }
  addImage(_data:any,_fmt:string,_x:number,_y:number,_w:number,_h:number){ /* ignore */ }
  splitTextToSize(txt: string, _maxWidth: number){
    // naive split to simulate wrapping: break every 60 chars
    const lines: string[] = []
    for (let i=0;i<txt.length;i+=60) lines.push(txt.slice(i,i+60))
    return lines
  }
  output(_mode: string){ return new Blob(['pdf'], { type: 'application/pdf' }) }
}

vi.mock('jspdf', () => ({ jsPDF: MockJsPDF }))

describe('catalog-pdf layout bounds', () => {
  it('does not draw cells or labels beyond bottom limit', async () => {
    drawings.length = 0
    const longDesc = 'Descrição muito longa '.repeat(25)
    const colors = Array.from({ length: 40 }, (_, i) => ({
      colorId: i+1,
      colorName: 'Cor Especial Muito Longa ' + i,
      colorSku: 'C'+(i+1).toString().padStart(3,'0'),
      hex: '#AA3366',
      family: 'X',
      skuFilho: 'SK'+i,
      status: 'Ativo',
      createdAt: new Date().toISOString()
    }))
    const items = [{
      tissueId: 1,
      tissueName: 'Tecido Alpha',
      tissueSku: 'TA01',
      composition: '100% Algodão',
      width: 150,
      gsm: 180,
      description: longDesc,
      supplier: 'Fornecedor X',
      season: 'SS25',
      colors,
      patterns: []
    }]
    await generateCatalogPdf({ items, config: { includeCover: true, title: 'Catálogo de Tecidos', showFooterBrand: true, brandName: 'RAZAI', showFooterPageNumbers: true } })
    const pageH = 841.89
    const bottomLimit = pageH - (LAYOUT.footerHeight + line(2))
    // Filter out footer text lines (contain 'Página')
    const nonFooter = drawings.filter(d => !(d.type==='text' && d.text && /Página\s+/.test(d.text)))
    for (const d of nonFooter) {
      if (d.type === 'rect') {
        expect(d.y + (d.h || 0)).toBeLessThanOrEqual(bottomLimit + 0.01)
      } else {
        expect(d.y).toBeLessThanOrEqual(bottomLimit + 0.01)
      }
    }
    // Ensure first rectangle starts after metadata block (metadata end line + separator). Find max metadata y before first rect.
    const firstRect = drawings.find(d => d.type==='rect')
    expect(firstRect).toBeTruthy()
    const textsBeforeFirstRect = drawings.filter(d => d.type==='text' && d.page === firstRect!.page && d.y < firstRect!.y)
    const maxMetaY = textsBeforeFirstRect.reduce((m,d)=> Math.max(m,d.y),0)
    expect(firstRect!.y).toBeGreaterThan(maxMetaY + line(1))
  })
})
