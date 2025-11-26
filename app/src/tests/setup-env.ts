// Minimal global test environment polyfills (avoid intrusive canvas overrides)
// Attach jest-dom matchers to Vitest's expect
import '@testing-library/jest-dom/vitest'
// Provide IndexedDB implementation
import 'fake-indexeddb/auto'

if (!(globalThis as any).ImageData) {
  class PolyImageData {
    width: number; height: number; data: Uint8ClampedArray
    constructor(dataOrWidth: any, widthOrHeight?: number, maybeHeight?: number) {
      if (typeof dataOrWidth === 'number') {
        // Signature: (width, height)
        this.width = dataOrWidth
        this.height = widthOrHeight || 0
        this.data = new Uint8ClampedArray(this.width * this.height * 4)
      } else if (dataOrWidth instanceof Uint8ClampedArray && typeof widthOrHeight === 'number' && typeof maybeHeight === 'number') {
        // Signature: (data, width, height)
        this.width = widthOrHeight
        this.height = maybeHeight
        // If provided data length mismatch, allocate new
        const expected = this.width * this.height * 4
        this.data = dataOrWidth.length === expected ? dataOrWidth : new Uint8ClampedArray(expected)
      } else {
        // Fallback minimal
        this.width = 0
        this.height = 0
        this.data = new Uint8ClampedArray(0)
      }
    }
  }
  ;(globalThis as any).ImageData = PolyImageData as any
}

if (!(globalThis as any).matchMedia) {
  ;(globalThis as any).matchMedia = (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener() {},
    removeListener() {},
    addEventListener() {},
    removeEventListener() {},
    dispatchEvent() { return false }
  })
}

// Polyfill URL.createObjectURL / revokeObjectURL (jsdom lacks implementation for Blobs used in tests)
if (typeof URL !== 'undefined' && !(URL as any).createObjectURL) {
  ;(URL as any).createObjectURL = (blob: any) => {
    const rand = Math.random().toString(36).slice(2)
    return `blob:poly-${rand}`
  }
  ;(URL as any).revokeObjectURL = () => {}
}
