import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { DSCard, Container, Hero, Title, Text, GridAuto, Row, DSButton, Stack, Modal, Label, Input, Select } from '@/design-system/components'
import { DS } from '@/design-system/tokens'
import { db, colorsDb, patternsDb } from '@/lib/db'
import { importFullBackup } from '@/lib/import'
import { notifications } from '@mantine/notifications'
import { getLastUploadRecord } from '@/lib/cloud-sync'
import { supabase } from '@/lib/supabase'
import { registerStockMovement, getStockLevel } from '@/lib/stock-api'

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
  const [cutterSearch, setCutterSearch] = useState('')
  const [cutterResults, setCutterResults] = useState<any[]>([])
  const [loadingCutter, setLoadingCutter] = useState(false)

  async function searchCutterLinks(term: string) {
    if (!term) {
      setCutterResults([])
      return
    }
    setLoadingCutter(true)
    try {
      const { data, error } = await supabase
        .from('links')
        .select('*, tissue:tissues(name), color:colors(name)')
        .ilike('sku_filho', `%${term}%`)
        .limit(10)
      
      if (error) throw error
      setCutterResults(data || [])
    } catch (e) {
      console.error(e)
      notifications.show({ title: 'Erro', message: 'Erro ao buscar tecidos', color: 'red' })
    } finally {
      setLoadingCutter(false)
    }
  }

  async function handleStockAction(item: any, action: 'ZERO' | 'QTY', quantity: number = 0) {
    const itemName = `${item.tissue?.name} ${item.color?.name}`
    
    if (action === 'ZERO') {
      if (!confirm(`CONFIRMAR: O tecido ${itemName} ACABOU (0 estoque)?`)) return
      
      try {
        const current = await getStockLevel(item.id)
        if (current && current > 0) {
          await registerStockMovement(item.id, 'OUT', current)
        } else {
          await registerStockMovement(item.id, 'ADJUST', 0)
        }
        notifications.show({ 
          title: 'ZERADO!', 
          message: `Estoque de ${item.sku_filho} definido como 0.`, 
          color: 'red',
          autoClose: 5000,
          styles: (theme) => ({
            root: { padding: '20px' },
            title: { fontSize: '1.2rem', fontWeight: 700 },
            description: { fontSize: '1rem' }
          })
        })
      } catch (e) {
        notifications.show({ title: 'Erro', message: 'Falha ao atualizar', color: 'red' })
      }
    } else {
      // QTY
      if (!confirm(`Confirmar saída de ${quantity} rolo(s)?`)) return
      
      try {
        await registerStockMovement(item.id, 'OUT', quantity)
        notifications.show({ 
          title: 'Registrado', 
          message: `Saída de ${quantity} rolo(s) registrada.`, 
          color: 'green',
          autoClose: 5000,
          styles: (theme) => ({
            root: { padding: '20px' },
            title: { fontSize: '1.2rem', fontWeight: 700 },
            description: { fontSize: '1rem' }
          })
        })
      } catch (e) {
        notifications.show({ title: 'Erro', message: 'Falha ao atualizar', color: 'red' })
      }
    }

    setCutterSearch('')
    setCutterResults([])
  }

  function CutterResultRow({ item, onAction }: { item: any, onAction: (item: any, type: 'ZERO' | 'QTY', qty: number) => void }) {
    const [quantity, setQuantity] = useState(1)
  
    return (
      <div style={{
        background: DS.color.surface,
        padding: DS.spacing(8),
        borderRadius: DS.radius.xl,
        border: `1px solid ${DS.color.border}`,
        boxShadow: DS.shadow.sm,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: DS.spacing(8)
      }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: '3rem', fontWeight: DS.font.weightBold, color: DS.color.textPrimary, marginBottom: DS.spacing(2), lineHeight: 1 }}>
            {item.sku_filho}
          </div>
          <div style={{ fontSize: '1.5rem', color: DS.color.textSecondary }}>
            {item.tissue?.name} <span style={{ color: DS.color.textMuted }}>•</span> {item.color?.name}
          </div>
        </div>
  
        <div style={{ display: 'flex', flexDirection: 'column', gap: DS.spacing(4), alignItems: 'flex-end' }}>
          
          {/* Counter Section */}
          <div style={{ display: 'flex', alignItems: 'center', gap: DS.spacing(4) }}>
              <span style={{ fontSize: '1.2rem', color: DS.color.textSecondary }}>Quantos acabaram?</span>
              <div style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  background: DS.color.surfaceAlt, 
                  borderRadius: DS.radius.lg,
                  border: `1px solid ${DS.color.border}`,
                  padding: DS.spacing(1)
              }}>
                  <button 
                      onClick={() => setQuantity(q => Math.max(1, q - 1))}
                      style={{
                          width: 48, height: 48,
                          borderRadius: DS.radius.md,
                          border: 'none',
                          background: '#fff',
                          boxShadow: DS.shadow.xs,
                          fontSize: 24,
                          cursor: 'pointer',
                          color: DS.color.textPrimary
                      }}
                  >-</button>
                  <div style={{ width: 60, textAlign: 'center', fontSize: 24, fontWeight: 'bold' }}>{quantity}</div>
                  <button 
                      onClick={() => setQuantity(q => q + 1)}
                      style={{
                          width: 48, height: 48,
                          borderRadius: DS.radius.md,
                          border: 'none',
                          background: '#fff',
                          boxShadow: DS.shadow.xs,
                          fontSize: 24,
                          cursor: 'pointer',
                          color: DS.color.textPrimary
                      }}
                  >+</button>
              </div>
          </div>
  
          {/* Actions */}
          <div style={{ display: 'flex', gap: DS.spacing(3) }}>
              <button
                  onClick={() => onAction(item, 'QTY', quantity)}
                  style={{
                      background: DS.color.accent,
                      color: '#fff',
                      border: 'none',
                      borderRadius: DS.radius.lg,
                      padding: `${DS.spacing(3)} ${DS.spacing(6)}`,
                      fontSize: '1.2rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                      transition: 'opacity 0.2s'
                  }}
              >
                  Confirmar Saída ({quantity})
              </button>
              
              <button
                  onClick={() => onAction(item, 'ZERO')}
                  style={{
                      background: '#FEF2F2',
                      color: '#DC2626',
                      border: '1px solid #FECACA',
                      borderRadius: DS.radius.lg,
                      padding: `${DS.spacing(3)} ${DS.spacing(6)}`,
                      fontSize: '1.2rem',
                      fontWeight: 600,
                      cursor: 'pointer'
                  }}
              >
                  ACABOU TUDO (0)
              </button>
          </div>
        </div>
      </div>
    )
  }

  if (cutterModalOpen) {
    return (
      <div style={{
        position: 'fixed',
        top: 0, left: 0, right: 0, bottom: 0,
        background: '#F9FAFB',
        zIndex: 9999,
        overflowY: 'auto',
        padding: '2rem'
      }}>
        <div style={{ maxWidth: '900px', margin: '0 auto' }}>
          {/* Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4rem' }}>
            <button 
              onClick={() => setCutterModalOpen(false)}
              style={{ 
                background: 'transparent', 
                border: 'none', 
                fontSize: '1.5rem', 
                cursor: 'pointer', 
                display: 'flex', 
                alignItems: 'center', 
                gap: '0.5rem',
                color: '#6B7280',
                fontWeight: 500
              }}
            >
              ← Voltar
            </button>
            <div style={{ fontSize: '1.2rem', fontWeight: 700, color: '#EF4444', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Modo Cortador
            </div>
          </div>

          {/* Main Content */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem', alignItems: 'center' }}>
            <div style={{ textAlign: 'center', marginBottom: '1rem' }}>
              <h1 style={{ fontSize: '3.5rem', fontWeight: 300, color: '#111827', margin: '0 0 1rem 0', lineHeight: 1.1 }}>
                Qual tecido acabou?
              </h1>
              <p style={{ fontSize: '1.5rem', color: '#6B7280', margin: 0 }}>
                Digite o código ou nome do tecido abaixo.
              </p>
            </div>

            <input
              autoFocus
              value={cutterSearch}
              onChange={(e) => {
                setCutterSearch(e.target.value)
                searchCutterLinks(e.target.value)
              }}
              placeholder="Digite aqui..."
              style={{
                width: '100%',
                height: '100px',
                fontSize: '3rem',
                textAlign: 'center',
                borderRadius: '1rem',
                border: '2px solid #E5E7EB',
                boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
                outline: 'none',
                transition: 'all 0.2s',
                background: '#fff'
              }}
              onFocus={(e) => {
                e.target.style.borderColor = '#3B82F6'
                e.target.style.boxShadow = '0 0 0 4px rgba(59, 130, 246, 0.2)'
              }}
              onBlur={(e) => {
                e.target.style.borderColor = '#E5E7EB'
                e.target.style.boxShadow = '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
              }}
            />

            {/* Results */}
            <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '2rem' }}>
              {loadingCutter && (
                <div style={{ textAlign: 'center', fontSize: '1.5rem', color: '#9CA3AF' }}>Procurando...</div>
              )}
              
              {cutterResults.map(item => (
                <CutterResultRow key={item.id} item={item} onAction={handleStockAction} />
              ))}

              {cutterSearch && !loadingCutter && cutterResults.length === 0 && (
                <div style={{ textAlign: 'center', padding: '4rem', background: '#fff', borderRadius: '1rem', border: '1px dashed #E5E7EB' }}>
                  <div style={{ fontSize: '4rem', marginBottom: '1rem' }}>🔍</div>
                  <div style={{ fontSize: '1.5rem', color: '#6B7280' }}>Não encontramos nenhum tecido com esse código.</div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    )
  }

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
      <Hero subtitle="Ferramentas profissionais para gestão de tecidos, cores, estampas e geração de SKUs. Rápido, consistente e confiável.">
        <Title level={1} style={{ fontWeight: DS.font.weightLight, letterSpacing: DS.font.letterSpacing.tight }}>Razai Tools</Title>
      </Hero>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: DS.spacing(6), marginTop: DS.spacing(12), marginBottom: DS.spacing(12) }}>
        <div style={{
          padding: DS.spacing(6),
          background: DS.color.surface,
          border: `1px solid ${DS.color.border}`,
          borderRadius: DS.radius.lg,
          boxShadow: DS.shadow.sm,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: DS.spacing(2)
        }}>
          <Text size="xl" weight={DS.font.weightLight} style={{ color: DS.color.textPrimary, lineHeight: 1, fontSize: DS.font.size.display }}>
            {stats.tissues}
          </Text>
          <Text size="sm" weight={DS.font.weightMedium} style={{ color: DS.color.textSecondary, textTransform: 'uppercase', letterSpacing: DS.font.letterSpacing.wide }}>Tecidos</Text>
        </div>
        <div style={{
          padding: DS.spacing(6),
          background: DS.color.surface,
          border: `1px solid ${DS.color.border}`,
          borderRadius: DS.radius.lg,
          boxShadow: DS.shadow.sm,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: DS.spacing(2)
        }}>
          <Text size="xl" weight={DS.font.weightLight} style={{ color: DS.color.textPrimary, lineHeight: 1, fontSize: DS.font.size.display }}>
            {stats.colors}
          </Text>
          <Text size="sm" weight={DS.font.weightMedium} style={{ color: DS.color.textSecondary, textTransform: 'uppercase', letterSpacing: DS.font.letterSpacing.wide }}>Cores</Text>
        </div>
        <div style={{
          padding: DS.spacing(6),
          background: DS.color.surface,
          border: `1px solid ${DS.color.border}`,
          borderRadius: DS.radius.lg,
          boxShadow: DS.shadow.sm,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: DS.spacing(2)
        }}>
          <Text size="xl" weight={DS.font.weightLight} style={{ color: DS.color.textPrimary, lineHeight: 1, fontSize: DS.font.size.display }}>
            {stats.patterns}
          </Text>
          <Text size="sm" weight={DS.font.weightMedium} style={{ color: DS.color.textSecondary, textTransform: 'uppercase', letterSpacing: DS.font.letterSpacing.wide }}>Estampas</Text>
        </div>
      </div>
      
      <section style={{ marginBottom: DS.spacing(12) }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: DS.spacing(6) }}>
          <Text size="xs" weight={DS.font.weightBold} style={{ color: DS.color.textMuted, textTransform: 'uppercase', letterSpacing: DS.font.letterSpacing.wider }}>
            Ações Rápidas
          </Text>
          <div style={{ height: 1, flex: 1, background: DS.color.borderSubtle, marginLeft: DS.spacing(4) }} />
        </div>
        <div style={{ display: 'flex', gap: DS.spacing(4), flexWrap: 'wrap' }}>
          <DSButton tone="danger" size="lg" onClick={() => setCutterModalOpen(true)} style={{ height: 48 }}>✂️ Avisar Falta</DSButton>
          <DSButton tone="accent" size="lg" onClick={() => setActiveModal('tissue')} style={{ height: 48 }}>+ Novo Tecido</DSButton>
          <DSButton variant="outline" size="lg" onClick={() => setActiveModal('color')} style={{ height: 48 }}>+ Nova Cor</DSButton>
          <DSButton variant="outline" size="lg" onClick={() => setActiveModal('pattern')} style={{ height: 48 }}>+ Nova Estampa</DSButton>
          <div style={{ flex: 1 }} />
          <DSButton variant="ghost" size="md" onClick={() => setActiveModal('import')} style={{ height: 48 }}>↓ Importar Backup</DSButton>
        </div>
      </section>

      <section style={{ marginBottom: DS.spacing(12) }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: DS.spacing(6) }}>
          <Text size="xs" weight={DS.font.weightBold} style={{ color: DS.color.textMuted, textTransform: 'uppercase', letterSpacing: DS.font.letterSpacing.wider }}>
            Módulos
          </Text>
          <div style={{ height: 1, flex: 1, background: DS.color.borderSubtle, marginLeft: DS.spacing(4) }} />
        </div>
        <GridAuto min={260} gap={6}>
          <DSCard to="/tecidos" title="Tecidos" description="Cadastro e visualização completa de tecidos disponíveis." icon="🧵" />
          <DSCard to="/cores" title="Cores" description="Gerir famílias, nomes e métricas LAB de cores." icon="🎨" />
          <DSCard to="/estampas" title="Estampas" description="Registrar estampas e aplicar em tecidos." icon="✨" />
          <DSCard to="/tecido-cor" title="Tecido-Cor" description="Gerar SKUs filhos combinando tecido e cor." icon="🔗" />
          <DSCard to="/tecido-estampa" title="Tecido-Estampa" description="Gerar SKUs com estampas aplicadas." icon="🖼️" />
          <DSCard to="/recolor" title="Recolorir" description="Recolorir tecidos com cores customizadas usando processamento de imagem." icon="🎨✨" />
          <DSCard to="/catalogo" title="Catálogo" description="Visualizar e exportar catálogo de produtos em PDF." icon="📋" />
          <DSCard to="/exportacoes" title="Backup & Import" description="Exportar estado completo ou importar backups." icon="💾" />
          <DSCard to="/configuracoes" title="Configurações" description="Ajustes finos de classificação e limites." icon="⚙️" />
        </GridAuto>
      </section>

      <section style={{ 
        marginTop: DS.spacing(8), 
        padding: DS.spacing(6),
        background: DS.color.surfaceAlt,
        borderRadius: DS.radius.lg,
        border: `1px solid ${DS.color.border}`
      }}>
        <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom: DS.spacing(6)}}>
          <Title level={3} mb={0} style={{ fontSize: DS.font.size.lg, fontWeight: DS.font.weightSemibold }}>Atividade Recente</Title>
          {lastSync && (
            <Text size="xs" style={{ color: lastSync.ok ? DS.color.success : DS.color.danger, fontWeight: DS.font.weightMedium }}>
              {lastSync.ok ? '☁️ Sincronizado: ' : '⚠️ Falha sync: '}
              {new Date(lastSync.ts).toLocaleString()}
            </Text>
          )}
        </div>
        
        {recentActivity.length === 0 ? (
          <div style={{ padding: DS.spacing(8), textAlign: 'center', color: DS.color.textSecondary }}>
            Nenhuma atividade registrada ainda.
          </div>
        ) : (
          <div style={{ display: 'grid', gap: DS.spacing(3) }}>
            {recentActivity.map((item) => (
              <div key={`${item.type}-${item.id}`} style={{
                display: 'flex',
                alignItems: 'center',
                padding: `${DS.spacing(3)} ${DS.spacing(4)}`,
                background: DS.color.surface,
                borderRadius: DS.radius.md,
                border: `1px solid ${DS.color.borderSubtle}`,
                boxShadow: DS.shadow.xs,
                transition: 'transform 0.2s ease',
                cursor: 'default'
              }}>
                <div style={{ 
                  width: 40, 
                  height: 40, 
                  borderRadius: DS.radius.pill, 
                  background: DS.color.surfaceAlt, 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'center', 
                  fontSize: 20, 
                  marginRight: DS.spacing(4),
                  border: `1px solid ${DS.color.borderSubtle}`
                }}>
                  {item.type === 'tissue' ? '🧵' : item.type === 'color' ? '🎨' : '✨'}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: DS.spacing(3), marginBottom: 2 }}>
                    <Text weight={DS.font.weightMedium} style={{ color: DS.color.textPrimary, fontSize: DS.font.size.base }}>
                      {item.name}
                    </Text>
                    <span style={{
                      fontSize: 10,
                      padding: '2px 8px',
                      borderRadius: 10,
                      background: item.type === 'tissue' ? '#e0f2fe' : item.type === 'color' ? '#fce7f3' : '#fef3c7',
                      color: item.type === 'tissue' ? '#0369a1' : item.type === 'color' ? '#be185d' : '#b45309',
                      fontWeight: 600,
                      textTransform: 'uppercase',
                      letterSpacing: 0.5
                    }}>
                      {item.type === 'tissue' ? 'Tecido' : item.type === 'color' ? 'Cor' : 'Estampa'}
                    </span>
                  </div>
                  <Text size="xs" style={{ color: DS.color.textSecondary }}>
                    {item.detail}
                  </Text>
                </div>
                <Text size="xs" style={{ color: DS.color.textMuted, fontVariantNumeric: 'tabular-nums' }}>
                  {item.date.toLocaleDateString()} <span style={{ opacity: 0.5 }}>•</span> {item.date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </Text>
              </div>
            ))}
          </div>
        )}
      </section>

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
