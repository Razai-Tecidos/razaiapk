// import.worker.ts - Web Worker for verifying & importing a backup JSON
// Protocol:
// Incoming: { type: 'import', json: string }
// Response success: { type: 'result', ok: true, inserted }
// Response failure: { type: 'result', ok: false, error: string }

import { importFullBackupExact } from '@/lib/import'
import { verifyFullExportIntegrity } from '@/lib/export'
import { startTimer } from '@/lib/instrumentation'

self.onmessage = async (ev: MessageEvent) => {
  const msg = ev.data
  if (!msg || msg.type !== 'import' || typeof msg.json !== 'string') return
  try {
    const end = startTimer('worker.backup.import')
    let parsed: any
    try { parsed = JSON.parse(msg.json) } catch { throw new Error('json inválido') }
    const version = parsed.version || 0
    if (version >= 4) {
      const integrity = await verifyFullExportIntegrity(parsed)
      if (!integrity.valid) throw new Error(integrity.reason || 'integridade inválida')
    }
    const res = await importFullBackupExact(msg.json)
    const ms = end({ size: msg.json.length })
    ;(self as any).postMessage({ type: 'result', ok: true, inserted: res.inserted, ms })
  } catch (e: any) {
    ;(self as any).postMessage({ type: 'result', ok: false, error: e?.message || String(e) })
  }
}
