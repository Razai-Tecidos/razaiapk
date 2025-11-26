import React, { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { DS } from '@/design-system/tokens'
import { Container, Section, Panel, Stack, Row, Title, Text, Select, Label, Input, DSButton } from '@/design-system/components'
import { FabricColorPreview } from '@/components/FabricColorPreview'
import { colorsDb, db, linksDb } from '@/lib/db'
import { hexToLab, type LAB } from '@/lib/color-utils'
import type { Color } from '@/types/color'
import type { Tissue } from '@/types/tissue'
import type { TecidoCorView } from '@/types/tecidoCor'
import type { RazaiColor } from '@/lib/recolor/recolorEngine'
import { importFullBackup } from '@/lib/import'

function toRazaiColor(c: Color): RazaiColor | null {
  // Prefer provided LAB; fallback to HEX; else skip
  const lab: LAB | undefined = (typeof c.labL === 'number' && typeof c.labA === 'number' && typeof c.labB === 'number')
    ? { L: c.labL, a: c.labA, b: c.labB }
    : (c.hex ? hexToLab(c.hex) : undefined)
  if (!lab) return null
  return { lab, hex: c.hex || '#' }
}

export default function RecolorPreviewPage() {
  const [colors, setColors] = useState<RazaiColor[]>([])
  const [linksForColors, setLinksForColors] = useState<{ skuFilho: string; id: string }[]>([])
  const [tissues, setTissues] = useState<Tissue[]>([])
  const [selectedTissueId, setSelectedTissueId] = useState<string>('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string>('')
  const [importFile, setImportFile] = useState<File | null>(null)

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        // Ensure DB schema ready (SQLite/IndexedDB)
        try { await db.init() } catch {}
        const [tissuesList] = await Promise.all([
          db.listTissues(),
        ])
        if (cancelled) return
        setTissues(tissuesList)
        // Default behavior: no tissue selected → show nothing until choose (or fallback demo if desired)
        setColors([])
        setLinksForColors([])
      } catch {
        // On error, keep empty
        setTissues([])
        setColors([])
      }
    }
    load()
    return () => { cancelled = true }
  }, [])

  // When a tissue is selected, load only its linked colors
  useEffect(() => {
    let cancelled = false
    async function loadLinkedColors() {
      if (!selectedTissueId) { setColors([]); setLinksForColors([]); return }
      try {
        const [links, allColors] = await Promise.all([
          linksDb.list(),
          colorsDb.listColors(),
        ])
        if (cancelled) return
        const activeForTissue = (links as TecidoCorView[]).filter(l => l.tissueId === selectedTissueId && l.status === 'Ativo')
        const byId = new Map(allColors.map(c => [c.id, c]))
        const mappedColors: RazaiColor[] = []
        const mappedLinks: { skuFilho: string; id: string }[] = []
        for (const link of activeForTissue) {
          const c = byId.get(link.colorId)
          if (!c) continue
          const lab: LAB | undefined = (typeof c.labL === 'number' && typeof c.labA === 'number' && typeof c.labB === 'number')
            ? { L: c.labL!, a: c.labA!, b: c.labB! }
            : (c.hex ? hexToLab(c.hex) : undefined)
          if (!lab) continue
          mappedColors.push({ hex: c.hex || '#', lab, name: c.name })
          mappedLinks.push({ skuFilho: link.skuFilho, id: link.id })
        }
        setColors(mappedColors)
        setLinksForColors(mappedLinks)
      } catch (e) {
        console.warn('[recolor] failed to load linked colors', e)
        setColors([])
        setLinksForColors([])
      }
    }
    loadLinkedColors()
    return () => { cancelled = true }
  }, [selectedTissueId])

  return (
    <Container padY={12}>
      <Section
        title="Recolor de Tecido"
        subtitle="Selecione um tecido cadastrado para listar apenas as cores vinculadas a ele. Em seguida aplique cada cor sobre a textura neutralizada do tecido base, com futuros controles de brilho, saturação e matiz."
        padTop={2}
        mb={10}
      >
        <Stack gap={8}>
          {tissues.length === 0 && (
            <Panel title="Nenhum tecido encontrado" subtle>
              <Text size="sm" dimmed>
                Para usar esta prévia, você precisa ter pelo menos 1 tecido cadastrado e vincular cores a ele. Você pode:
              </Text>
              <ul style={{ margin: '0 0 0 18px', padding:0 }}>
                <li style={{ marginBottom:4 }}><Link to="/tecidos" style={{ color: DS.color.accent }}>Cadastrar em Tecidos</Link> e depois vincular em <Link to="/tecido-cor" style={{ color: DS.color.accent }}>Tecido‑Cor</Link></li>
                <li>Ou importar um backup completo (JSON) em <Link to="/exportacoes" style={{ color: DS.color.accent }}>Exportações</Link></li>
              </ul>
              <Stack gap={4}>
                <div>
                  <Label htmlFor="import-json">Importar backup (JSON)</Label>
                  <Input
                    id="import-json"
                    type="file"
                    accept="application/json,.json"
                    disabled={busy}
                    fullWidth
                    onChange={(e) => {
                      const f = e.target.files?.[0] || null
                      setImportFile(f)
                    }}
                  />
                </div>
                <Row gap={4} justify="flex-end">
                  <DSButton
                    tone="accent"
                    disabled={!importFile || busy}
                    onClick={async () => {
                      if (!importFile) return
                      setBusy(true)
                      setMessage('')
                      try {
                        const text = await importFile.text()
                        await importFullBackup(text, {
                          createTissue: (input) => import('@/lib/db').then(m=>m.db.createTissue(input)),
                          createColor: (input) => import('@/lib/db').then(m=>m.colorsDb.createColor(input)),
                          createPattern: (input) => import('@/lib/db').then(m=>m.patternsDb.createPattern(input)),
                        })
                        const next = await db.listTissues()
                        setTissues(next)
                        setMessage('Importação concluída!')
                        setImportFile(null)
                      } catch (err: any) {
                        setMessage('Falha ao importar: ' + (err?.message || String(err)))
                      } finally {
                        setBusy(false)
                      }
                    }}
                  >Importar</DSButton>
                </Row>
                {message && <Text size="sm" dimmed style={{ marginTop: DS.spacing(1) }}>{message}</Text>}
              </Stack>
            </Panel>
          )}

          <Panel subtle>
            <Row gap={6} align="flex-end" wrap>
              <div style={{ minWidth:260, flex: '1 1 260px' }}>
                <Label htmlFor="tissue-select">Tecido</Label>
                <Select
                  id="tissue-select"
                  value={selectedTissueId}
                  onChange={(e)=> setSelectedTissueId(e.target.value)}
                  fullWidth
                >
                  <option value="">Selecione um tecido</option>
                  {tissues.map(t => <option key={t.id} value={t.id}>{t.sku} — {t.name}</option>)}
                </Select>
              </div>
              <Text dimmed size="sm" style={{ flex:1 }}>
                {selectedTissueId ? `${colors.length} cor(es) vinculadas encontradas` : 'Selecione um tecido para listar cores vinculadas'}
              </Text>
            </Row>
          </Panel>

          <Panel title={selectedTissueId ? `Pré-visualização (${colors.length} cores)` : 'Pré-visualização'}>
            <FabricColorPreview
              colors={colors}
              linksForColors={linksForColors}
              tissueName={tissues.find(t => t.id === selectedTissueId)?.name}
            />
          </Panel>
        </Stack>
      </Section>
    </Container>
  )
}



