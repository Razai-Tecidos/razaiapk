/*
 * Runtime detection utilities.
 * Single source of truth for determining whether we are running on web, Tauri desktop, future Tauri mobile builds,
 * Capacitor (planned), or Node-based test environments (Vitest/jsdom).
 */

export type RuntimeFlavor = 'web' | 'tauri-desktop' | 'tauri-mobile' | 'capacitor' | 'node-test'

let cachedRuntime: RuntimeFlavor | null = null

/**
 * Infer the current runtime flavor once and cache the result.
 */
export function getRuntime(): RuntimeFlavor {
  if (cachedRuntime) return cachedRuntime

  if (typeof window === 'undefined') {
    cachedRuntime = 'node-test'
    return cachedRuntime
  }

  const w = window as any
  const ua = (window.navigator && window.navigator.userAgent) ? window.navigator.userAgent : ''
  const hasTauri = !!(w.__TAURI__ || w.__TAURI_INTERNALS__)
  const hasCapacitor = !!(w.Capacitor || (ua && ua.includes('Capacitor'))) // forward-compatible placeholder

  if (hasTauri) {
    const platformHint = String(w.__TAURI_METADATA__?.platform || ua || '').toLowerCase()
    if (platformHint.includes('android') || platformHint.includes('ios')) {
      cachedRuntime = 'tauri-mobile'
    } else {
      cachedRuntime = 'tauri-desktop'
    }
    return cachedRuntime
  }

  if (hasCapacitor) {
    cachedRuntime = 'capacitor'
    return cachedRuntime
  }

  cachedRuntime = 'web'
  return cachedRuntime
}

export function isRuntime(...flavors: RuntimeFlavor[]): boolean {
  const current = getRuntime()
  return flavors.includes(current)
}

export function resetRuntimeDetectionForTests() {
  cachedRuntime = null
}

export function isTauri(): boolean {
  return isRuntime('tauri-desktop', 'tauri-mobile')
}

export function isTestEnvironment(): boolean {
  if (typeof process !== 'undefined' && process.env?.VITEST) return true
  return getRuntime() === 'node-test'
}
