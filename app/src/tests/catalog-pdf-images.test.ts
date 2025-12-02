import { describe, it, expect, vi, beforeEach } from 'vitest'
import { generateCatalogPdf } from '@/lib/pdf/catalog-pdf'

// --- Mocks Setup ---

const { mockReadFile, mockHttpFetch, mockIsTauri } = vi.hoisted(() => {
  return { 
    mockReadFile: vi.fn(),
    mockHttpFetch: vi.fn(),
    mockIsTauri: vi.fn().mockReturnValue(true)
  }
})

// 1. Mock @/lib/platform
vi.mock('@/lib/platform', () => ({
  isTauri: mockIsTauri,
  saveFile: vi.fn().mockResolvedValue({ success: true, location: 'C:\\fake\\path.pdf' }),
  showSaveDialog: vi.fn()
}))

// 2. Mock @tauri-apps/plugin-fs
vi.mock('@tauri-apps/plugin-fs', () => ({
  readFile: mockReadFile,
  default: { readFile: mockReadFile }
}))

// 2b. Mock @tauri-apps/plugin-http
vi.mock('@tauri-apps/plugin-http', () => ({
  fetch: mockHttpFetch,
  default: { fetch: mockHttpFetch }
}))

// 3. Mock jsPDF to spy on addImage
const addImageSpy = vi.fn()
class MockJsPDF {
  internal = { pageSize: { getWidth: () => 595.28, getHeight: () => 841.89 } }
  constructor(_opts: any) {}
  setFontSize(){}
  setTextColor(){}
  setDrawColor(){}
  setFillColor(){}
  text(){}
  roundedRect(){}
  line(){}
  addPage(){}
  splitTextToSize(t: string){ return [t] }
  output(){ return new Blob(['pdf'], { type: 'application/pdf' }) }
  addImage(...args: any[]) { addImageSpy(...args) }
}
vi.mock('jspdf', () => ({ jsPDF: MockJsPDF }))

// 4. Mock global Image
global.Image = class {
  onload: (() => void) | null = null;
  onerror: ((e: any) => void) | null = null;
  src: string = '';
  naturalWidth = 100;
  naturalHeight = 100;
  constructor() {
    setTimeout(() => {
      if (this.src && this.onload) {
        this.onload();
      }
    }, 5);
  }
} as any;

describe('catalog-pdf image loading (Tauri mode)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockReadFile.mockReset()
    mockHttpFetch.mockReset()
    mockIsTauri.mockReturnValue(true)
  })

  it('loads local file via plugin-fs and embeds it', async () => {
    // Setup: Mock fs.readFile to return a simple buffer
    const fakeBytes = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]) // PNG signature
    mockReadFile.mockResolvedValue(fakeBytes)

    const items = [{
      tissueId: 1,
      tissueName: 'Tecido Teste',
      tissueSku: 'T001',
      colors: [{
        colorId: 1,
        colorName: 'Cor 1',
        colorSku: 'C001',
        imageThumb: 'C:\\Users\\Test\\image.png', // Local path!
        hex: '#ffffff',
        family: 'Brancos'
      }],
      patterns: []
    }]

    // Execute
    await generateCatalogPdf({ items })

    // Verify:
    // 1. fs.readFile should have been called with the path
    expect(mockReadFile).toHaveBeenCalledWith('C:\\Users\\Test\\image.png')

    // 2. addImage should have been called
    expect(addImageSpy).toHaveBeenCalled()
    
    // 3. Check data passed to addImage. 
    // It should be a Data URL constructed from the bytes.
    const args = addImageSpy.mock.calls[0]
    const dataUrl = args[0] as string
    expect(dataUrl).toContain('data:image/png;base64,')
    expect(dataUrl).toContain('iVBORw0KGgo=')
  })

  it('uses Data URL directly without fs read if provided', async () => {
    const dataUrl = 'data:image/png;base64,fakeimagecontent'
    const items = [{
      tissueId: 1,
      tissueName: 'Tecido Teste',
      tissueSku: 'T001',
      colors: [{
        colorId: 1,
        colorName: 'Cor 1',
        colorSku: 'C001',
        imageThumb: dataUrl, // Direct Data URL
        hex: '#ffffff',
        family: 'Brancos'
      }],
      patterns: []
    }]

    await generateCatalogPdf({ items })

    // fs.readFile should NOT be called
    expect(mockReadFile).not.toHaveBeenCalled()

    // addImage should be called with the exact data URL
    expect(addImageSpy).toHaveBeenCalled()
    expect(addImageSpy.mock.calls[0][0]).toBe(dataUrl)
  })

  it('falls back to debug text in PDF if loading fails', async () => {
    // Setup: fs.readFile throws error
    mockReadFile.mockRejectedValue(new Error('File not found'))

    const items = [{
      tissueId: 1,
      tissueName: 'Tecido Teste',
      tissueSku: 'T001',
      colors: [{
        colorId: 1,
        colorName: 'Cor 1',
        colorSku: 'C001',
        imageThumb: 'C:\\missing.png',
        hex: '#ffffff',
        family: 'Brancos'
      }],
      patterns: []
    }]

    await generateCatalogPdf({ items })

    // addImage should NOT be called (because image load failed)
    expect(addImageSpy).not.toHaveBeenCalled()
  })
})
