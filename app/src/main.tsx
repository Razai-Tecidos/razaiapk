import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter, Routes, Route, Outlet } from 'react-router-dom'
import { MantineProvider } from '@mantine/core'
import { Global } from '@emotion/react'
import { Notifications } from '@mantine/notifications'
import '@mantine/core/styles.css'
import '@mantine/notifications/styles.css'
import './design-system/animations.css'
import App from './App'
import PublicLayout from './layouts/PublicLayout'
// Eager pages (frequent): Home, Tissues, Colors
import Home from './pages/Home'
import Tissues from './pages/Tissues'
import Colors from './pages/Colors'
import ColorFamilies from './pages/ColorFamilies'
import Patterns from './pages/Patterns'
// Vitrine pages (Eager to prevent production hook errors)
import ShowcaseHome from './pages/vitrine/ShowcaseHome'
import ShowcaseTissueDetails from './pages/vitrine/ShowcaseTissueDetails'
import ShowcaseLinkDetails from './pages/vitrine/ShowcaseLinkDetails'
import Login from './pages/Login'
import ProtectedRoute from './components/ProtectedRoute'
import { AuthProvider } from './context/AuthContext'

import CollaboratorLayout from './layouts/CollaboratorLayout'

// MONKEY PATCH: Fix for "Failed to execute 'removeChild' on 'Node'"
// This error often happens when Google Translate or other extensions modify the DOM
// causing React to lose track of nodes. We patch removeChild to ignore this specific error.
if (typeof Node === 'function' && Node.prototype) {
  const originalRemoveChild = Node.prototype.removeChild
  Node.prototype.removeChild = function(child) {
    if (child.parentNode !== this) {
      if (console) console.error('Cannot remove a child from a different parent', child, this)
      return child
    }
    return originalRemoveChild.call(this, child) as any
  }

  const originalInsertBefore = Node.prototype.insertBefore
  Node.prototype.insertBefore = function(newNode, referenceNode) {
    if (referenceNode && referenceNode.parentNode !== this) {
      if (console) console.error('Cannot insert before a reference node from a different parent', referenceNode, this)
      return newNode
    }
    return originalInsertBefore.call(this, newNode, referenceNode) as any
  }
}

import Settings from './pages/Settings'
import CatalogPage from './pages/Catalog'
import TecidoCorPage from './pages/TecidoCor'
import StockPage from './pages/Stock'
import Exportacoes from './pages/Exportacoes'
import TecidoEstampaPage from './pages/TecidoEstampa'
import RecolorPreviewPage from './pages/RecolorPreview'
import MigrationPage from './pages/Migration'
import CutterModePage from './pages/CutterMode'
import MobileStockPage from './pages/MobileStock'

import { importFullBackup } from '@/lib/import'
import { buildFullBackupJson } from '@/lib/backup'
import { bootstrapCloudImport, autoImportIfNeeded, ensureDefaultCloudConfig, uploadNewBackup } from '@/lib/cloud-sync'
import AppErrorBoundary from '@/components/AppErrorBoundary'
import { isTauri, openExternal } from '@/lib/platform'

// App Router Component - created inside React tree so it has access to AuthContext
function AppRouter() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      
      <Route path="/vitrine" element={<PublicLayout />}>
        <Route index element={<ShowcaseHome />} />
        <Route path="tecido/:id" element={<ShowcaseTissueDetails />} />
        <Route path="link/:id" element={<ShowcaseLinkDetails />} />
      </Route>
      
      <Route path="/mobile" element={<ProtectedRoute allowedRoles={['collaborator', 'admin']} />}>
        <Route element={<CollaboratorLayout />}>
          <Route index element={<MobileStockPage />} />
        </Route>
      </Route>
      
      <Route path="/" element={<ProtectedRoute allowedRoles={['admin', 'collaborator']} />}>
        <Route element={<App />}>
          <Route element={<ProtectedRoute allowedRoles={['admin']} />}>
            <Route index element={<Home />} />
            <Route path="tecidos" element={<Tissues />} />
            <Route path="cores" element={<Colors />} />
            <Route path="estampas" element={<Patterns />} />
            <Route path="tecido-cor" element={<TecidoCorPage />} />
            <Route path="tecido-estampa" element={<TecidoEstampaPage />} />
            <Route path="catalogo" element={<CatalogPage />} />
            <Route path="exportacoes" element={<Exportacoes />} />
            <Route path="configuracoes" element={<Settings />} />
            <Route path="familias" element={<ColorFamilies />} />
            <Route path="recolor" element={<RecolorPreviewPage />} />
            <Route path="migration" element={<MigrationPage />} />
          </Route>
          <Route path="estoque" element={<StockPage />} />
        </Route>
      </Route>
    </Routes>
  )
}

