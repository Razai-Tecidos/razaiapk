import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock buildFullBackupJson to avoid heavy DB dependency
vi.mock('../lib/backup', () => ({
  buildFullBackupJson: async () => '{"mock":"backup"}'
}))

// Ensure localStorage available
const memStore: Record<string,string> = {}
vi.stubGlobal('localStorage', {
  getItem: (k: string) => memStore[k] ?? null,
  setItem: (k: string, v: string) => { memStore[k] = v },
  removeItem: (k: string) => { delete memStore[k] }
})

// Provide env vars via import.meta.env shim
vi.stubGlobal('import', { meta: { env: { VITE_SUPABASE_URL: 'https://example.supabase.co', VITE_SUPABASE_ANON_KEY: 'anon-key' } } })

import { uploadNewBackup, saveConfig } from '../lib/cloud-sync'

describe('cloud-sync uploadNewBackup', () => {
  beforeEach(() => {
    memStore['cloud-sync-config'] = JSON.stringify({ url: 'https://example.supabase.co', anonKey: 'anon-key', bucket: 'backups', uploadToken: '', auto: false })
  })

  it('uploads backup to storage when no edge token', async () => {
    const fetchSpy = vi.fn()
    // First call succeeds, second (snapshot) fails silently
    fetchSpy.mockResolvedValueOnce({ ok: true, status: 200, statusText: 'OK', text: async () => '' })
    fetchSpy.mockResolvedValueOnce({ ok: false, status: 403, statusText: 'Forbidden', text: async () => 'Forbidden' })
    ;(globalThis as any).fetch = fetchSpy

    const res = await uploadNewBackup()
    expect(res.ok).toBe(true)
    expect(fetchSpy).toHaveBeenCalled()
    const firstCallArgs = fetchSpy.mock.calls[0]
    // Sem edge token devemos usar caminho de storage
    expect(firstCallArgs[0]).toContain('/storage/v1/object/backups/latest.json')
    const opts = firstCallArgs[1]
    expect(opts.method).toBe('POST')
    expect(opts.headers['x-upsert']).toBe('true')
  })

  it('returns detailed error when first upload fails', async () => {
    const fetchSpy = vi.fn()
    fetchSpy.mockResolvedValueOnce({ ok: false, status: 401, statusText: 'Unauthorized', text: async () => 'Not allowed' })
    ;(globalThis as any).fetch = fetchSpy
    const res = await uploadNewBackup()
    expect(res.ok).toBe(false)
    expect(res.reason).toMatch(/401/) // includes status code
    expect(res.reason).toMatch(/Not allowed|Unauthorized/)
  })

  it('maps bucket not found to friendly message (storage path)', async () => {
    const fetchSpy = vi.fn()
    fetchSpy.mockResolvedValueOnce({ ok: false, status: 400, statusText: 'Bad Request', text: async () => '{"statusCode":"404","error":"Bucket not found","message":"Bucket not found"}' })
    ;(globalThis as any).fetch = fetchSpy
    memStore['cloud-sync-config'] = JSON.stringify({ url: 'https://example.supabase.co', anonKey: 'anon-key', bucket: 'missing', uploadToken: '', auto: false })
    const res = await uploadNewBackup()
    expect(res.ok).toBe(false)
    expect(res.reason).toMatch(/não existe/i)
  })

  it('uses edge function domain when uploadToken present', async () => {
    memStore['cloud-sync-config'] = JSON.stringify({ url: 'https://example.supabase.co', anonKey: 'anon-key', bucket: 'backups', uploadToken: 'edge-secret', auto: false })
    const fetchSpy = vi.fn()
    fetchSpy.mockResolvedValueOnce({ ok: true, status: 200, statusText: 'OK', json: async () => ({ ok: true, hash: 'abc123' }), text: async () => '' })
    ;(globalThis as any).fetch = fetchSpy
    const res = await uploadNewBackup()
    expect(res.ok).toBe(true)
    expect(fetchSpy.mock.calls[0][0]).toContain('https://example.functions.supabase.co/upload_backup')
  })
})
