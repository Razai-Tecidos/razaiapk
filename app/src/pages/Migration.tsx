import React, { useState, useEffect } from 'react'
import { Container, Section, Panel, Text, DSButton, Stack } from '@/design-system/components'
import { createClient } from '@supabase/supabase-js'
import { db, colorsDb, patternsDb, linksDb, patternLinksDb, familyStatsDb, settingsDb } from '@/lib/db'

// Initialize Supabase Client
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY
const supabase = createClient(supabaseUrl, supabaseKey)

export default function MigrationPage() {
  const [logs, setLogs] = useState<string[]>([])
  const [isMigrating, setIsMigrating] = useState(false)
  const [progress, setProgress] = useState(0)
  const [compressionQuality, setCompressionQuality] = useState(0.8)

  useEffect(() => {
    settingsDb.getCompressionQuality().then(setCompressionQuality)
  }, [])

  const log = (msg: string) => {
    setLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] ${msg}`])
    // Auto scroll to bottom
    const el = document.getElementById('migration-logs')
    if (el) el.scrollTop = el.scrollHeight
  }

  const runMigration = async () => {
    if (!confirm('Isso irá enviar todos os dados locais para o Supabase. Certifique-se de que o banco na nuvem está limpo ou preparado. Continuar?')) return

    setIsMigrating(true)
    setLogs([])
    setProgress(0)

    try {
      log('Iniciando migração...')

      // 1. Tissues
      log('Lendo Tecidos locais...')
      const tissues = await db.listTissues()
      log(`Encontrados ${tissues.length} tecidos. Enviando...`)
      
      for (const t of tissues) {
        const { error } = await supabase.from('tissues').upsert({
          id: t.id,
          sku: t.sku,
          name: t.name,
          width: t.width,
          composition: t.composition,
          created_at: t.createdAt
        })
        if (error) throw new Error(`Erro ao enviar tecido ${t.sku}: ${error.message}`)
      }
      log('✅ Tecidos enviados com sucesso.')

      // 2. Colors
      log('Lendo Cores locais...')
      const colors = await colorsDb.listColors()
      log(`Encontradas ${colors.length} cores. Enviando...`)

      for (const c of colors) {
        const { error } = await supabase.from('colors').upsert({
          id: c.id,
          sku: c.sku,
          name: c.name,
          hex: c.hex, // Pode ser null agora (requer alteração no banco)
          lab_l: c.labL,
          lab_a: c.labA,
          lab_b: c.labB,
          created_at: c.createdAt
        })
        if (error) throw new Error(`Erro ao enviar cor ${c.sku}: ${error.message}`)
      }
      log('✅ Cores enviadas com sucesso.')

      // 3. Patterns
      log('Lendo Estampas locais...')
      const patterns = await patternsDb.listPatterns()
      log(`Encontradas ${patterns.length} estampas. Enviando...`)

      for (const p of patterns) {
        const { error } = await supabase.from('patterns').upsert({
          id: p.id,
          sku: p.sku,
          family: p.family,
          name: p.name,
          created_at: p.createdAt
        })
        if (error) throw new Error(`Erro ao enviar estampa ${p.sku}: ${error.message}`)
      }
      log('✅ Estampas enviadas com sucesso.')

      // 4. Family Stats
      log('Lendo Estatísticas de Família...')
      const stats = await familyStatsDb.list()
      for (const s of stats) {
        await supabase.from('family_stats').upsert({
          family_name: s.familyName,
          hue_min: s.hueMin,
          hue_max: s.hueMax,
          hue_avg: s.hueAvg,
          color_count: s.colorCount,
          updated_at: s.updatedAt
        })
      }
      log('✅ Estatísticas enviadas.')

      // 5. Links (Tecido + Cor) + Imagens
      log('Processando Vínculos Tecido+Cor...')
      const links = await linksDb.listRaw()
      log(`Encontrados ${links.length} vínculos.`)

      let processedLinks = 0
      for (const l of links) {
        let imagePath = null

        // Upload Image if exists
        if (l.imagePath) {
          try {
            const fileData = await readLocalFile(l.imagePath)
            if (fileData) {
              // Compress image before upload
              const originalMime = l.imageMime || 'image/jpeg'
              const { blob, mime } = await compressImage(fileData, originalMime)
              
              // Use .webp extension if converted, otherwise original
              const originalExt = l.imagePath.split('.').pop() || 'jpg'
              const ext = mime === 'image/webp' ? 'webp' : originalExt
              
              const fileName = `${l.id}.${ext}`
              const { data: uploadData, error: uploadError } = await supabase.storage
                .from('tissue-images')
                .upload(fileName, blob, { upsert: true, contentType: mime })
              
              if (uploadError) {
                log(`⚠️ Erro upload imagem ${l.skuFilho}: ${uploadError.message}`)
              } else {
                imagePath = uploadData.path
              }
            }
          } catch (e) {
            log(`⚠️ Falha ao ler arquivo local ${l.imagePath}: ${e}`)
          }
        }

        const { error } = await supabase.from('links').upsert({
          id: l.id,
          tissue_id: l.tissueId,
          color_id: l.colorId,
          sku_filho: l.skuFilho,
          status: l.status,
          image_path: imagePath,
          created_at: l.createdAt
        })

        if (error) log(`❌ Erro ao salvar link ${l.skuFilho}: ${error.message}`)
        
        processedLinks++
        if (processedLinks % 5 === 0) setProgress(Math.round((processedLinks / links.length) * 50)) // First half of progress bar
      }
      log('✅ Vínculos Tecido+Cor finalizados.')

      // 6. Pattern Links (Tecido + Estampa)
      log('Processando Vínculos Tecido+Estampa...')
      const pLinks = await patternLinksDb.listRaw()
      log(`Encontrados ${pLinks.length} vínculos de estampa.`)

      let processedPLinks = 0
      for (const l of pLinks) {
        let imagePath = null

        if (l.imagePath) {
          try {
            const fileData = await readLocalFile(l.imagePath)
            if (fileData) {
              // Compress image before upload
              const originalMime = l.imageMime || 'image/jpeg'
              const { blob, mime } = await compressImage(fileData, originalMime)
              
              // Use .webp extension if converted, otherwise original
              const originalExt = l.imagePath.split('.').pop() || 'jpg'
              const ext = mime === 'image/webp' ? 'webp' : originalExt

              const fileName = `${l.id}.${ext}`
              const { data: uploadData, error: uploadError } = await supabase.storage
                .from('pattern-images')
                .upload(fileName, blob, { upsert: true, contentType: mime })
              
              if (uploadError) {
                log(`⚠️ Erro upload imagem estampa ${l.skuFilho}: ${uploadError.message}`)
              } else {
                imagePath = uploadData.path
              }
            }
          } catch (e) {
            log(`⚠️ Falha ao ler arquivo local ${l.imagePath}: ${e}`)
          }
        }

        const { error } = await supabase.from('pattern_links').upsert({
          id: l.id,
          tissue_id: l.tissueId,
          pattern_id: l.patternId,
          sku_filho: l.skuFilho,
          status: l.status,
          image_path: imagePath,
          created_at: l.createdAt
        })

        if (error) log(`❌ Erro ao salvar link estampa ${l.skuFilho}: ${error.message}`)
        
        processedPLinks++
        if (processedPLinks % 5 === 0) setProgress(50 + Math.round((processedPLinks / pLinks.length) * 50))
      }
      log('✅ Vínculos Tecido+Estampa finalizados.')

      log('🎉 MIGRAÇÃO CONCLUÍDA COM SUCESSO!')
      setProgress(100)

    } catch (e: any) {
      log(`❌ ERRO FATAL: ${e.message}`)
      console.error(e)
    } finally {
      setIsMigrating(false)
    }
  }

  // Helper to compress image while maintaining resolution
  const compressImage = async (fileData: Uint8Array, mimeType: string): Promise<{ blob: Blob, mime: string }> => {
    return new Promise((resolve) => {
      const blob = new Blob([fileData], { type: mimeType })
      const url = URL.createObjectURL(blob)
      const img = new Image()
      
      img.onload = () => {
        URL.revokeObjectURL(url)
        const canvas = document.createElement('canvas')
        // Maintain original resolution
        canvas.width = img.width
        canvas.height = img.height
        const ctx = canvas.getContext('2d')
        if (!ctx) {
          resolve({ blob, mime: mimeType }) // Fallback to original
          return
        }
        ctx.drawImage(img, 0, 0)
        
        // Convert to WebP at configured quality
        // If browser doesn't support WebP encoding, it might fall back to PNG/JPEG
        const targetMime = 'image/webp'
        canvas.toBlob((newBlob) => {
          if (newBlob) {
            // Only use compressed if it's actually smaller
            if (newBlob.size < blob.size) {
              resolve({ blob: newBlob, mime: targetMime })
            } else {
              resolve({ blob, mime: mimeType })
            }
          } else {
            resolve({ blob, mime: mimeType })
          }
        }, targetMime, compressionQuality)
      }
      
      img.onerror = (e) => {
        URL.revokeObjectURL(url)
        console.warn('Image load error during compression, using original', e)
        resolve({ blob, mime: mimeType })
      }
      
      img.src = url
    })
  }

  // Helper to read file in Tauri environment
  const readLocalFile = async (relativePath: string): Promise<Uint8Array | null> => {
    try {
      // Check if running in Tauri
      // @ts-ignore
      if (window.__TAURI__) {
        const { readFile } = await import('@tauri-apps/plugin-fs')
        const { join, appDataDir } = await import('@tauri-apps/api/path')
        
        // Construct full path: appDataDir + relativePath
        const appData = await appDataDir()
        const fullPath = await join(appData, relativePath)
        
        // Read binary
        const contents = await readFile(fullPath)
        return contents
      } else {
        // Web mode (IndexedDB blobs not easily accessible via path string, 
        // but in IDB mode imagePath might be a blob URL or we might need to fetch from IDB directly)
        // For now assuming Tauri for file migration as requested.
        log('⚠️ Leitura de arquivo não suportada no modo Web (apenas Tauri)')
        return null
      }
    } catch (e) {
      console.error('Error reading file:', e)
      return null
    }
  }

  return (
    <Container>
      <Section title="Migração para Nuvem (Supabase)" subtitle="Envie seus dados locais para o servidor.">
        <Panel>
          <Stack gap={16}>
            <Text>
              Esta ferramenta irá ler todos os dados do seu banco de dados local (SQLite) e enviá-los para o Supabase.
              <br />
              <strong>Atenção:</strong> Certifique-se de ter criado os Buckets &apos;tissue-images&apos; e &apos;pattern-images&apos; no Supabase Storage e definido as tabelas SQL.
            </Text>

            <div style={{ border: '1px solid #eee', borderRadius: 8, padding: 12, height: 300, overflowY: 'auto', background: '#f9fafb', fontFamily: 'monospace', fontSize: 12 }} id="migration-logs">
              {logs.length === 0 ? <span style={{ color: '#999' }}>Aguardando início...</span> : logs.map((l, i) => <div key={i}>{l}</div>)}
            </div>

            {isMigrating && (
              <div style={{ width: '100%', height: 8, background: '#eee', borderRadius: 4, overflow: 'hidden' }}>
                <div style={{ width: `${progress}%`, height: '100%', background: '#10B981', transition: 'width 0.3s' }} />
              </div>
            )}

            <DSButton tone="accent" onClick={runMigration} disabled={isMigrating}>
              {isMigrating ? 'Migrando...' : 'Iniciar Migração'}
            </DSButton>
          </Stack>
        </Panel>
      </Section>
    </Container>
  )
}
