import { isRuntime } from './runtime'

export interface OpenExternalOptions {
  newTab?: boolean
  activate?: boolean
}

export async function openExternal(target: string, options: OpenExternalOptions = {}): Promise<boolean> {
  if (!target) return false

  if (isRuntime('tauri-desktop', 'tauri-mobile')) {
    const success = await tryOpenWithTauri(target)
    if (success) return true
  }

  if (typeof window !== 'undefined' && typeof window.open === 'function') {
    try {
      const tab = window.open(target, options.newTab === false ? '_self' : '_blank', options.activate === false ? 'noopener' : undefined)
      if (tab && options.activate === false) {
        try { tab.blur?.() } catch { /* ignore */ }
      }
      return !!tab
    } catch (error) {
      console.warn('[platform:shell] openExternal window fallback failed', error)
      return false
    }
  }

  console.info('[platform:shell] openExternal fallback noop (no available API) for target', target)
  return false
}

export async function openPath(path: string): Promise<boolean> {
  if (!path) return false

  if (isRuntime('tauri-desktop', 'tauri-mobile')) {
    const success = await tryOpenWithTauri(path)
    if (success) return true
  }

  console.info('[platform:shell] openPath fallback not available in this runtime for', path)
  return false
}

async function tryOpenWithTauri(target: string): Promise<boolean> {
  try {
    const opener: any = await import('@tauri-apps/plugin-opener')
    const openFn = opener.open || opener.default?.open
    if (typeof openFn === 'function') {
      await openFn(target)
      return true
    }
  } catch (error) {
    console.debug('[platform:shell] plugin-opener open failed; trying shell fallback', error)
  }

  try {
    const apiMod: any = await import('@tauri-apps/api')
    const shell = apiMod.shell || apiMod.default?.shell
    if (shell && typeof shell.open === 'function') {
      await shell.open(target)
      return true
    }
  } catch (error) {
    console.debug('[platform:shell] api shell open failed', error)
  }

  return false
}
