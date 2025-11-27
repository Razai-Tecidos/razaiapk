/**
 * Vite plugin to inject version hashes at build time
 * Ensures every build gets a unique cache-busting hash
 */

import crypto from 'crypto'
import type { Plugin } from 'vite'

// Store the hash globally so all transforms use the same hash
let globalBuildHash = ''
let globalBuildTimestamp = ''
let isDevServer = false

export function vitePluginVersionInject(): Plugin {
  return {
    name: 'vite-plugin-version-inject',
    enforce: 'pre',
    
    configResolved(config) {
      isDevServer = config.command === 'serve'
      if (isDevServer) {
        globalBuildHash = ''
        globalBuildTimestamp = ''
        return
      }
      // Generate hash once at config time
      globalBuildHash = crypto
        .createHash('sha256')
        .update(new Date().toISOString() + Math.random())
        .digest('hex')
        .substring(0, 16)
      
      globalBuildTimestamp = new Date().toISOString()
      
      // console.log(`[version-inject] ✓ Generated build hash: ${globalBuildHash}`)
      // console.log(`[version-inject] ✓ Generated timestamp: ${globalBuildTimestamp}`)
    },

    // Inject into HTML - this is the most reliable method
    transformIndexHtml: {
      order: 'post', // Changed to 'post' so it runs AFTER Vite injects script tags
      handler(html) {
        if (isDevServer) return html
        // Add script that sets window.__RAZAI_BUILD_HASH__ before any other script runs
        const hashScript = `<script>
window.__RAZAI_BUILD_HASH__ = '${globalBuildHash}';
window.__RAZAI_BUILD_TIMESTAMP__ = '${globalBuildTimestamp}';
// console.log('[version-inject] ✓✓✓ CACHE BUSTER - Hash set in window:', window.__RAZAI_BUILD_HASH__);
</script>`
        
        // Add cache-buster query param to script src attributes to force fresh load
        // This prevents Tauri/WebView2 from serving cached versions
        let modifiedHtml = html.replace(/<script([^>]*)src="([^"]+)"([^>]*)>/g, 
          (match, before, src, after) => `<script${before}src="${src}?v=${globalBuildHash}"${after}>`)
        
        // Also add to link tags (CSS) - but not manifest
        modifiedHtml = modifiedHtml.replace(/<link([^>]*)href="([^"]+)"([^>]*)>/g, 
          (match, before, href, after) => {
            // Skip manifest links
            if (match.includes('manifest')) return match
            return `<link${before}href="${href}?v=${globalBuildHash}"${after}>`
          })
        
        // Inject right after <head> tag
        modifiedHtml = modifiedHtml.replace('<head>', `<head>\n${hashScript}`)
        
        // console.log(`[version-inject] ✓ Injected cache-buster query params (v=${globalBuildHash})`)
        // console.log(`[version-inject] ✓✓✓ BUILD HASH: ${globalBuildHash}`)
        
        return modifiedHtml
      }
    },

    // STRATEGY 1: HARDCODE hash directly into version-mgmt.ts
    // Most reliable for Tauri - hash is baked into the bundle, not runtime lookup
    transform(code, id) {
      if (isDevServer) return
      if (!id.includes('version-mgmt.ts')) {
        return
      }

      let transformed = code
        .replace(/const BUILD_HASH = '[^']*'/, `const BUILD_HASH = '${globalBuildHash}'`)
        .replace(/const BUILD_TIMESTAMP = '[^']*'/, `const BUILD_TIMESTAMP = '${globalBuildTimestamp}'`)

      // console.log(`[version-inject] ✓✓✓ HARDCODED BUILD_HASH: ${globalBuildHash}`)
      // console.log(`[version-inject] ✓✓✓ Hash BAKED into JavaScript bundle`)

      return {
        code: transformed,
        map: null
      }
    }
  }
}
