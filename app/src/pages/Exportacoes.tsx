import React, { useEffect, useState } from 'react'
import { Button } from '@mantine/core'
import { notifications } from '@mantine/notifications'
import { db, colorsDb, linksDb, patternsDb, patternLinksDb, familyStatsDb } from '@/lib/db'
import { settingsDb } from '@/lib/db'
import { makeFullExport, fullExportToJsonBlob, verifyFullExportIntegrity } from '@/lib/export'
import { importFromContent, importFullBackup, importFullBackupExact, fullBackupDryRun } from '@/lib/import'
import { DS } from '@/design-system/tokens'
import { Container } from '@/design-system/components'
import { saveFile, isTauri } from '@/lib/platform'

export default function Exportacoes() {
  const [loading, setLoading] = useState(true)
  const [delimiter, setDelimiter] = useState<','|';'>(',')
  const [importing, setImporting] = useState(false)
  const [importMsg, setImportMsg] = useState<string | null>(null)

  useEffect(() => {
    (async () => { try { await linksDb.list() } finally { setLoading(false) } })()
  }, [])

  async function saveBlobAs(blob: Blob, fileName: string) {
    try {
      const result = await saveFile({ data: blob, fileName, mimeType: blob.type })
      if (result.cancelled) {
        notifications.show({ color: 'yellow', message: 'Salvamento cancelado.' })
        return
      }
      if (result.success) {
        if (result.location) {
          notifications.show({ color: 'green', message: `Backup salvo em: ${result.location}` })
        } else if (result.fallbackUsed || !isTauri()) {
          notifications.show({ color: 'green', message: 'Backup baixado (web).' })
        } else {
          notifications.show({ color: 'green', message: 'Backup salvo.' })
        }
      } else {
        notifications.show({ color: 'red', message: 'Falha ao baixar/salvar arquivo.' })
      }
    } catch (e: any) {
      console.error('Erro ao salvar backup:', e)
      notifications.show({ color: 'red', message: `Falha ao salvar: ${e?.message || e}` })
    }
  }

  async function download() {
    // Apenas backup completo JSON
    await db.init()
    const [tissues, colors, patterns, currentLinks, currentPatternLinks] = await Promise.all([
      db.listTissues(),
      colorsDb.listColors(),
      patternsDb.listPatterns(),
      linksDb.list(),
      patternLinksDb.list(),
    ])
    const familyStats = await familyStatsDb.list()
    let delta: number | undefined, hue: any | undefined
    try { delta = await settingsDb.getDeltaThreshold() } catch {}
    try { hue = await settingsDb.getHueBoundaries() } catch {}
    const payload = await makeFullExport({ tissues, colors, patterns, links: currentLinks, patternLinks: currentPatternLinks, familyStats, settings: { deltaThreshold: delta, hueBoundaries: hue } })
    const blob = fullExportToJsonBlob(payload)
    const date = new Date().toISOString().replace(/[:]/g, '-')
    await saveBlobAs(blob, `backup-completo-${date}.json`)
  }

  async function readFileText(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const fr = new FileReader()
      fr.onload = () => resolve(String(fr.result))
      fr.onerror = () => reject(fr.error)
      fr.readAsText(file)
    })
  }

  async function handleImport(file: File) {
    setImporting(true)
    setImportMsg(null)
    try {
      await db.init()
      const text = await readFileText(file)
      // Detecta backup completo
      let parsed: any
      try { parsed = JSON.parse(text) } catch {}
      if (parsed && parsed.schema === 'razai-tools.full-export') {
        // Decide path: if version >=4 perform exact import including links/images.
        if (parsed.version >= 4) {
          const issues = fullBackupDryRun(text)
          // Verificação de integridade
          let integrityInfo = ''
          try {
            const iv = await verifyFullExportIntegrity(parsed)
            integrityInfo = iv.valid ? `Integridade OK (hash ${iv.expected?.slice(0,12)}…)` : `Integridade FALHOU (${iv.reason}; esperado ${iv.expected?.slice(0,12)}… obtido ${iv.actual?.slice(0,12)}…)`
          } catch (e: any) {
            integrityInfo = `Integridade não verificada: ${e?.message || e}`
          }
          const res = await importFullBackupExact(text)
          setImportMsg(`Backup v${parsed.version} importado. ${integrityInfo} Inseridos: T${res.inserted.tissues}/C${res.inserted.colors}/P${res.inserted.patterns}/L${res.inserted.links}/PL${res.inserted.patternLinks}. Atualizados: T${res.updated.tissues}/C${res.updated.colors}/P${res.updated.patterns}/L${res.updated.links}/PL${res.updated.patternLinks}. Issues: ${issues.length? issues.join('; '): 'nenhum'}`)
        } else {
          const res = await importFullBackup(text, {
            createTissue: (input) => db.createTissue(input),
            createColor: (input) => colorsDb.createColor(input),
            createPattern: (input) => patternsDb.createPattern(input),
          })
          setImportMsg(`Backup legado v${parsed.version} importado. Tecidos: ${res.createdT}, Cores: ${res.createdC}, Estampas: ${res.createdP}. (Vínculos não importados)`)
        }
      } else {
        const res = await importFromContent(
          file.name,
          text,
          delimiter,
          {
            listTissues: () => db.listTissues(),
            listColors: () => colorsDb.listColors(),
            createTissue: (input) => db.createTissue(input),
            createColor: (input) => colorsDb.createColor(input),
            createManyLinks: (tissueId, colorIds) => linksDb.createMany(tissueId, colorIds),
          }
        )
        setImportMsg(`Importação concluída. Tecidos criados: ${res.createdT}, Cores criadas: ${res.createdC}, Vínculos criados: ${res.createdL}, Duplicados: ${res.duplicates}.`)
      }
    } catch (e: any) {
      setImportMsg(`Falha ao importar: ${e?.message || String(e)}`)
    } finally {
      setImporting(false)
    }
  }

  return (
    <Container padY={12}>
      <section style={{display:'grid', gap:DS.spacing(6)}}>
      <h1 style={{color:DS.color.textPrimary, margin:0, fontSize:DS.font.size.display, fontWeight:DS.font.weightLight, letterSpacing:DS.font.letterSpacing.tight}}>Importar e Exportar</h1>
      <div style={{display:'flex', gap:12, alignItems:'center', flexWrap:'wrap'}}>
        <label style={{display:'flex', alignItems:'center', gap:6, color:DS.color.textPrimary}} title="Inclui tecidos, cores, estampas, vínculos e configurações">
          Backup completo JSON
        </label>
        <Button color="cyan" disabled={loading} onClick={download}>Baixar backup</Button>
      </div>
      <div style={{display:'flex', gap:12, alignItems:'center'}}>
        <label style={{display:'flex', alignItems:'center', gap:6, color:DS.color.textPrimary}}>
          Importar arquivo:
          <input type="file" accept=".json,.csv" onChange={async (e)=>{
            const f = e.target.files && e.target.files[0]
            if (!f) return
            await handleImport(f)
            try { if (e.currentTarget) e.currentTarget.value = '' } catch {}
          }} />
        </label>
        <span style={{color: importing? DS.color.warning : DS.color.textSecondary}}>{importing? 'Importando...' : (importMsg || '')}</span>
      </div>
      <div style={{ padding:'12px 0' }}><div style={{ height:1, background:DS.color.border }} /></div>
      <small style={{color:DS.color.textSecondary}}>
          Backup completo v4 inclui: schema, version, generatedAt, counts, tissues[], colors[], patterns[], links[], patternLinks[], attachments[], integrity(hashAlgorithm, hashHex), settings. Importação v4 recria vínculos e imagens. Verificação de integridade é realizada automaticamente (hash estável SHA-256). Versões legadas (v1–v3) importam somente tecidos, cores, estampas.
      </small>
    </section>
    </Container>
  )
}

function select(): React.CSSProperties { return { padding:'8px 10px', borderRadius:8, border:`1px solid ${DS.color.border}`, background:DS.color.surface, color:DS.color.textPrimary } }
