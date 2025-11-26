/**
 * Aggressive Frontend Version Management
 * 
 * Ensures the latest frontend is always served by:
 * 1. Getting unique hash injected into HTML at build time
 * 2. Storing frontend version hash on each load
 * 3. Comparing with expected version on app startup
 * 4. Force-clearing cache and reloading if outdated
 * 5. Providing version health checks
 */

import { APP_VERSION } from '../version'

// Unique hash for this build (set at build time by Vite plugin)
// STRATEGY 1: Will be HARDCODED by plugin - no runtime lookup needed
const BUILD_HASH = '__BUILD_HASH_PLACEHOLDER__'
const BUILD_TIMESTAMP = '__BUILD_TIMESTAMP_PLACEHOLDER__'

// Storage keys
const STORAGE_KEY_FRONTEND_HASH = '__razai_frontend_hash'
const STORAGE_KEY_LAST_UPDATE = '__razai_last_update'
const STORAGE_KEY_FORCE_RELOAD_COUNT = '__razai_force_reload_count'

/**
 * Get current frontend hash from page (index.html content hash)
 */
export function getCurrentFrontendHash(): string {
  return BUILD_HASH
}

/**
 * Get stored frontend hash from localStorage
 */
export function getStoredFrontendHash(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY_FRONTEND_HASH)
  } catch {
    return null
  }
}

/**
 * Store current frontend hash to localStorage
 */
export function storeCurrentFrontendHash(hash: string) {
  try {
    localStorage.setItem(STORAGE_KEY_FRONTEND_HASH, hash)
    localStorage.setItem(STORAGE_KEY_LAST_UPDATE, new Date().toISOString())
  } catch {
    // ignore
  }
}

/**
 * Check if frontend is outdated (stored hash != current hash)
 */
export function isFrontendOutdated(): boolean {
  const current = getCurrentFrontendHash()
  const stored = getStoredFrontendHash()

  if (current === '__BUILD_HASH_PLACEHOLDER__') {
    // Build time placeholder not replaced, skip check
    console.log('[version-mgmt] Build hash not injected, skipping version check')
    return false
  }

  if (!stored) {
    // First load, store and return
    console.log('[version-mgmt] First load, storing hash:', current)
    storeCurrentFrontendHash(current)
    return false
  }

  const isOutdated = stored !== current
  if (isOutdated) {
    console.warn('[version-mgmt] Frontend outdated! Stored:', stored, 'Current:', current)
  } else {
    console.log('[version-mgmt] Frontend is current:', current)
  }

  return isOutdated
}

/**
 * Get number of force reloads (to prevent infinite loops)
 */
export function getForceReloadCount(): number {
  try {
    const count = localStorage.getItem(STORAGE_KEY_FORCE_RELOAD_COUNT)
    return count ? parseInt(count, 10) : 0
  } catch {
    return 0
  }
}

/**
 * Increment force reload counter
 */
export function incrementForceReloadCount() {
  try {
    const count = getForceReloadCount()
    localStorage.setItem(STORAGE_KEY_FORCE_RELOAD_COUNT, String(count + 1))
  } catch {
    // ignore
  }
}

/**
 * Reset force reload counter (call after successful load)
 */
export function resetForceReloadCount() {
  try {
    localStorage.setItem(STORAGE_KEY_FORCE_RELOAD_COUNT, '0')
  } catch {
    // ignore
  }
}

/**
 * Clear all caches AGGRESSIVELY (Service Worker, HTTP, IndexedDB, LocalStorage assets)
 * This is the most aggressive cache clearing possible
 */
