import { describe, it, expect, vi, beforeEach } from 'vitest'

// Ensure localStorage available for config usage
const memStore: Record<string,string> = {}
vi.stubGlobal('localStorage', {
  getItem: (k: string) => memStore[k] ?? null,
  setItem: (k: string, v: string) => { memStore[k] = v },
  removeItem: (k: string) => { delete memStore[k] }
})

// Provide env vars via import.meta.env shim
vi.stubGlobal('import', { meta: { env: { VITE_SUPABASE_URL: 'https://example.supabase.co', VITE_SUPABASE_ANON_KEY: 'anon-key' } } })

import { uploadNewBackup, saveConfig } from '../lib/cloud-sync'

// Mock buildFullBackupJson to avoid heavy DB dependency
vi.mock('../lib/backup', () => ({
  buildFullBackupJson: async () => '{"mock":"backup","integrity":{"hashHex":"deadbeef"}}'
}))

describe('buildFunctionUrl integration via uploadNewBackup', () => {
  beforeEach(() => {
    memStore['cloud-sync-config'] = JSON.stringify({ url: 'https://example.supabase.co', anonKey: 'anon-key', bucket: 'backups', uploadToken: 'tok', auto: false })
  })

  it('uses functions subdomain for standard supabase URL', async () => {
    const fetchSpy = vi.fn().mockResolvedValueOnce({ ok: true, status: 200, statusText: 'OK', text: async () => '', json: async () => ({ ok: true }) })
    ;(globalThis as any).fetch = fetchSpy
    const res = await uploadNewBackup()
    expect(res.ok).toBe(true)
    const calledUrl: string = fetchSpy.mock.calls[0][0]
    expect(calledUrl.startsWith('https://example.functions.supabase.co/upload_backup')).toBe(true)
  })

  it('falls back to /functions/v1 path for non-supabase domain', async () => {
    memStore['cloud-sync-config'] = JSON.stringify({ url: 'https://custom.domain.com', anonKey: 'anon-key', bucket: 'backups', uploadToken: 'tok', auto: false })
    const fetchSpy = vi.fn().mockResolvedValueOnce({ ok: true, status: 200, statusText: 'OK', text: async () => '', json: async () => ({ ok: true }) })
    ;(globalThis as any).fetch = fetchSpy
    const res = await uploadNewBackup()
    expect(res.ok).toBe(true)
    const calledUrl: string = fetchSpy.mock.calls[0][0]
    expect(calledUrl).toBe('https://custom.domain.com/functions/v1/upload_backup')
  })
})