const isRunningInTauri = isTauri()

// Dev helper: if the URL contains #sync=<url-encoded-json-url>, fetch and import backup automatically
async function maybeRunHashSyncImport() {
  try {
    const hash = window.location.hash || ''
    const m = hash.match(/^#sync=(.+)$/)
    if (!m) return
    const url = decodeURIComponent(m[1])
    const res = await fetch(url)
    if (!res.ok) return
    const text = await res.text()
    await importFullBackup(text, {
      createTissue: (input) => import('@/lib/db').then(m=>m.db.createTissue(input)),
      createColor: (input) => import('@/lib/db').then(m=>m.colorsDb.createColor(input)),
      createPattern: (input) => import('@/lib/db').then(m=>m.patternsDb.createPattern(input)),
    })
    // Basic visual cue using alert if Notifications not yet mounted
    try { alert('Sincronização concluída: backup importado no navegador.') } catch {}
    // clear hash to avoid re-imports
    try { history.replaceState(null, document.title, window.location.pathname + window.location.search) } catch {}
  } catch (e) {
    // ignore
  }
}

// Tauri close handler: Ask user to sync before closing
async function setupTauriCloseSync() {
  if (!isRunningInTauri) return
  try {
    const { getCurrentWindow } = await import('@tauri-apps/api/window')
    const { ask } = await import('@tauri-apps/plugin-dialog')
    const { notifications } = await import('@mantine/notifications')
    
    const appWindow = getCurrentWindow()
    let isExiting = false

    await appWindow.onCloseRequested(async (event: any) => {
      if (isExiting) return
      
      event.preventDefault()
      
      const answer = await ask('Deseja enviar os dados para a nuvem antes de sair?', {
        title: 'Sincronizar e Sair',
        kind: 'info',
        okLabel: 'Sim, enviar',
        cancelLabel: 'Não, apenas sair'
      })

      if (answer) {
        notifications.show({
          id: 'sync-close',
          title: 'Sincronizando...',
          message: 'Enviando backup para a nuvem. Aguarde.',
          loading: true,
          autoClose: false,
          withCloseButton: false
        })
        
        try {
          const res = await uploadNewBackup()
          if (res.ok) {
            notifications.update({
              id: 'sync-close',
              title: 'Sucesso',
              message: 'Dados enviados. Fechando...',
              color: 'green',
              loading: false
            })
            // Give user a moment to see success
            await new Promise(r => setTimeout(r, 1000))
          } else {
            notifications.update({
              id: 'sync-close',
              title: 'Erro no envio',
              message: `Falha: ${res.reason}. Fechando...`,
              color: 'red',
              loading: false
            })
            await new Promise(r => setTimeout(r, 2000))
          }
        } catch (e) {
           console.error(e)
        }
      }
      
      isExiting = true
      await appWindow.close()
    })
  } catch (e) {
    console.error('Failed to setup close handler', e)
  }
}

// Kick off legacy hash-based sync before rendering UI (non-blocking)
maybeRunHashSyncImport()
// Dev one-shot import if a payload was posted by Tauri
async function maybeRunDevImport() {
  try {
    // Avoid noisy 404: probe with HEAD first
    const head = await fetch('/api/import', { method: 'HEAD' })
    if (!head.ok) return
    const res = await fetch('/api/import', { method: 'GET' })
    if (!res.ok) return
    const text = await res.text()
    await importFullBackup(text, {
      createTissue: (input) => import('@/lib/db').then(m=>m.db.createTissue(input)),
      createColor: (input) => import('@/lib/db').then(m=>m.colorsDb.createColor(input)),
      createPattern: (input) => import('@/lib/db').then(m=>m.patternsDb.createPattern(input)),
    })
    try { alert('Sincronização (dev) concluída: backup do Tauri importado no navegador.') } catch {}
  } catch {}
}
maybeRunDevImport()
setupTauriCloseSync()

// CLOUD AUTO-SYNC (non-blocking):
// 0. Seed default cloud config from ENV on first run (if user never saved manual config)
// 1. If local DB empty => attempt immediate cloud import
// 2. Else, check manifest timestamp for newer backup
try { ensureDefaultCloudConfig() } catch {}
;(async () => {
  try {
    const first = await bootstrapCloudImport()
    if (!first.performed) {
      const second = await autoImportIfNeeded()
      if (second.performed) {
        console.log('[cloud-sync] Auto import executed (newer backup).')
      } else {
        console.log('[cloud-sync] No auto import performed:', second.reason)
      }
    } else {
      console.log('[cloud-sync] Bootstrap import executed.')
    }
  } catch (e: any) {
    console.log('[cloud-sync] Auto import error:', e?.message || String(e))
  }
})()

import { DS } from '@/design-system/tokens'
import { APP_VERSION } from './version'
import { initVersionManagement, logVersionHealth } from '@/lib/version-mgmt'

// TAURI CACHE BYPASS: Clear WebView2 cache on startup
// This forces Tauri to reload fresh resources instead of using cached bundle
const unregisterTauriServiceWorkers = async () => {
  if (!isRunningInTauri || typeof navigator === 'undefined' || !('serviceWorker' in navigator)) {
    return
  }
  try {
    const regs = await navigator.serviceWorker.getRegistrations()
    if (regs.length) {
      await Promise.all(regs.map(reg => reg.unregister()))
      console.log('[startup] ✓ Service workers unregistered for Tauri runtime')
    }
  } catch (err) {
    console.log('[startup] Service worker unregister (non-critical):', (err as Error).message)
  }
}

const clearTauriCaches = async () => {
  if (!isRunningInTauri) return
  try {
    if (typeof window !== 'undefined' && 'caches' in window) {
      const cacheNames = await caches.keys()
      await Promise.all(cacheNames.map(name => caches.delete(name)))
      console.log('[startup] ✓ Tauri WebView2 caches cleared')
    }
  } catch (e) {
    console.log('[startup] Cache clear (non-critical):', (e as Error).message)
  }
}

// NUCLEAR OPTION: Hard refresh every time
// This is the ONLY way to bypass Tauri's embedded file caching
const forceHardRefresh = () => {
  if (!isRunningInTauri) return
  // Check if we've already done a hard refresh in this session
  const refreshMarker = sessionStorage.getItem('__RAZAI_HARD_REFRESH_DONE__')
  
  if (!refreshMarker) {
    console.log('[startup] ✓✓✓ FORCING HARD REFRESH - no cache allowed!')
    sessionStorage.setItem('__RAZAI_HARD_REFRESH_DONE__', 'true')
    
    // Add timestamp to bypass any caches
    const timestamp = new Date().getTime()
    const currentUrl = window.location.href
    const separator = currentUrl.includes('?') ? '&' : '?'
    const newUrl = `${currentUrl}${separator}t=${timestamp}`
    
    // Hard refresh bypasses browser and Tauri cache completely
    window.location.href = newUrl
  }
}

// AGGRESSIVE VERSION MANAGEMENT: Runs BEFORE React renders
// This ensures outdated frontend is detected and reloaded immediately
console.log('[startup] Initializing aggressive version management...')

// Block React rendering until version management check completes
;(async () => {
  if (isRunningInTauri) {
    await unregisterTauriServiceWorkers()
    // Force hard refresh FIRST (most effective for Tauri)
    forceHardRefresh()

    // Then clear caches for next load
    await clearTauriCaches()
  }
  try {
    await initVersionManagement()
    console.log('[startup] Version management check complete, proceeding with React render')
  } catch (err) {
    console.error('[startup] Version management error:', err)
  }
  
  // Continue with rest of startup (must be inside IIFE to run after await)
  setupServiceWorkerUpdateListener()
  // DISABLED: This was causing reload loops in dev
  // setTimeout(ensureDesignSystemApplied, 800)
})()

// Move these outside the IIFE but keep them defined here
function setupServiceWorkerUpdateListener() {
  if (isRunningInTauri) return
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      console.log('[sw] Controller changed, new version available. Reloading in 2s...')
      logVersionHealth()
      setTimeout(() => window.location.reload(), 2000)
    })
  }
}

