// backup.worker.ts - Web Worker for building full backup JSON without blocking UI
// Protocol:
// Incoming message: { type: 'build' }
// Success response: { type: 'result', ok: true, json: string }
// Error response: { type: 'result', ok: false, error: string }

import { buildFullBackupJson } from '@/lib/backup'
import { startTimer } from '@/lib/instrumentation'

self.onmessage = async (ev: MessageEvent) => {
  const msg = ev.data
  if (!msg || msg.type !== 'build') return
  try {
    const end = startTimer('worker.backup.build')
    const json = await buildFullBackupJson()
    const ms = end({ size: json.length })
    ;(self as any).postMessage({ type: 'result', ok: true, json, ms })
  } catch (e: any) {
    ;(self as any).postMessage({ type: 'result', ok: false, error: e?.message || String(e) })
  }
}
