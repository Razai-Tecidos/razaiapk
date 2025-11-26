import { describe, it, expect, vi, beforeEach } from 'vitest'
import { 
  uploadNewBackup, 
  listBackups, 
  restoreBackup, 
  saveConfig, 
  getConfig,
  ensureDefaultCloudConfig
} from '@/lib/cloud-sync'
import * as workers from '@/lib/workers'

// Mock dependencies
vi.mock('@/lib/workers', () => ({
  buildBackupInWorker: vi.fn(),
  importBackupInWorker: vi.fn()
}))

// Mock export integrity check to always pass
vi.mock('@/lib/export', () => ({
  __esModule: true,
  verifyFullExportIntegrity: vi.fn().mockResolvedValue({ valid: true }),
  validateFullExportObject: vi.fn().mockReturnValue([]),
  makeFullExport: vi.fn(),
  fullExportToJsonString: vi.fn(),
  fullExportToJsonBlob: vi.fn(),
}))




// Mock cloud-sync's verifyDownloadedBackup to bypass internal checks if needed
// Since we are testing cloud-sync, we want to test its logic, but if verifyDownloadedBackup
// is causing issues due to complex dependencies, we can mock it partially.
// However, verifyDownloadedBackup is defined in the same file we are testing, so we can't mock it easily
// unless we extract it or use a spy on the module export (which is tricky for internal calls).
// The best way is to ensure verifyFullExportIntegrity mock works.

// Mock fetch globally
const fetchMock = vi.fn()
global.fetch = fetchMock

describe('Cloud Sync', () => {
  const mockConfig = {
    url: 'https://test.supabase.co',
    anonKey: 'test-key',
    bucket: 'backups',
    auto: true
  }

  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
    saveConfig(mockConfig)
    
    // Default worker mocks
    vi.mocked(workers.buildBackupInWorker).mockResolvedValue(JSON.stringify({
      schema: 'razai-tools.full-export',
      version: 4,
      integrity: { hashHex: 'abc' },
      tissues: [],
      colors: []
    }))
    
    vi.mocked(workers.importBackupInWorker).mockResolvedValue({
      ok: true,
      inserted: { tissues: 0, colors: 0, patterns: 0, links: 0, patternLinks: 0 }
    })
  })


  describe('Configuration', () => {
    it('should save and retrieve config', () => {
      const cfg = { url: 'u', anonKey: 'k', bucket: 'b', auto: false }
      saveConfig(cfg)
      expect(getConfig()).toEqual(cfg)
    })

    it('should ensure default config from overrides', () => {
      localStorage.clear()
      const res = ensureDefaultCloudConfig({ url: 'u2', anonKey: 'k2' })
      expect(res.created).toBe(true)
      expect(getConfig().url).toBe('u2')
    })
  })

  describe('Upload', () => {
    it('should upload backup successfully to storage', async () => {
      // Mock successful upload response
      fetchMock.mockResolvedValue({
        ok: true,
        text: () => Promise.resolve('ok'),
        status: 200
      })

      // Force uploadToken to be empty to test direct storage upload
      // (The default mockConfig doesn't have it, but env might leak if not careful)
      // We rely on saveConfig(mockConfig) in beforeEach which doesn't have uploadToken.
      // However, uploadNewBackup reads envSupabaseUploadToken() if config doesn't have it.
      // We need to mock import.meta.env or ensure it's empty.
      // Since we can't easily mock import.meta.env in vitest without setup, 
      // let's explicitly set uploadToken: '' in config.
      saveConfig({ ...mockConfig, uploadToken: '' })

      const result = await uploadNewBackup()
      
      expect(result.ok).toBe(true)
      expect(workers.buildBackupInWorker).toHaveBeenCalled()
      
      expect(fetchMock).toHaveBeenCalled()
      
      const [url, opts] = fetchMock.mock.calls[0]
      expect(url).toContain('/storage/v1/object/backups/latest.json')
      expect(opts.method).toBe('POST')
      expect(opts.headers['x-upsert']).toBe('true')

      // Verify history snapshot upload (best-effort)
      // Should be the second call if the first one succeeds
      if (fetchMock.mock.calls.length > 1) {
        const [snapUrl, snapOpts] = fetchMock.mock.calls[1]
        expect(snapUrl).toContain('/storage/v1/object/backups/full-')
        expect(snapUrl).toContain('-qty0.json') // mock returns empty tissues
        expect(snapOpts.method).toBe('POST')
      }
    })

    it('should handle upload failure', async () => {
      fetchMock.mockResolvedValue({
        ok: false,
        text: () => Promise.resolve('Permission denied'),
        status: 403,
        statusText: 'Forbidden'
      })

      const result = await uploadNewBackup()
      
      expect(result.ok).toBe(false)
      expect(result.reason).toContain('403')
    })
  })

  describe('List Backups', () => {
    it('should list backups correctly', async () => {
      const mockFiles = [
        { name: 'latest.json', updated_at: '2023-01-01T00:00:00Z' },
        { name: 'full-2023.json', updated_at: '2023-01-01T00:00:00Z' },
        { name: 'other.txt', updated_at: '2023-01-01T00:00:00Z' } // Should be filtered out
      ]

      fetchMock.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockFiles),
        text: () => Promise.resolve('')
      })

      const files = await listBackups()
      
      expect(files.length).toBe(2)
      expect(files.map(f => f.name)).toContain('latest.json')
      expect(files.map(f => f.name)).toContain('full-2023.json')
      
      // Verify prefix param was sent (fix from previous session)
      const [, opts] = fetchMock.mock.calls[0]
      const body = JSON.parse(opts.body)
      expect(body.prefix).toBe('')
    })

    it('should fallback to HEAD check if list returns empty', async () => {
      // First call (list) returns empty array
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve([]),
        text: () => Promise.resolve('')
      })
      
      // Second call (HEAD latest.json) returns OK
      fetchMock.mockResolvedValueOnce({
        ok: true,
        headers: {
          get: (k: string) => k === 'Content-Length' ? '123' : '2023-01-01'
        }
      })

      const files = await listBackups()
      
      expect(files.length).toBe(1)
      expect(files[0].name).toBe('latest.json')
      expect(files[0].metadata.size).toBe(123)
    })
  })

  describe('Restore', () => {
    it('should download and restore backup', async () => {
      const mockJson = JSON.stringify({
        schema: 'razai-tools.full-export',
        version: 4,
        integrity: { hashHex: 'abc' }, // Mock integrity check pass
        tissues: []
      })

      fetchMock.mockResolvedValue({
        ok: true,
        text: () => Promise.resolve(mockJson)
      })

      const result = await restoreBackup('latest.json')
      
      if (!result.ok) console.log('Restore failed:', result.reason)
      expect(result.ok).toBe(true)
      expect(workers.importBackupInWorker).toHaveBeenCalledWith(mockJson)
    })

    it('should fail if download fails', async () => {
      fetchMock.mockResolvedValue({
        ok: false,
        status: 404
      })

      const result = await restoreBackup('missing.json')
      
      expect(result.ok).toBe(false)
      expect(result.reason).toBe('Download failed')
    })
  })


})