export async function clearAllCaches() {
  try {
    console.log('[version-mgmt] AGGRESSIVE cache clearing started...')

    // 1. Clear Service Worker caches (most important)
    if ('caches' in window) {
      try {
        const cacheNames = await caches.keys()
        console.log('[version-mgmt] Found SW caches:', cacheNames)
        await Promise.all(cacheNames.map(name => {
          console.log('[version-mgmt] Deleting cache:', name)
          return caches.delete(name)
        }))
        console.log('[version-mgmt] All SW caches cleared')
      } catch (err) {
        console.error('[version-mgmt] Error clearing SW caches:', err)
      }
    }

    // 2. Unregister ALL Service Workers
    if ('serviceWorker' in navigator) {
      try {
        const registrations = await navigator.serviceWorker.getRegistrations()
        console.log('[version-mgmt] Found SW registrations:', registrations.length)
        await Promise.all(registrations.map(reg => {
          console.log('[version-mgmt] Unregistering SW:', reg.scope)
          return reg.unregister()
        }))
        console.log('[version-mgmt] All Service Workers unregistered')
      } catch (err) {
        console.error('[version-mgmt] Error unregistering SWs:', err)
      }
    }

    // 3. Clear IndexedDB
    try {
      const dbNames = await window.indexedDB.databases()
      dbNames.forEach(db => {
        if (db.name) {
          console.log('[version-mgmt] Deleting IndexedDB:', db.name)
          window.indexedDB.deleteDatabase(db.name)
        }
      })
      console.log('[version-mgmt] IndexedDB cleared')
    } catch (err) {
      console.error('[version-mgmt] Error clearing IndexedDB:', err)
    }

    // 4. Clear sessionStorage
    try {
      sessionStorage.clear()
      console.log('[version-mgmt] sessionStorage cleared')
    } catch (err) {
      // ignore
    }

    console.log('[version-mgmt] Cache clearing complete')

  } catch (err) {
    console.error('[version-mgmt] Error clearing caches:', err)
  }
}

/**
 * Force reload if frontend is outdated
 * Clears all caches and reloads to ensure fresh content
 */
export async function forceReloadIfOutdated() {
  if (!isFrontendOutdated()) {
    // Frontend is current, mark as loaded successfully
    storeCurrentFrontendHash(getCurrentFrontendHash())
    resetForceReloadCount()
    console.log('[version-mgmt] Frontend is current, no reload needed')
    return
  }

  const reloadCount = getForceReloadCount()

  if (reloadCount > 3) {
    console.error('[version-mgmt] Too many force reloads (count:', reloadCount, '), giving up to prevent infinite loop')
    // Store current version anyway to prevent further reloads
    storeCurrentFrontendHash(getCurrentFrontendHash())
    resetForceReloadCount()
    return
  }

  console.warn(
    `[version-mgmt] FORCING RELOAD! Stored: ${getStoredFrontendHash()}, Current: ${getCurrentFrontendHash()}. Attempt ${reloadCount + 1}/3`
  )

  incrementForceReloadCount()

  try {
    await clearAllCaches()
  } catch (err) {
    console.error('[version-mgmt] Error clearing caches before reload:', err)
  }

  // Wait for cache cleanup to complete, then reload
  console.log('[version-mgmt] Waiting 1s before reload...')
  await new Promise(resolve => setTimeout(resolve, 1000))
  
  console.log('[version-mgmt] Now reloading page...')
  try {
    // Hard reload to bypass any remaining cache
    // Hard reload (better than self-assignment which tripped lint rule)
    window.location.reload()
  } catch (err) {
    console.error('[version-mgmt] Error during reload:', err)
  }
}

/**
 * Get version health status for debugging
 */
export function getVersionHealthStatus(): {
  appVersion: string
  frontendHash: string
  storedHash: string | null
  isOutdated: boolean
  forceReloadCount: number
  buildTimestamp: string
} {
  return {
    appVersion: APP_VERSION,
    frontendHash: getCurrentFrontendHash(),
    storedHash: getStoredFrontendHash(),
    isOutdated: isFrontendOutdated(),
    forceReloadCount: getForceReloadCount(),
    buildTimestamp: BUILD_TIMESTAMP
  }
}

/**
 * Log version health information
 */
export function logVersionHealth() {
  const health = getVersionHealthStatus()
  console.table(health)
}

/**
 * Initialize version management system
 * Call this early in app startup, BEFORE React renders
 */
export async function initVersionManagement() {
  console.log('[version-mgmt] ===== INIT START =====')
  logVersionHealth()

  // Check if frontend is outdated and force reload if necessary
  await forceReloadIfOutdated()
  
  console.log('[version-mgmt] ===== INIT COMPLETE =====')
}
