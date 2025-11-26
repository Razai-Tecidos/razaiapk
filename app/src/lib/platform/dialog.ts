import { getRuntime, isRuntime } from './runtime'

export type DialogFilter = {
  name: string
  extensions: string[]
}

interface BaseDialogOptions {
  title?: string
  description?: string
  defaultPath?: string
  filters?: DialogFilter[]
}

export interface OpenDialogOptions extends BaseDialogOptions {
  multiple?: boolean
  directory?: boolean
}

export interface OpenDialogResult {
  cancelled: boolean
  paths: string[]
  files?: File[]
  fallbackUsed?: boolean
}

export interface SaveDialogOptions extends BaseDialogOptions {
  suggestedName?: string
}

export interface SaveDialogResult {
  cancelled: boolean
  path?: string
  fallbackUsed?: boolean
}

export async function showOpenDialog(options: OpenDialogOptions = {}): Promise<OpenDialogResult> {
  if (getRuntime() === 'node-test') {
    return { cancelled: true, paths: [], fallbackUsed: true }
  }
  if (isRuntime('tauri-desktop', 'tauri-mobile')) {
    try {
      const dialogMod: any = await import('@tauri-apps/plugin-dialog')
      const openFn = dialogMod.open || dialogMod.default?.open
      if (typeof openFn === 'function') {
        const raw = await openFn({
          multiple: options.directory ? true : options.multiple,
          directory: options.directory,
          filters: options.filters,
          defaultPath: options.defaultPath,
          title: options.title,
          description: options.description,
        })
        if (!raw) return { cancelled: true, paths: [], fallbackUsed: false }
        const paths = Array.isArray(raw) ? raw : [raw]
        return { cancelled: false, paths, fallbackUsed: false }
      }
    } catch (error) {
      console.warn('[platform:dialog] showOpenDialog native path failed; falling back to web dialog', error)
    }
  }

  return webOpenDialog(options)
}

export async function showSaveDialog(options: SaveDialogOptions = {}): Promise<SaveDialogResult> {
  if (getRuntime() === 'node-test') {
    return { cancelled: true, fallbackUsed: true }
  }
  if (isRuntime('tauri-desktop', 'tauri-mobile')) {
    try {
      const dialogMod: any = await import('@tauri-apps/plugin-dialog')
      const saveFn = dialogMod.save || dialogMod.default?.save
      if (typeof saveFn === 'function') {
        const suggested = options.defaultPath || options.suggestedName
        const path = await saveFn({
          defaultPath: suggested,
          filters: options.filters,
          title: options.title,
          description: options.description,
        })
        if (!path) return { cancelled: true, fallbackUsed: false }
        return { cancelled: false, path, fallbackUsed: false }
      }
    } catch (error) {
      console.warn('[platform:dialog] showSaveDialog native path failed; falling back to web prompt', error)
    }
  }

  return webSaveDialog(options)
}

function webOpenDialog(options: OpenDialogOptions): Promise<OpenDialogResult> {
  if (typeof document === 'undefined' || typeof window === 'undefined') {
    return Promise.resolve({ cancelled: true, paths: [], fallbackUsed: true })
  }
  return new Promise<OpenDialogResult>((resolve) => {
    const input = document.createElement('input')
    input.type = 'file'
    input.style.position = 'fixed'
    input.style.opacity = '0'
    input.style.pointerEvents = 'none'
    if (options.directory) {
      input.setAttribute('webkitdirectory', 'true')
      input.multiple = true
    } else if (options.multiple) {
      input.multiple = true
    }
    const accept = filtersToAccept(options.filters)
    if (accept) input.accept = accept
    document.body.appendChild(input)

    let resolved = false
    const cleanup = () => {
      input.remove()
      window.removeEventListener('focus', handleFocus, true)
    }
    const handleFocus = () => {
      window.setTimeout(() => {
        if (!resolved) {
          resolved = true
          cleanup()
          resolve({ cancelled: true, paths: [], fallbackUsed: true })
        }
      }, 0)
    }
    const handleChange = () => {
      if (resolved) return
      resolved = true
      const files = Array.from(input.files ?? [])
      cleanup()
      if (!files.length) {
        resolve({ cancelled: true, paths: [], fallbackUsed: true })
        return
      }
      const paths = files.map(file => file.webkitRelativePath || file.name)
      resolve({ cancelled: false, paths, files, fallbackUsed: true })
    }

    window.addEventListener('focus', handleFocus, true)
    input.addEventListener('change', handleChange, { once: true })
    input.click()
  })
}

function webSaveDialog(options: SaveDialogOptions): SaveDialogResult {
  if (typeof window === 'undefined') return { cancelled: true, fallbackUsed: true }
  const promptFn: any = typeof window.prompt === 'function' ? window.prompt : undefined
  if (!promptFn) return { cancelled: true, fallbackUsed: true }
  const suggestion = options.suggestedName || options.defaultPath || ''
  const promptLabel = options.title || 'Escolha o nome do arquivo para salvar:'
  const value = promptFn(promptLabel, suggestion)
  if (!value) return { cancelled: true, fallbackUsed: true }
  return { cancelled: false, path: value, fallbackUsed: true }
}

function filtersToAccept(filters?: DialogFilter[]): string | undefined {
  if (!filters || filters.length === 0) return undefined
  const extensions = new Set<string>()
  for (const filter of filters) {
    for (const ext of filter.extensions || []) {
      const clean = ext.startsWith('.') ? ext.toLowerCase() : `.${ext.toLowerCase()}`
      if (clean === '.*') continue
      extensions.add(clean)
    }
  }
  if (!extensions.size) return undefined
  return Array.from(extensions).join(',')
}

export function resetDialogCacheForTests() {
  // placeholder – kept for API consistency if we add caching later
  const runtime = getRuntime()
  if (runtime === 'node-test') return
}
