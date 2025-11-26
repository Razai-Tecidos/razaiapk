// Global test setup: canvas, Image, ImageData, indexedDB polyfills & helpers
// Consolidates previously ad-hoc mocks to reduce duplication & flakiness.

// Polyfill ImageData if missing (jsdom in Node may not expose it depending on version)
// Provide indexedDB (fake) for idb-based persistence tests
try {
  // dynamic import ensures it doesn't bloat prod bundle
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  require('fake-indexeddb/auto')
} catch {}

// Extend expect with jest-dom matchers (toBeEnabled etc.)
try { require('@testing-library/jest-dom') } catch {}

if (!(globalThis as any).ImageData) {
  class PolyImageData {
    width: number; height: number; data: Uint8ClampedArray
    constructor(w:number,h:number){
      this.width = w; this.height = h; this.data = new Uint8ClampedArray(w*h*4)
    }
  }
  ;(globalThis as any).ImageData = PolyImageData as any
}

// Provide a lightweight 2D context mock only if getContext returns null (avoid overriding libraries that patch it)
function ensureCanvasContextPolyfill() {
  const proto = HTMLCanvasElement.prototype as any
  const originalGetContext = proto.getContext
  proto.getContext = function(type: string) {
    if ((this as HTMLCanvasElement).width === 0) (this as HTMLCanvasElement).width = 120
    if ((this as HTMLCanvasElement).height === 0) (this as HTMLCanvasElement).height = 80
    const ctx = originalGetContext ? originalGetContext.call(this, type) : null
    if (ctx) {
      // augment missing methods if any
      if (!('getImageData' in ctx)) {
        ;(ctx as any).getImageData = (_x:number,_y:number,w:number,h:number)=> new (globalThis as any).ImageData(w,h)
      }
      if (!('putImageData' in ctx)) {
        ;(ctx as any).putImageData = () => {}
      }
      return ctx
    }
    if (type === '2d') {
      return {
        drawImage(){}, putImageData(){}, getImageData: (_x:number,_y:number,w:number,h:number)=> new (globalThis as any).ImageData(w,h),
        fillRect(){}, clearRect(){}, beginPath(){}, stroke(){}, arc(){}, fill(){}, strokeStyle:'', fillStyle:''
      }
    }
    return null
  }
  // toBlob polyfill
  if (!proto.toBlob) {
    proto.toBlob = function(cb: (b:Blob|null)=>void, _type?: string) {
      cb(new Blob(['polyfill'], { type: 'image/png' }))
    }
  }
}
ensureCanvasContextPolyfill()

// Global Image mock that instantly loads
class InstantImage {
  public src = ''
  public naturalWidth = 120
  public naturalHeight = 80
  public width = 120
  public height = 80
  public onload: null | (()=>void) = null
  public onerror: null | (()=>void) = null
  constructor() {
    setTimeout(()=> this.onload && this.onload(), 0)
  }
}
;(globalThis as any).Image = InstantImage as any

// Helper for tests that want a fresh canvas quickly
;(globalThis as any).createTestCanvas = (w=120,h=80) => {
  const cnv = document.createElement('canvas') as HTMLCanvasElement
  cnv.width = w; cnv.height = h
  const ctx = cnv.getContext('2d') as any
  // Fill with mid-gray so LAB calculations have non-zero stats
  if (ctx && ctx.fillRect) {
    ctx.fillStyle = '#A6A6A6'
    ctx.fillRect(0,0,w,h)
  }
  return cnv
}

// matchMedia polyfill for Mantine / components relying on it
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

// Silence alert dialogs in tests by default; individual tests can spy if they need verification
if (!(globalThis as any).alert) {
  ;(globalThis as any).alert = () => {}
}

// Optional: expose a hook to temporarily disable instant image load
;(globalThis as any).__withDelayedImageLoad = async (delayMs: number, fn: () => Promise<void>|void) => {
  const PrevImage = (globalThis as any).Image
  class DelayedImage extends PrevImage {
    constructor() { super(); setTimeout(()=> this.onload && this.onload(), delayMs) }
  }
  ;(globalThis as any).Image = DelayedImage
  try { await fn() } finally { (globalThis as any).Image = PrevImage }
}
