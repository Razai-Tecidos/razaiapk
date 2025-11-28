import React, { useEffect, useState } from 'react'
import { Container, Section, Panel, Text, DSButton, Table, TableHead, TableBody, TableRow, TableCell, Spinner, EmptyState, Input } from '@/design-system/components'
import { DS } from '@/design-system/tokens'
import { linksDb } from '@/lib/db'
import { getStockLevel } from '@/lib/stock-api'
import { TecidoCorView } from '@/types/tecidoCor'
import { StockEntryModal } from '@/components/stock/StockEntryModal'

interface StockRow extends TecidoCorView {
  stockLevel: number | null // null means loading or error
  prediction7: 'SAFE' | 'WARNING' | 'CRITICAL'
  prediction15: 'SAFE' | 'WARNING' | 'CRITICAL'
  prediction30: 'SAFE' | 'WARNING' | 'CRITICAL'
  suggestedBuy7: number
  suggestedBuy15: number
  suggestedBuy30: number
}

export default function StockPage() {
  const [loading, setLoading] = useState(true)
  const [rows, setRows] = useState<StockRow[]>([])
  const [filter, setFilter] = useState('')
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [selectedItem, setSelectedItem] = useState<StockRow | null>(null)
  const [actionType, setActionType] = useState<'IN' | 'OUT'>('IN')

  const handleQuickAction = (item: StockRow, type: 'IN' | 'OUT') => {
    setSelectedItem(item)
    setActionType(type)
    setIsModalOpen(true)
  }

  const loadData = async () => {
    setLoading(true)
    try {
      // 1. Get all fabric-color links (local DB)
      const links = await linksDb.list()
      
      // 2. Fetch stock levels for each link (Supabase)
      // Ideally this should be a bulk fetch, but for now we map
      const enriched = await Promise.all(links.map(async (link) => {
        const qty = await getStockLevel(link.id)
        
        // Mock prediction logic for now (until we have enough history)
        // Logic: < 5 rolls = CRITICAL, < 10 = WARNING, >= 10 = SAFE
        const getStatus = (q: number, threshold: number) => {
          if (q <= threshold) return 'CRITICAL'
          if (q <= threshold * 2) return 'WARNING'
          return 'SAFE'
        }
        const q = qty || 0

        // Mock intelligence:
        // Assume average consumption of 0.5 rolls/day (15 rolls/month)
        const avgDailyConsumption = 0.5 
        
        const calcBuy = (days: number) => {
          const target = days * avgDailyConsumption
          return q < target ? Math.ceil(target - q) : 0
        }

        return {
          ...link,
          stockLevel: qty,
          prediction7: getStatus(q, 2),
          prediction15: getStatus(q, 5),
          prediction30: getStatus(q, 10),
          suggestedBuy7: calcBuy(7),
          suggestedBuy15: calcBuy(15),
          suggestedBuy30: calcBuy(30)
        } as StockRow
      }))

      setRows(enriched)
    } catch (e) {
      console.error('Failed to load stock data', e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
    
    // Auto-refresh every 30 seconds to catch updates from Cutter App
    const interval = setInterval(loadData, 30000)
    return () => clearInterval(interval)
  }, [])

  const filteredRows = rows.filter(r => 
    r.nomeCompleto.toLowerCase().includes(filter.toLowerCase()) ||
    r.tissueSku.toLowerCase().includes(filter.toLowerCase())
  )

  const StatusDot = ({ status }: { status: 'SAFE' | 'WARNING' | 'CRITICAL' }) => {
    const color = status === 'SAFE' ? '#10B981' : status === 'WARNING' ? '#F59E0B' : '#EF4444'
    return (
      <div style={{ 
        width: 12, height: 12, borderRadius: '50%', background: color, 
        boxShadow: `0 0 0 2px ${color}33` 
      }} title={status} />
    )
  }

  const SmartBuyCell = ({ amount, status }: { amount: number, status: 'SAFE' | 'WARNING' | 'CRITICAL' }) => {
    if (status === 'SAFE' && amount <= 0) {
      return <div style={{ display:'flex', justifyContent:'center' }}><StatusDot status="SAFE" /></div>
    }
    return (
      <div style={{ display:'flex', justifyContent:'center', alignItems:'center', gap: 6 }}>
        <StatusDot status={status} />
        <span style={{ 
          background: '#FEF3C7', color: '#D97706', 
          padding: '2px 8px', borderRadius: 12, fontSize: 11, fontWeight: 600, whiteSpace: 'nowrap'
        }}>
          +{amount}
        </span>
      </div>
    )
  }

  return (
    <Container>
      <Section 
        title="Controle de Estoque" 
        subtitle="Gerencie a entrada e saída de rolos e acompanhe a previsão de ruptura."
      >
        <Panel>
          <div style={{ 
            display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 12,
            position: 'sticky', top: 0, zIndex: 20, background: DS.color.surface,
            paddingTop: DS.spacing(2), paddingBottom: DS.spacing(2)
          }}>
            <Input 
              placeholder="Filtrar por nome ou SKU..." 
              value={filter} 
              onChange={e => setFilter(e.target.value)} 
              style={{ width: '100%', maxWidth: 300, minWidth: 200 }}
            />
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <DSButton tone="accent" onClick={() => {
                setSelectedItem(null)
                setActionType('IN')
                setIsModalOpen(true)
              }}>
                + Nova Movimentação
              </DSButton>
              <DSButton variant="ghost" onClick={loadData} title="Atualizar dados">
                ↻
              </DSButton>
            </div>
          </div>

          {loading ? (
            <div style={{ padding: 40, display: 'flex', justifyContent: 'center' }}><Spinner /></div>
          ) : filteredRows.length === 0 ? (
            <EmptyState 
              title="Nenhum item encontrado" 
              description={filter ? "Tente outro termo de busca." : "Cadastre vínculos de Tecido+Cor no Catálogo para vê-los aqui."} 
            />
          ) : (
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell header>SKU</TableCell>
                  <TableCell header>Produto</TableCell>
                  <TableCell header align="center">Saldo (Rolos)</TableCell>
                  <TableCell header align="center">Smart Buy 7d</TableCell>
                  <TableCell header align="center">Smart Buy 15d</TableCell>
                  <TableCell header align="center">Smart Buy 30d</TableCell>
                  <TableCell header align="center" width={100}>Ações</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {filteredRows.map(row => (
                  <TableRow key={row.id}>
                    <TableCell>
                      <Text size="sm" weight={500}>{row.tissueSku}</Text>
                      <Text size="xs" dimmed>{row.colorSku}</Text>
                    </TableCell>
                    <TableCell>
                      <Text weight={500}>{row.nomeCompleto}</Text>
                      <Text size="xs" dimmed>{row.family}</Text>
                    </TableCell>
                    <TableCell align="center">
                      <Text size="lg" weight={600} style={{ color: (row.stockLevel || 0) === 0 ? 'red' : 'inherit' }}>
                        {row.stockLevel ?? '-'}
                      </Text>
                    </TableCell>
                    <TableCell align="center">
                      <SmartBuyCell amount={row.suggestedBuy7} status={row.prediction7} />
                    </TableCell>
                    <TableCell align="center">
                      <SmartBuyCell amount={row.suggestedBuy15} status={row.prediction15} />
                    </TableCell>
                    <TableCell align="center">
                      <SmartBuyCell amount={row.suggestedBuy30} status={row.prediction30} />
                    </TableCell>
                    <TableCell align="center">
                      <div style={{ display: 'flex', gap: 4, justifyContent: 'center' }}>
                        <button 
                          onClick={() => handleQuickAction(row, 'IN')}
                          style={{ 
                            width: 28, height: 28, borderRadius: 4, border: '1px solid #10B981', 
                            background: '#ECFDF5', color: '#059669', cursor: 'pointer',
                            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16
                          }}
                          title="Entrada Rápida"
                        >+</button>
                        <button 
                          onClick={() => handleQuickAction(row, 'OUT')}
                          style={{ 
                            width: 28, height: 28, borderRadius: 4, border: '1px solid #EF4444', 
                            background: '#FEF2F2', color: '#B91C1C', cursor: 'pointer',
                            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16
                          }}
                          title="Saída Rápida"
                        >-</button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </Panel>
      </Section>

      <StockEntryModal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
        onSuccess={loadData}
        links={rows} // Pass all rows as options
        initialLink={selectedItem}
        initialType={actionType}
      />
    </Container>
  )
}
