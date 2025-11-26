import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { showOpenDialog, showSaveDialog } from '@/lib/platform/dialog'
import { openExternal, openPath } from '@/lib/platform/shell'
import * as runtime from '@/lib/platform/runtime'

describe('platform services', () => {
	beforeEach(() => {
		runtime.resetRuntimeDetectionForTests()
	})

	afterEach(() => {
		vi.restoreAllMocks()
		runtime.resetRuntimeDetectionForTests()
	})

	it('returns cancelled result for open dialog in node-test runtime', async () => {
		vi.spyOn(runtime, 'getRuntime').mockReturnValue('node-test')
		const result = await showOpenDialog()
		expect(result.cancelled).toBe(true)
		expect(result.paths).toEqual([])
		expect(result.fallbackUsed).toBe(true)
	})

	it('falls back to prompt for save dialog on web runtime', async () => {
		vi.spyOn(runtime, 'getRuntime').mockReturnValue('web')
		if (typeof window.prompt !== 'function') {
			;(window as any).prompt = () => null
		}
		const promptSpy = vi.spyOn(window, 'prompt').mockImplementation(() => 'catalogo.pdf')
		const result = await showSaveDialog({ suggestedName: 'catalogo.pdf' })
		expect(promptSpy).toHaveBeenCalled()
		expect(result.cancelled).toBe(false)
		expect(result.path).toBe('catalogo.pdf')
		expect(result.fallbackUsed).toBe(true)
	})

	it('uses window.open when opening external links in web runtime', async () => {
		const openSpy = vi.spyOn(window, 'open').mockImplementation(() => ({} as any))
		const result = await openExternal('https://example.com')
		expect(result).toBe(true)
		expect(openSpy).toHaveBeenCalledWith('https://example.com', '_blank', undefined)
	})

	it('returns false when openPath is unavailable on web runtime', async () => {
		const infoSpy = vi.spyOn(console, 'info').mockImplementation(() => {})
		const result = await openPath('C:/tmp/catalogo.pdf')
		expect(result).toBe(false)
		expect(infoSpy).toHaveBeenCalled()
	})
})
