// workers/index.ts - Utility wrappers for backup/import workers with graceful fallback
import { record } from '@/lib/instrumentation'
// Static imports to avoid dynamic-import code splitting that broke PWA worker build (rollup tried iife with code-splitting)
// These are only used in fallback (non-worker) paths, but keeping them static ensures a single chunk output.
import { buildFullBackupJson } from '@/lib/backup'
import { importFullBackupExact } from '@/lib/import'

let _backupWorker: Worker | null = null
function getBackupWorker(): Worker | null {
  if (typeof Worker === 'undefined') return null
  try {
    if (!_backupWorker) {
      _backupWorker = new Worker(new URL('./backup.worker.ts', import.meta.url), { type: 'module' })
      _backupWorker.onmessage = () => { /* no-op central handler */ }
    }
    return _backupWorker
  } catch { return null }
}

export async function buildBackupInWorker(): Promise<string> {
  const w = getBackupWorker()
  if (!w) {
    const json = await buildFullBackupJson()
    record('worker.backup.build.done', { ms: undefined, size: json.length, fallback: true })
    return json
  }
  return new Promise<string>((resolve, reject) => {
    const handle = (ev: MessageEvent) => {
      const data = ev.data
      if (!data || data.type !== 'result') return
      w.removeEventListener('message', handle)
      if (data.ok) {
        if (typeof data.ms === 'number') record('worker.backup.build.done', { ms: data.ms, size: data.json.length })
        resolve(data.json)
      } else {
        reject(new Error(data.error || 'worker error'))
      }
    }
    w.addEventListener('message', handle)
    w.postMessage({ type: 'build' })
  })
}

let _importWorker: Worker | null = null
function getImportWorker(): Worker | null {
  if (typeof Worker === 'undefined') return null
  try {
    if (!_importWorker) {
      _importWorker = new Worker(new URL('./import.worker.ts', import.meta.url), { type: 'module' })
      _importWorker.onmessage = () => { /* no-op */ }
    }
    return _importWorker
  } catch { return null }
}

export async function importBackupInWorker(json: string): Promise<{ ok: boolean; inserted?: any; error?: string }> {
  const w = getImportWorker()
  if (!w) {
    try {
      const res = await importFullBackupExact(json)
      record('worker.backup.import.done', { size: json.length, fallback: true })
      return { ok: true, inserted: res.inserted }
    } catch (e: any) {
      return { ok: false, error: e?.message || String(e) }
    }
  }
  return new Promise(resolve => {
    const handle = (ev: MessageEvent) => {
      const data = ev.data
      if (!data || data.type !== 'result') return
      w.removeEventListener('message', handle)
      if (data.ok) {
        if (typeof data.ms === 'number') record('worker.backup.import.done', { ms: data.ms, size: json.length })
        resolve(data)
      } else {
        resolve(data) // { ok:false, error }
      }
    }
    w.addEventListener('message', handle)
    w.postMessage({ type: 'import', json })
  })
}
