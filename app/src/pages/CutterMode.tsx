import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { notifications } from '@mantine/notifications'
import { Container, Title, Text, Panel, Stack, Row, DSButton, Input } from '@/design-system/components'
import { DS } from '@/design-system/tokens'
import { db, linksDb } from '@/lib/db'
import type { TecidoCorView } from '@/types/tecidoCor'
import { registerStockMovement, getStockLevel } from '@/lib/stock-api'
import { normalizeForSearch } from '@/lib/text'
import { supabase, isSupabaseConfigured } from '@/lib/supabase'
import { getRuntime, isTauri, openExternal } from '@/lib/platform'
import { useAuth } from '@/context/AuthContext'

type CutterResult = {
  id: string
  sku: string
  tissueName: string
  tissueSku?: string | null
  colorName: string
  colorSku?: string | null
  width?: number | null
  composition?: string | null
  status?: string | null
}

type StockState = {
  loading: boolean
  value: number | null
  updatedAt?: number
  error?: string
}

interface SupabaseLinkRow {
  id: string
  sku_filho: string
  status: string
  tissues?: { name?: string | null; sku?: string | null; width?: number | null; composition?: string | null } | null
  colors?: { name?: string | null; sku?: string | null } | null
}

const SEARCH_LIMIT = 8

