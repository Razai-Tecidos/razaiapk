import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { DSCard, Container, Hero, Title, Text, GridAuto, Row, DSButton, Stack, Modal, Label, Input, Select } from '@/design-system/components'
import { DS } from '@/design-system/tokens'
import { db, colorsDb, patternsDb } from '@/lib/db'
import { importFullBackup } from '@/lib/import'
import { notifications } from '@mantine/notifications'
import { getLastUploadRecord } from '@/lib/cloud-sync'
import { CutterMode } from '@/modules/cutter-mode'
import { StatCard } from '@/components/StatCard'
import { ActivityCard } from '@/components/ActivityCard'

type ModalType = 'tissue' | 'color' | 'pattern' | 'import' | null

interface ActivityItem {
  id: string
  type: 'tissue' | 'color' | 'pattern'
  name: string
  detail: string
  date: Date
}

export default function Home() {
  const navigate = useNavigate()
  const [activeModal, setActiveModal] = useState<ModalType>(null)
  const [stats, setStats] = useState({ tissues: 0, colors: 0, patterns: 0 })
  const [recentActivity, setRecentActivity] = useState<ActivityItem[]>([])
  const [lastSync, setLastSync] = useState<{ ok: boolean; ts: number } | null>(null)
  
  // Form states
  const [tissueName, setTissueName] = useState('')
  const [tissueType, setTissueType] = useState('Liso')
  const [colorName, setColorName] = useState('')
  const [colorHex, setColorHex] = useState('')
  const [patternName, setPatternName] = useState('')
  const [patternFamily, setPatternFamily] = useState('Outras')
  const [patternFile, setPatternFile] = useState<File | null>(null)
  const [importing, setImporting] = useState(false)

  // Cutter Mode
  const [cutterModalOpen, setCutterModalOpen] = useState(false)

  useEffect(() => {
    loadStats()
    const syncRec = getLastUploadRecord()
    if (syncRec) {
      setLastSync({ ok: syncRec.ok, ts: syncRec.ts })
    }
  }, [])

  async function loadStats() {
    try {
      await db.init()
      const [tissues, colors, patterns] = await Promise.all([
        db.listTissues(),
        colorsDb.listColors(),
        patternsDb.listPatterns()
      ])
      setStats({
        tissues: tissues.length,
        colors: colors.length,
        patterns: patterns.length
      })

      // Build recent activity
      const all: ActivityItem[] = []
      tissues.forEach(t => all.push({
        id: t.id,
        type: 'tissue',
        name: t.name,
        detail: t.sku,
        date: new Date(t.createdAt)
      }))
      colors.forEach(c => all.push({
        id: c.id,
        type: 'color',
        name: c.name,
        detail: c.sku,
        date: new Date(c.createdAt)
      }))
      patterns.forEach(p => all.push({
        id: p.id,
        type: 'pattern',
        name: p.name,
        detail: p.family,
        date: new Date(p.createdAt)
      }))

      all.sort((a, b) => b.date.getTime() - a.date.getTime())
      setRecentActivity(all.slice(0, 5))

    } catch (error) {
      console.error('Failed to load stats:', error)
    }
  }

  async function handleCreateTissue() {
    if (!tissueName.trim()) return
    try {
      await db.createTissue({ 
        name: tissueName.trim(), 
        width: 0,
        composition: '',
        color: undefined
      })
      notifications.show({ title: 'Sucesso', message: 'Tecido criado com sucesso', color: 'green' })
      setActiveModal(null)
      setTissueName('')
      setTissueType('Liso')
      await loadStats()
      navigate('/tecidos')
    } catch (error: any) {
      notifications.show({ title: 'Erro', message: error.message || 'Falha ao criar tecido', color: 'red' })
    }
  }

  async function handleCreateColor() {
    if (!colorName.trim()) return
    try {
      await colorsDb.createColor({
        name: colorName.trim(),
        hex: colorHex.trim() || undefined,
        labL: undefined,
        labA: undefined,
        labB: undefined
      })
      notifications.show({ title: 'Sucesso', message: 'Cor criada com sucesso', color: 'green' })
      setActiveModal(null)
      setColorName('')
      setColorHex('')
      await loadStats()
      navigate('/cores')
    } catch (error: any) {
      notifications.show({ title: 'Erro', message: error.message || 'Falha ao criar cor', color: 'red' })
    }
  }

  async function handleCreatePattern() {
    if (!patternName.trim()) return
    try {
      let base64: string | undefined
      if (patternFile) {
        const reader = new FileReader()
        base64 = await new Promise<string>((resolve, reject) => {
          reader.onload = () => resolve(reader.result as string)
          reader.onerror = reject
          reader.readAsDataURL(patternFile)
        })
      }
      await patternsDb.createPattern({
        name: patternName.trim(),
        family: patternFamily.trim() || 'Outras'
      })
      notifications.show({ title: 'Sucesso', message: 'Estampa criada com sucesso', color: 'green' })
      setActiveModal(null)
      setPatternName('')
      setPatternFile(null)
      await loadStats()
      navigate('/estampas')
    } catch (error: any) {
      notifications.show({ title: 'Erro', message: error.message || 'Falha ao criar estampa', color: 'red' })
    }
  }

  async function handleImportBackup(file: File) {
    setImporting(true)
    try {
      const text = await file.text()
      await importFullBackup(text, {
        createTissue: (input) => db.createTissue(input),
        createColor: (input) => colorsDb.createColor(input),
        createPattern: (input) => patternsDb.createPattern(input)
      })
      notifications.show({ title: 'Sucesso', message: 'Backup importado com sucesso', color: 'green' })
      setActiveModal(null)
      await loadStats()
    } catch (error: any) {
      notifications.show({ title: 'Erro', message: error.message || 'Falha ao importar backup', color: 'red' })
    } finally {
      setImporting(false)
    }
  }

  return (
    <Container padY={12}>
      {/* Top Section: Hero & Stats */}
      <div style={{ marginBottom: DS.spacing(8) }}>
        <Hero subtitle="Ferramentas profissionais para gestão de tecidos, cores, estampas e geração de SKUs.">
          <Title level={1} style={{ fontWeight: DS.font.weightLight, letterSpacing: DS.font.letterSpacing.tight }}>Razai Tools</Title>
        </Hero>
        
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: DS.spacing(6), marginTop: DS.spacing(8) }}>
          <StatCard value={stats.tissues} label="Tecidos" />
          <StatCard value={stats.colors} label="Cores" />
          <StatCard value={stats.patterns} label="Estampas" />
        </div>
      </div>

      {/* Main Layout Grid */}
      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', 
        gap: DS.spacing(8),
        alignItems: 'start' 
      }}>
        
        {/* Left Column: Modules (Navigation) */}
        <div style={{ flex: 2, minWidth: 'min(100%, 600px)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: DS.spacing(6) }}>
            <Text size="xs" weight={DS.font.weightBold} style={{ color: DS.color.textMuted, textTransform: 'uppercase', letterSpacing: DS.font.letterSpacing.wider }}>
              Módulos
            </Text>
            <div style={{ height: 1, flex: 1, background: DS.color.borderSubtle, marginLeft: DS.spacing(4) }} />
          </div>
          
          <GridAuto min={240} gap={6}>
            <DSCard to="/tecidos" title="Tecidos" description="Cadastro e visualização completa." icon="🧵" />
            <DSCard to="/cores" title="Cores" description="Gerir famílias e métricas LAB." icon="🎨" />
            <DSCard to="/estampas" title="Estampas" description="Registrar estampas." icon="✨" />
            <DSCard to="/tecido-cor" title="Tecido-Cor" description="Gerar SKUs filhos." icon="🔗" />
            <DSCard to="/tecido-estampa" title="Tecido-Estampa" description="Gerar SKUs com estampas." icon="🖼️" />
            <DSCard to="/recolor" title="Recolorir" description="Simulação de cores." icon="🎨✨" />
            <DSCard to="/catalogo" title="Catálogo" description="Exportar PDF." icon="📋" />
            <DSCard to="/estoque" title="Estoque" description="Gestão de rolos e saldo." icon="📦" />
            <DSCard to="/configuracoes" title="Configurações" description="Ajustes do sistema." icon="⚙️" />
          </GridAuto>
        </div>

        {/* Right Column: Actions & Activity (Sidebar) */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: DS.spacing(8) }}>
          
          {/* Quick Actions Panel */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: DS.spacing(6) }}>
              <Text size="xs" weight={DS.font.weightBold} style={{ color: DS.color.textMuted, textTransform: 'uppercase', letterSpacing: DS.font.letterSpacing.wider }}>
                Ações Rápidas
              </Text>
              <div style={{ height: 1, flex: 1, background: DS.color.borderSubtle, marginLeft: DS.spacing(4) }} />
            </div>
            
            <div style={{ display: 'grid', gap: DS.spacing(3) }}>
              <DSButton tone="danger" size="lg" onClick={() => setCutterModalOpen(true)} style={{ justifyContent: 'flex-start' }}>✂️ Avisar Falta</DSButton>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: DS.spacing(3) }}>
                <DSButton tone="accent" onClick={() => setActiveModal('tissue')}>+ Tecido</DSButton>
                <DSButton variant="outline" onClick={() => setActiveModal('color')}>+ Cor</DSButton>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: DS.spacing(3) }}>
                <DSButton variant="outline" onClick={() => setActiveModal('pattern')}>+ Estampa</DSButton>
                <DSButton variant="ghost" onClick={() => setActiveModal('import')}>↓ Importar</DSButton>
              </div>
            </div>
          </div>

          {/* Recent Activity Panel */}
          <div style={{ 
            padding: DS.spacing(6),
            background: DS.color.surfaceAlt,
            borderRadius: DS.radius.lg,
            border: `1px solid ${DS.color.border}`
          }}>
            <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom: DS.spacing(4)}}>
              <Title level={3} mb={0} style={{ fontSize: DS.font.size.md, fontWeight: DS.font.weightSemibold }}>Atividade Recente</Title>
              {lastSync && (
                <div title={new Date(lastSync.ts).toLocaleString()} style={{ width: 8, height: 8, borderRadius: '50%', background: lastSync.ok ? DS.color.success : DS.color.danger }} />
              )}
            </div>
            
            {recentActivity.length === 0 ? (
              <div style={{ padding: DS.spacing(4), textAlign: 'center', color: DS.color.textSecondary, fontSize: DS.font.size.sm }}>
                Sem atividades.
              </div>
            ) : (
              <div style={{ display: 'grid', gap: DS.spacing(3) }}>
                {recentActivity.map((item) => (
                  <ActivityCard
                    key={`${item.type}-${item.id}`}
                    type={item.type}
                    name={item.name}
                    detail={item.detail}
                    date={item.date}
                  />
                ))}
              </div>
            )}
          </div>

        </div>
      </div>

      {/* Cutter Mode Modal */}
      <CutterMode isOpen={cutterModalOpen} onClose={() => setCutterModalOpen(false)} />

      {/* Modals */}
      <Modal isOpen={activeModal === 'tissue'} onClose={() => setActiveModal(null)} title="Novo Tecido" size="sm">
        <Stack gap={4}>
          <div>
            <Label htmlFor="tissue-name" required>Nome do Tecido</Label>
            <Input
              id="tissue-name"
              value={tissueName}
              onChange={(e) => setTissueName(e.target.value)}
              placeholder="Ex: Algodão Premium"
              fullWidth
              style={{ height: 40 }}
            />
          </div>
          <div>
            <Label htmlFor="tissue-type">Tipo</Label>
            <Select id="tissue-type" value={tissueType} onChange={(e) => setTissueType(e.target.value)} fullWidth style={{ height: 40 }}>
              <option value="Liso">Liso</option>
              <option value="Estampado">Estampado</option>
              <option value="Misto">Misto</option>
            </Select>
          </div>
          <Row gap={3} justify="flex-end" style={{ marginTop: DS.spacing(4) }}>
            <DSButton variant="ghost" onClick={() => setActiveModal(null)} style={{ height: 40 }}>Cancelar</DSButton>
            <DSButton tone="accent" onClick={handleCreateTissue} disabled={!tissueName.trim()} style={{ height: 40 }}>Criar Tecido</DSButton>
          </Row>
        </Stack>
      </Modal>

      <Modal isOpen={activeModal === 'color'} onClose={() => setActiveModal(null)} title="Nova Cor" size="sm">
        <Stack gap={4}>
          <div>
            <Label htmlFor="color-name" required>Nome da Cor</Label>
            <Input
              id="color-name"
              value={colorName}
              onChange={(e) => setColorName(e.target.value)}
              placeholder="Ex: Vermelho Intenso"
              fullWidth
              style={{ height: 40 }}
            />
          </div>
          <div>
            <Label htmlFor="color-hex">HEX (opcional)</Label>
            <Input
              id="color-hex"
              value={colorHex}
              onChange={(e) => setColorHex(e.target.value)}
              placeholder="#FF0000"
              fullWidth
              style={{ height: 40 }}
            />
          </div>
          <Text dimmed size="xs">Você pode adicionar valores LAB posteriormente na página de Cores.</Text>
          <Row gap={3} justify="flex-end" style={{ marginTop: DS.spacing(4) }}>
            <DSButton variant="ghost" onClick={() => setActiveModal(null)} style={{ height: 40 }}>Cancelar</DSButton>
            <DSButton tone="accent" onClick={handleCreateColor} disabled={!colorName.trim()} style={{ height: 40 }}>Criar Cor</DSButton>
          </Row>
        </Stack>
      </Modal>

      <Modal isOpen={activeModal === 'pattern'} onClose={() => setActiveModal(null)} title="Nova Estampa" size="sm">
        <Stack gap={4}>
          <div>
            <Label htmlFor="pattern-name" required>Nome da Estampa</Label>
            <Input
              id="pattern-name"
              value={patternName}
              onChange={(e) => setPatternName(e.target.value)}
              placeholder="Ex: Floral Primavera"
              fullWidth
              style={{ height: 40 }}
            />
          </div>
          <div>
            <Label htmlFor="pattern-file">Imagem (opcional)</Label>
            <Input
              id="pattern-file"
              type="file"
              accept="image/*"
              onChange={(e) => setPatternFile(e.target.files?.[0] || null)}
              fullWidth
              style={{ height: 40, paddingTop: 8 }}
            />
          </div>
          <Row gap={3} justify="flex-end" style={{ marginTop: DS.spacing(4) }}>
            <DSButton variant="ghost" onClick={() => setActiveModal(null)} style={{ height: 40 }}>Cancelar</DSButton>
            <DSButton tone="accent" onClick={handleCreatePattern} disabled={!patternName.trim()} style={{ height: 40 }}>Criar Estampa</DSButton>
          </Row>
        </Stack>
      </Modal>

      <Modal isOpen={activeModal === 'import'} onClose={() => setActiveModal(null)} title="Importar Backup" size="sm">
        <Stack gap={4}>
          <Text size="sm">Selecione um arquivo JSON de backup para importar tecidos, cores e estampas.</Text>
          <Input
            type="file"
            accept=".json"
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (file) handleImportBackup(file)
            }}
            disabled={importing}
            fullWidth
            style={{ height: 40, paddingTop: 8 }}
          />
          {importing && <Text size="sm">Importando...</Text>}
          <Row gap={3} justify="flex-end" style={{ marginTop: DS.spacing(4) }}>
            <DSButton variant="ghost" onClick={() => setActiveModal(null)} disabled={importing} style={{ height: 40 }}>Cancelar</DSButton>
          </Row>
        </Stack>
      </Modal>
    </Container>
  )
}
