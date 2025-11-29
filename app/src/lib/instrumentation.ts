// instrumentation.ts - lightweight in-memory performance/event metrics
// Usage:
//   const end = startTimer('backup.build'); ... end();
//   record('import.completed', { ms, inserted })
// Data kept in RAM + optional localStorage snapshot for devtools.

interface MetricEvent {
  ts: number
  name: string
  data?: Record<string, any>
}

const _events: MetricEvent[] = []
const _timers: Record<string, number> = {}

export function record(name: string, data?: Record<string, any>) {
  _events.push({ ts: Date.now(), name, data })
  if (_events.length > 500) _events.shift() // prevent unbounded growth
  try {
    // Persist a compact snapshot for debugging (omit large blobs)
    const compact = _events.slice(-50).map(e => ({ ts: e.ts, name: e.name, data: summarizeData(e.data) }))
    localStorage.setItem('__razai_metrics_snapshot', JSON.stringify(compact))
  } catch {}
}

function summarizeData(data?: Record<string, any>) {
  if (!data) return undefined
  const out: Record<string, any> = {}
  for (const [k, v] of Object.entries(data)) {
    if (typeof v === 'string' && v.length > 120) out[k] = v.slice(0, 117) + '…'
    else out[k] = v
  }
  return out
}

export function startTimer(label: string) {
  _timers[label] = performance.now()
  return function end(extra?: Record<string, any>) {
    const start = _timers[label]
    const ms = start != null ? Math.max(0, performance.now() - start) : 0
    delete _timers[label]
    record(label + '.end', { ms, ...(extra || {}) })
    return ms
  }
}

export function measureAsync(label: string, fn: () => Promise<any>) {
  const end = startTimer(label)
  return fn().then(res => { end(); return res }).catch(err => { end({ error: String(err) }); throw err })
}

export function getMetrics(): MetricEvent[] {
  return [..._events]
}

// Convenience wrappers for specific flows
export async function timedBackupBuild(buildFn: () => Promise<string>): Promise<{ json: string; ms: number }> {
  const end = startTimer('backup.build')
  const json = await buildFn()
  const ms = end({ size: json.length })
  record('backup.build.completed', { ms, size: json.length })
  return { json, ms }
}

export async function timedBackupImport(importFn: () => Promise<{ inserted: any }>, jsonSize: number): Promise<{ inserted: any; ms: number }> {
  const end = startTimer('backup.import')
  const res = await importFn()
  const ms = end({ size: jsonSize })
  record('backup.import.completed', { ms, size: jsonSize, inserted: res.inserted })
  return { inserted: res.inserted, ms }
}