export default function CutterModePage() {
  const { user } = useAuth()
  const [searchTerm, setSearchTerm] = useState('')
  const [results, setResults] = useState<CutterResult[]>([])
  const [loading, setLoading] = useState(false)
  const [offlineFallback, setOfflineFallback] = useState(false)
  const [localLinks, setLocalLinks] = useState<TecidoCorView[]>([])
  const [tissueCount, setTissueCount] = useState(0)
  const [stockByLink, setStockByLink] = useState<Record<string, StockState>>({})
  const [online, setOnline] = useState(typeof navigator === 'undefined' ? true : navigator.onLine)
  const [lastQueryTs, setLastQueryTs] = useState<number | null>(null)
  const runtime = getRuntime()

  useEffect(() => {
    let mounted = true
    const handleOnline = () => mounted && setOnline(true)
    const handleOffline = () => mounted && setOnline(false)
    if (typeof window !== 'undefined') {
      window.addEventListener('online', handleOnline)
      window.addEventListener('offline', handleOffline)
    }
    return () => {
      mounted = false
      if (typeof window !== 'undefined') {
        window.removeEventListener('online', handleOnline)
        window.removeEventListener('offline', handleOffline)
      }
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        await db.init()
        const [tissues, cachedLinks] = await Promise.all([
          db.listTissues().catch(() => []),
          linksDb.list().catch(() => [])
        ])
        if (cancelled) return
        setTissueCount(tissues.length)
        setLocalLinks(cachedLinks)
      } catch (error) {
        console.error('[cutter-mode] falha ao preparar dados locais', error)
      }
    })()
    return () => { cancelled = true }
  }, [])

  const mapRowToResult = useCallback((row: SupabaseLinkRow): CutterResult => ({
    id: row.id,
    sku: row.sku_filho,
    tissueName: row.tissues?.name ?? 'Tecido',
    tissueSku: row.tissues?.sku ?? undefined,
    colorName: row.colors?.name ?? 'Cor',
    colorSku: row.colors?.sku ?? undefined,
    width: row.tissues?.width,
    composition: row.tissues?.composition,
    status: row.status,
  }), [])

  const mapViewToResult = useCallback((view: TecidoCorView): CutterResult => ({
    id: view.id,
    sku: view.skuFilho,
    tissueName: view.tissueName || 'Tecido',
    tissueSku: view.tissueSku,
    colorName: view.colorName || 'Cor',
    colorSku: view.colorSku,
    width: view.width,
    composition: view.composition,
    status: view.status,
  }), [])

  const filterLocalLinks = useCallback((term: string) => {
    if (!term.trim()) return []
    const norm = normalizeForSearch(term)
    return localLinks
      .filter(link => normalizeForSearch(`${link.skuFilho} ${link.tissueName ?? ''} ${link.colorName ?? ''}`).includes(norm))
      .slice(0, SEARCH_LIMIT)
      .map(mapViewToResult)
  }, [localLinks, mapViewToResult])

  const fetchStock = useCallback(async (linkId: string) => {
    setStockByLink(prev => {
      if (prev[linkId]?.loading) return prev
      return { ...prev, [linkId]: { ...prev[linkId], loading: true, error: undefined } }
    })
    const value = await getStockLevel(linkId)
    setStockByLink(prev => ({
      ...prev,
      [linkId]: {
        loading: false,
        value,
        updatedAt: Date.now(),
        error: value === null ? 'indisponível' : undefined,
      },
    }))
  }, [])

  const performSearch = useCallback(async (term: string) => {
    const value = term.trim()
    if (!value) {
      setResults([])
      setOfflineFallback(false)
      return
    }
    setLoading(true)
    setOfflineFallback(false)
    try {
      if (!isSupabaseConfigured()) {
        throw new Error('Supabase não configurado')
      }
      const { data, error } = await supabase
        .from('links')
        .select('id, sku_filho, status, tissues:tissues (name, sku, width, composition), colors:colors (name, sku)')
        .ilike('sku_filho', `%${value}%`)
        .limit(SEARCH_LIMIT)
      if (error) throw error
      const mapped = (data || []).map(row => mapRowToResult(row as SupabaseLinkRow))
      setResults(mapped)
      setLastQueryTs(Date.now())
    } catch (error) {
      console.warn('[cutter-mode] fallback local', error)
      const fallback = filterLocalLinks(value)
      setResults(fallback)
      setOfflineFallback(true)
      setLastQueryTs(Date.now())
    } finally {
      setLoading(false)
    }
  }, [filterLocalLinks, mapRowToResult])

  useEffect(() => {
    const handler = setTimeout(() => { void performSearch(searchTerm) }, 280)
    return () => clearTimeout(handler)
  }, [searchTerm, performSearch])

  useEffect(() => {
    results.forEach(item => {
      if (!stockByLink[item.id]) {
        void fetchStock(item.id)
      }
    })
  }, [results, fetchStock, stockByLink])

  const handleAlertShortage = useCallback(() => {
    const subject = encodeURIComponent('Avisar falta de tecido')
    const body = encodeURIComponent('Olá Razai, preciso repor um tecido. Código: ________. Estoque atual zerado após corte.')
    void openExternal(`mailto:compras@razai.com?subject=${subject}&body=${body}`)
  }, [])

  const handleStockAction = useCallback(async (item: CutterResult, action: 'ZERO' | 'QTY', qty: number) => {
    const stockState = stockByLink[item.id]
    const currentLevel = typeof stockState?.value === 'number' ? stockState.value : await getStockLevel(item.id) ?? 0
    const confirmMessage = action === 'ZERO'
      ? `CONFIRMAR: zerar o estoque de ${item.sku}?`
      : `Confirmar saída de ${qty} rolo(s) para ${item.sku}?`
    if (!window.confirm(confirmMessage)) return

    let response
    if (action === 'ZERO') {
      if (currentLevel > 0) {
        response = await registerStockMovement(item.id, 'OUT', currentLevel, user?.id)
      } else {
        response = await registerStockMovement(item.id, 'ADJUST', 0, user?.id)
      }
    } else {
      response = await registerStockMovement(item.id, 'OUT', qty, user?.id)
    }

    if (!response.ok) {
      notifications.show({ title: 'Erro', message: response.error || 'Falha ao registrar movimentação', color: 'red' })
      return
    }

    const nextLevel = action === 'ZERO' ? 0 : Math.max(0, currentLevel - qty)
    setStockByLink(prev => ({
      ...prev,
      [item.id]: { loading: false, value: nextLevel, updatedAt: Date.now() }
    }))
    setSearchTerm('')
    setResults([])
    notifications.show({
      title: 'Movimentação registrada',
      message: `${item.sku} atualizado para ${nextLevel} rolo(s).`,
      color: 'green'
    })
  }, [stockByLink, user?.id])

  const stats = useMemo(() => ([
    { label: 'Tecidos indexados', value: tissueCount },
    { label: 'Runtime', value: isTauri() ? 'Desktop (offline-ready)' : runtime.replace('-', ' ') },
    { label: 'Canal', value: offlineFallback ? 'Busca local' : online ? 'Supabase' : 'Offline' }
  ]), [tissueCount, runtime, offlineFallback, online])

  const lastQueryHuman = useMemo(() => {
    if (!lastQueryTs) return '–'
    return new Date(lastQueryTs).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
  }, [lastQueryTs])

  return (
    <Container padY={12}>
      <Stack gap={8}>
        <Stack gap={2}>
          <Text size="sm" weight={DS.font.weightMedium} style={{ textTransform: 'uppercase', letterSpacing: DS.font.letterSpacing.wide, color: DS.color.textMuted }}>Operações</Text>
          <Title level={1} style={{ fontWeight: DS.font.weightLight }}>Modo Cortador</Title>
          <Text dimmed size="md">Dispare avisos de falta e registre saídas de rolos com estoque antes/depois. Totalmente responsivo e pronto para uso offline.</Text>
        </Stack>

        <Row gap={4} wrap>
          {stats.map(stat => (
            <div key={stat.label} style={{ flex: '1 1 220px', background: DS.color.surface, border: `1px solid ${DS.color.border}`, borderRadius: DS.radius.lg, padding: DS.spacing(6), boxShadow: DS.shadow.sm }}>
              <Text size="xs" dimmed style={{ textTransform: 'uppercase', letterSpacing: DS.font.letterSpacing.wider }}>{stat.label}</Text>
              <Text size="lg" weight={DS.font.weightBold} style={{ marginTop: DS.spacing(2) }}>{stat.value}</Text>
            </div>
          ))}
        </Row>

        <Panel padding={8} gap={6}>
          <Row gap={6} wrap>
            <div style={{ flex: '1 1 360px' }}>
              <Stack gap={2}>
              <Text size="sm" weight={DS.font.weightMedium}>Busque por SKU completo (ex.: T001-RAZ001)</Text>
              <Input
                fullWidth
                autoFocus
                placeholder="Digite o código ou cole o SKU"
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                aria-label="Buscar SKU para corte"
              />
              </Stack>
            </div>
            <div style={{ minWidth: 220 }}>
              <Stack gap={2}>
              <Text size="sm" weight={DS.font.weightMedium}>Precisa avisar a expedição?</Text>
              <DSButton tone="accent" onClick={handleAlertShortage} style={{ width: '100%' }}>Avisar Falta</DSButton>
              </Stack>
            </div>
          </Row>
          <Row justify="space-between" align="center" style={{ marginTop: DS.spacing(2) }}>
            <Text dimmed size="sm">Última verificação: {lastQueryHuman}</Text>
            <Text dimmed size="sm">{loading ? 'Sincronizando...' : results.length ? `${results.length} resultado(s)` : 'Sem resultados'}</Text>
          </Row>
        </Panel>

        <Panel title="Resultados" padding={6} gap={6}>
          {loading && (
            <div style={{ padding: DS.spacing(6), textAlign: 'center', color: DS.color.textSecondary }}>Carregando vínculos…</div>
          )}

          {!loading && results.length === 0 && (
            <div style={{ padding: DS.spacing(10), textAlign: 'center', border: `1px dashed ${DS.color.border}`, borderRadius: DS.radius.lg, background: DS.color.surfaceAlt }}>
              <div style={{ fontSize: 48, marginBottom: DS.spacing(4) }}>🔍</div>
              <Text dimmed size="md">Digite um código completo ou parcial para listar os vínculos disponíveis.</Text>
              {offlineFallback && <Text size="sm" style={{ marginTop: DS.spacing(3), color: DS.color.warning }}>Modo offline ativo — exibindo dados armazenados no dispositivo.</Text>}
            </div>
          )}

          {results.map(item => (
            <CutterResultCard
              key={item.id}
              item={item}
              stock={stockByLink[item.id]}
              onAction={handleStockAction}
            />
          ))}
        </Panel>
      </Stack>
    </Container>
  )
}