function ensureDesignSystemApplied() {
  try {
    const expectedHex = DS.color.bg.toLowerCase()
    const hex = expectedHex.replace('#','')
    const rgb = `rgb(${parseInt(hex.slice(0,2),16)}, ${parseInt(hex.slice(2,4),16)}, ${parseInt(hex.slice(4,6),16)})`
    const body = document.body
    const applied = getComputedStyle(body).backgroundColor.toLowerCase()
    const alreadyTried = localStorage.getItem('ds-self-heal-attempt') === APP_VERSION
    const matches = applied.includes(expectedHex) || applied === rgb
    if (!matches && !alreadyTried) {
      console.warn('[design-system] Background mismatch (expected', expectedHex, 'got', applied, '). Attempting cache clear & reload.')
      localStorage.setItem('ds-self-heal-attempt', APP_VERSION)
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.getRegistrations().then(regs => regs.forEach(r => r.unregister()))
      }
      if (window.caches) {
        caches.keys().then(keys => keys.forEach(k => caches.delete(k))).catch(()=>{})
      }
      setTimeout(() => { try { window.location.reload() } catch {} }, 300)
    }
  } catch (e) {
    // ignore
  }
}

// DEV MODE SAFETY: Unregister any service workers if running in dev mode
// This prevents stale SWs from production builds interfering with HMR
if (import.meta.env.DEV && 'serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations().then(regs => {
    if (regs.length > 0) {
      console.log('[dev] Unregistering service workers for development environment...')
      regs.forEach(r => r.unregister())
      // DISABLED: Don't reload - just unregister and continue
      // window.location.reload()
    }
  })
}

