import { describe, it, expect, vi, beforeEach } from 'vitest'
import { 
  uploadNewBackup, 
  restoreBackup, 
  saveConfig,
  getConfig
} from '@/lib/cloud-sync'
import { db, colorsDb } from '@/lib/db'

// Ensure we are using real fetch, not mocked
// If fetch was mocked globally in other tests, we need to ensure it's restored here.
// However, vitest runs files in isolation usually, or we can unmock.
vi.unstubAllGlobals()

describe('E2E Cloud Sync (Real)', () => {
  // Load credentials from process.env (Vitest loads .env)
  // Note: In Vitest, import.meta.env is populated.
  const REAL_CONFIG = {
    url: import.meta.env.VITE_SUPABASE_URL,
    anonKey: import.meta.env.VITE_SUPABASE_ANON_KEY,
    uploadToken: import.meta.env.VITE_SUPABASE_UPLOAD_TOKEN,
    bucket: import.meta.env.VITE_SUPABASE_BUCKET || 'backups',
    auto: true
  }

  if (!REAL_CONFIG.url || !REAL_CONFIG.anonKey) {
    console.warn('Skipping E2E Cloud Test: Missing .env credentials')
    it.skip('should run e2e test', () => {})
    return
  }

  beforeEach(async () => {
    // Clear local DB
    await db.deleteTissue('all')
    await colorsDb.deleteColor('all')
    localStorage.clear()
    
    // Configure Cloud Sync
    saveConfig(REAL_CONFIG)
  })

  it('should create data, upload to cloud, clear local, and restore', async () => {
    console.log('--- Starting E2E Cloud Test ---')
    
    // 1. Create Generic Data
    console.log('1. Creating generic data...')
    await db.createTissue({
      name: 'E2E Generic Tissue ' + Date.now(),
      width: 150,
      composition: '100% Test'
    })
    await colorsDb.createColor({
      name: 'E2E Generic Color',
      hex: '#FF00FF'
    })
    
    const tissuesBefore = await db.listTissues()
    const colorsBefore = await colorsDb.listColors()
    
    expect(tissuesBefore.length).toBe(1)
    expect(colorsBefore.length).toBe(1)
    
    const tissue = tissuesBefore[0]
    const color = colorsBefore[0]
    
    console.log('   Created:', tissue.name)

    // 2. Upload to Cloud
    console.log('2. Uploading to cloud...')
    const uploadRes = await uploadNewBackup()
    if (!uploadRes.ok) console.error('Upload failed:', uploadRes.reason)
    expect(uploadRes.ok).toBe(true)
    console.log('   Upload success.')

    // 3. Clear Local Data
    console.log('3. Clearing local data...')
    await db.deleteTissue(tissue!.id)
    await colorsDb.deleteColor(color!.id)
    
    const tissuesEmpty = await db.listTissues()
    expect(tissuesEmpty.length).toBe(0)
    console.log('   Local DB cleared.')

    // 4. Restore from Cloud
    console.log('4. Restoring from cloud...')
    const restoreRes = await restoreBackup('latest.json')
    if (!restoreRes.ok) console.error('Restore failed:', restoreRes.reason)
    expect(restoreRes.ok).toBe(true)
    console.log('   Restore success.')

    // 5. Verify Data
    console.log('5. Verifying restored data...')
    const tissuesAfter = await db.listTissues()
    const colorsAfter = await colorsDb.listColors()
    
    expect(tissuesAfter.length).toBe(1)
    expect(colorsAfter.length).toBe(1)
    expect(tissuesAfter[0].name).toBe(tissue!.name)
    expect(colorsAfter[0].name).toBe(color!.name)
    
    console.log('--- E2E Test Passed ---')
  }, 30000) // Increase timeout for network ops
})