interface CutterResultCardProps {
  item: CutterResult
  stock?: StockState
  onAction: (item: CutterResult, action: 'ZERO' | 'QTY', qty: number) => Promise<void>
}

function CutterResultCard({ item, stock, onAction }: CutterResultCardProps) {
  const [quantity, setQuantity] = useState(1)
  const [pending, setPending] = useState(false)
  const stockValue = typeof stock?.value === 'number' ? stock.value : null
  const projected = stockValue !== null ? Math.max(0, stockValue - quantity) : null

  const handleQtyChange = (next: number) => {
    if (!Number.isFinite(next)) return
    setQuantity(Math.max(1, Math.min(999, Math.round(next))))
  }

  const runAction = async (type: 'ZERO' | 'QTY') => {
    setPending(true)
    try {
      await onAction(item, type, quantity)
    } finally {
      setPending(false)
    }
  }

  return (
    <div style={{ border: `1px solid ${DS.color.border}`, borderRadius: DS.radius.xl, padding: DS.spacing(6), background: DS.color.surface, boxShadow: DS.shadow.sm, display: 'flex', flexDirection: 'column', gap: DS.spacing(5) }}>
      <Row justify="space-between" align="flex-start" wrap>
        <Stack gap={1}>
          <Text size="xs" dimmed>SKU</Text>
          <Text size="lg" weight={DS.font.weightBold}>{item.sku}</Text>
          <Text size="sm" dimmed>{item.tissueName} · {item.colorName}</Text>
          {item.width && <Text size="sm" dimmed>Largura {item.width} cm</Text>}
          {item.composition && <Text size="sm" dimmed>{item.composition}</Text>}
        </Stack>
        <div style={{ minWidth: 200 }}>
          <Stack gap={2} align="flex-end">
            <Text size="xs" dimmed>Estoque atual</Text>
            <Text size="xl" weight={DS.font.weightBold}>{stock?.loading ? '…' : stockValue ?? '—'}</Text>
            <Text size="xs" dimmed>Após saída: {projected ?? '—'}</Text>
            {stock?.error && <Text size="xs" style={{ color: DS.color.warning }}>Não foi possível sincronizar estoque.</Text>}
          </Stack>
        </div>
      </Row>

      <Row gap={4} align="center" wrap>
        <Text size="sm" weight={DS.font.weightMedium}>Quantos rolos saíram?</Text>
        <div style={{ display: 'flex', alignItems: 'center', gap: DS.spacing(2), background: DS.color.surfaceAlt, padding: DS.spacing(2), borderRadius: DS.radius.lg, border: `1px solid ${DS.color.border}` }}>
          <button type="button" onClick={() => handleQtyChange(quantity - 1)} disabled={quantity <= 1 || pending} style={stepperBtnStyle}>-</button>
          <input
            type="number"
            min={1}
            max={999}
            value={quantity}
            onChange={e => handleQtyChange(Number(e.target.value))}
            disabled={pending}
            style={{ width: 72, textAlign: 'center', fontSize: DS.font.size.lg, border: 'none', background: 'transparent', outline: 'none' }}
          />
          <button type="button" onClick={() => handleQtyChange(quantity + 1)} disabled={pending} style={stepperBtnStyle}>+</button>
        </div>
      </Row>

      <Row gap={4} wrap>
        <DSButton tone="accent" disabled={pending} onClick={() => runAction('QTY')}>Confirmar saída ({quantity})</DSButton>
        <DSButton tone="danger" variant="outline" disabled={pending} onClick={() => runAction('ZERO')}>Acabou tudo (0)</DSButton>
      </Row>
    </div>
  )
}

const stepperBtnStyle: React.CSSProperties = {
  width: 40,
  height: 40,
  borderRadius: DS.radius.md,
  border: `1px solid ${DS.color.border}`,
  background: DS.color.surface,
  cursor: 'pointer',
  fontSize: DS.font.size.lg,
  fontWeight: DS.font.weightBold,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center'
}