// Define ReactDOM render call AFTER version management setup
const renderApp = () => {
  ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
      <MantineProvider
        theme={{
          primaryColor: 'gray',
          fontFamily: DS.font.familySans,
          colors: {
            gray: [
              '#FAFAFA',
              '#F5F5F5',
              '#E5E5E5',
              '#D4D4D4',
              '#A3A3A3',
              '#737373',
              '#525252',
              '#404040',
              '#262626',
              '#171717'
            ]
          },
          headings: { fontFamily: DS.font.familySans, fontWeight: String(DS.font.weightBold) },
          defaultRadius: 'md'
        }}
        forceColorScheme="light"
      >
        <Global styles={() => ({
          '*,*::before,*::after': { boxSizing:'border-box' },
          'html,body,#root': { height:'100%', margin:0, padding:0, background: DS.color.bg, color: DS.color.textPrimary },
          body: { fontFamily: DS.font.familySans, fontSize: DS.font.size.base, lineHeight: DS.font.lineHeight.normal, WebkitFontSmoothing:'antialiased', MozOsxFontSmoothing:'grayscale' },
          a: { color: DS.color.textPrimary, textDecoration:'none', transition: 'color .2s ease' },
          'a:hover': { color: DS.color.accent },
          'a:focus-visible, button:focus-visible': { outline:`2px solid ${DS.color.focus}`, outlineOffset:2, borderRadius:4 },
          '::selection': { background: DS.color.accent, color: '#fff' },
          '.ds-container': { maxWidth:'1200px', margin:'0 auto', padding:'0 32px' }
        })} />
        <Notifications position="top-right" />
        <AppErrorBoundary>
          <BrowserRouter>
            <AuthProvider>
              <AppRouter />
            </AuthProvider>
          </BrowserRouter>
        </AppErrorBoundary>
      </MantineProvider>
    </React.StrictMode>
  )
}

// Call renderApp function
renderApp()

