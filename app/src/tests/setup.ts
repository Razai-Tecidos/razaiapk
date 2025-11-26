import '@testing-library/jest-dom/vitest'
// Polyfill IndexedDB for jsdom/node test environment
import 'fake-indexeddb/auto'
import { vi } from 'vitest'
// Canvas polyfill for node/jsdom tests using @napi-rs/canvas
import { createCanvas as napiCreateCanvas, Image as NapiImage, loadImage as napiLoadImage } from '@napi-rs/canvas'

// Polyfill window.matchMedia for Mantine (and other libs) in jsdom
// Some jsdom versions define the property but leave it undefined, so check for function type
if (typeof window !== 'undefined' && typeof (window as any).matchMedia !== 'function') {
	Object.defineProperty(window, 'matchMedia', {
		writable: true,
		configurable: true,
		value: vi.fn().mockImplementation((query: string) => ({
			matches: false,
			media: query,
			onchange: null,
			addListener: vi.fn(), // deprecated
			removeListener: vi.fn(), // deprecated
			addEventListener: vi.fn(),
			removeEventListener: vi.fn(),
			dispatchEvent: vi.fn(),
		})),
	})
}

// Optional: silence ResizeObserver absence if any component uses it
if (typeof window !== 'undefined' && !(window as any).ResizeObserver) {
	;(window as any).ResizeObserver = class {
		observe() {}
		unobserve() {}
		disconnect() {}
	}
}

// Polyfill URL.createObjectURL / revokeObjectURL for download flows in jsdom
if (typeof URL !== 'undefined') {
	if (typeof (URL as any).createObjectURL !== 'function') {
		;(URL as any).createObjectURL = vi.fn(() => 'blob:mock')
	}
	if (typeof (URL as any).revokeObjectURL !== 'function') {
		;(URL as any).revokeObjectURL = vi.fn()
	}
}

// Bridge jsdom <-> @napi-rs/canvas for Canvas and Image
if (typeof document !== 'undefined') {
	const origCreateElement = document.createElement.bind(document)
	// Replace window.Image with NapiImage for decode support
	;(globalThis as any).Image = NapiImage
	;(globalThis as any).loadTestImage = napiLoadImage

	document.createElement = ((tagName: any, options?: any) => {
		if (typeof tagName === 'string' && tagName.toLowerCase() === 'canvas') {
			// Wrap napi canvas in a DOM-like facade used by our code
			const cnv = napiCreateCanvas(1, 1)
			const facade: any = {
				nodeName: 'CANVAS',
				style: {},
				getContext: (type: string, _opts?: any) => cnv.getContext(type as any),
				toDataURL: (...args: any[]) => (cnv as any).toDataURL(...args),
			}
			Object.defineProperty(facade, 'width', {
				get() { return cnv.width },
				set(v: number) { cnv.width = v },
			})
			Object.defineProperty(facade, 'height', {
				get() { return cnv.height },
				set(v: number) { cnv.height = v },
			})
			// Allow access to underlying napi canvas if needed
			;(facade as any)._napi = cnv
			return facade
		}
		return origCreateElement(tagName, options)
	}) as any
}
