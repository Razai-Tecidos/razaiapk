import { defineConfig } from 'vite'
import type { Plugin, PluginOption, ViteDevServer } from 'vite'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
const __dirname = path.dirname(fileURLToPath(import.meta.url))
import fs from 'node:fs'
import fsp from 'node:fs/promises'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import { vitePluginVersionInject } from './vite-plugin-version-inject'

const isTauriBuild = Boolean(
  process.env.TAURI_ENV_PLATFORM ||
  process.env.TAURI_ENV ||
  process.env.TAURI_PLATFORM ||
  process.env.TAURI_BUILD
)
const disablePwa = process.env.DISABLE_PWA === '1'

// Dev-only sync endpoint plugin
const devSyncPlugin: Plugin = {
  name: 'dev-sync-endpoint',
  configureServer(server: ViteDevServer) {
    const tmpDir = path.resolve(__dirname, '.tmp')
    const lastPath = path.join(tmpDir, 'last-backup.json')
    if (!fs.existsSync(tmpDir)) {
      try { fs.mkdirSync(tmpDir, { recursive: true }) } catch {}
    }
    server.middlewares.use('/api/import', async (req: any, res: any, next: any) => {
      if (req.method === 'POST') {
        try {
          const chunks: Buffer[] = []
          await new Promise<void>((resolve, reject) => {
            req.on('data', (c: Buffer) => chunks.push(c))
            req.on('end', () => resolve())
            req.on('error', (e: any) => reject(e))
          })
          const buf = Buffer.concat(chunks)
          // Validate minimal schema to avoid writing garbage
          try {
            const obj = JSON.parse(buf.toString('utf8'))
            if (!obj || obj.schema !== 'razai-tools.full-export') {
              res.statusCode = 400
              res.end('invalid payload')
              return
            }
          } catch {
            res.statusCode = 400
            res.end('invalid json')
            return
          }
          await fsp.writeFile(lastPath, buf)
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify({ ok: true }))
          return
        } catch (e: any) {
          res.statusCode = 500
          res.end(String(e?.message || e))
          return
        }
      }
      if (req.method === 'GET') {
        // serve last backup
        try {
          const data = await fsp.readFile(lastPath)
          res.setHeader('Content-Type', 'application/json')
          res.end(data)
          // one-shot: remove after serving so it won't import repeatedly
          try { await fsp.unlink(lastPath) } catch {}
          return
        } catch {
          res.statusCode = 404
          res.end('not found')
          return
        }
      }
      next()
    })
  }
}

const plugins: PluginOption[] = [
  react(),
  devSyncPlugin,
  vitePluginVersionInject()
]

if (!isTauriBuild && !disablePwa) {
  const pwaPlugin = VitePWA({
      registerType: 'autoUpdate',
      workbox: {
        // AGGRESSIVE CACHE INVALIDATION
        clientsClaim: true,
        skipWaiting: true,
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [/^\/api\//],
        // Cache everything but expire quickly to force fresh content
        runtimeCaching: [
          {
            urlPattern: /\.(js|css|woff2)$/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'razai-tools-assets',
              expiration: {
                maxEntries: 100,
                maxAgeSeconds: 86400 // 24 hours for static assets
              }
            }
          },
          {
            urlPattern: /^https?:\/\//,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'razai-tools-network',
              networkTimeoutSeconds: 3,
              expiration: {
                maxEntries: 50,
                maxAgeSeconds: 1800 // 30 minutes for other content
              }
            }
          }
        ],
        // Force service worker to skip waiting and take control immediately
        cleanupOutdatedCaches: true
      },
      includeAssets: ['favicon.svg', 'favicon.ico', 'robots.txt', 'apple-touch-icon.png'],
      manifest: {
        name: 'Razai Tools',
        short_name: 'Razai Tools',
        description: 'Painel de ferramentas internas Razai',
        theme_color: '#0ea5e9',
        background_color: '#0b1324',
        display: 'standalone',
        start_url: '/',
        icons: [
          {
            src: 'pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png'
          }
        ]
      }
    })
  if (Array.isArray(pwaPlugin)) {
    plugins.push(...pwaPlugin)
  } else {
    plugins.push(pwaPlugin)
  }
} else {
  if (disablePwa) {
    console.log('[vite] PWA plugin disabled via DISABLE_PWA=1 environment override')
  } else if (isTauriBuild) {
    console.log('[vite] PWA plugin disabled for Tauri build to avoid stale cache bundling')
  }
}

export default defineConfig({
  plugins,
  resolve: {
    dedupe: ['react', 'react-dom'],
    alias: {
      '@': path.resolve(__dirname, './src'),
      // Force single React instance to avoid "Invalid hook call" errors
      'react': path.resolve(__dirname, './node_modules/react'),
      'react-dom': path.resolve(__dirname, './node_modules/react-dom'),
      'react/jsx-runtime': path.resolve(__dirname, './node_modules/react/jsx-runtime'),
      'react/jsx-dev-runtime': path.resolve(__dirname, './node_modules/react/jsx-dev-runtime')
    }
  },
  // Allow dynamic port override and fallback if the chosen port is busy.
  // Use PORT env var if provided, else default to 5173. With strictPort=false Vite will
  // choose the next available port automatically, avoiding hard failures that looked like "não está funcionando".
  server: {
    port: parseInt(process.env.PORT || '5173'),
    // When PORT is explicitly provided (e.g., by Tauri beforeDevCommand), enforce that exact port.
    // Otherwise, allow fallback to a free port during plain web dev.
    strictPort: !!process.env.PORT,
    host: true // allow network access / 127.0.0.1 and LAN
  },
  build: {
    outDir: 'dist',
    rollupOptions: {
      output: {
        format: 'es'
      }
    }
  }
  ,
  worker: {
    // Force ES module output to avoid iife format incompatibility with code-splitting
    format: 'es',
    rollupOptions: {
      output: {
        format: 'es'
      }
    }
  }
})
