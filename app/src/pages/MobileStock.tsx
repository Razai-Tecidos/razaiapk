import React, { useEffect, useState } from 'react'
import { DS } from '@/design-system/tokens'
import { linksDb } from '@/lib/db'
import { getStockLevel, registerStockMovement } from '@/lib/stock-api'
import { TecidoCorView } from '@/types/tecidoCor'
import { notifications } from '@mantine/notifications'

interface StockItem extends TecidoCorView {
  stockLevel: number
}

export default function MobileStock() {
  const [loading, setLoading] = useState(true)
  const [items, setItems] = useState<StockItem[]>([])
  const [filter, setFilter] = useState('')
  const [actionModal, setActionModal] = useState<{ item: StockItem; type: 'IN' | 'OUT' } | null>(null)
  const [quantity, setQuantity] = useState(1)
  const [submitting, setSubmitting] = useState(false)

  const loadData = async () => {
    setLoading(true)
    try {
      const links = await linksDb.list()
      const enriched = await Promise.all(links.map(async (link) => {
        const qty = await getStockLevel(link.id)
        return { ...link, stockLevel: qty || 0 } as StockItem
      }))
      // Sort by stock level (lowest first = most urgent)
      enriched.sort((a, b) => a.stockLevel - b.stockLevel)
      setItems(enriched)
    } catch (e) {
      console.error('Failed to load stock data', e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  const filteredItems = items.filter(item =>
    item.nomeCompleto.toLowerCase().includes(filter.toLowerCase()) ||
    item.tissueSku.toLowerCase().includes(filter.toLowerCase()) ||
    item.colorSku.toLowerCase().includes(filter.toLowerCase())
  )

  const handleAction = async () => {
    if (!actionModal) return
    setSubmitting(true)
    try {
      await registerStockMovement(actionModal.item.id, actionModal.type, quantity)
      notifications.show({
        title: actionModal.type === 'IN' ? 'Entrada registrada' : 'Saída registrada',
        message: `${quantity} rolo(s) ${actionModal.type === 'IN' ? 'adicionado(s)' : 'removido(s)'} de ${actionModal.item.nomeCompleto}`,
        color: actionModal.type === 'IN' ? 'green' : 'orange'
      })
      setActionModal(null)
      setQuantity(1)
      loadData()
    } catch (e) {
      notifications.show({ title: 'Erro', message: 'Falha ao registrar movimentação', color: 'red' })
    } finally {
      setSubmitting(false)
    }
  }

  const handleZero = async (item: StockItem) => {
    if (!confirm(`CONFIRMAR: Zerar estoque de ${item.nomeCompleto}?`)) return
    try {
      if (item.stockLevel > 0) {
        await registerStockMovement(item.id, 'OUT', item.stockLevel)
      } else {
        await registerStockMovement(item.id, 'ADJUST', 0)
      }
      notifications.show({
        title: 'Estoque zerado',
        message: `${item.nomeCompleto} agora tem 0 rolos`,
        color: 'red'
      })
      loadData()
    } catch (e) {
      notifications.show({ title: 'Erro', message: 'Falha ao zerar estoque', color: 'red' })
    }
  }

  return (
    <div style={{ padding: DS.spacing(3), paddingBottom: DS.spacing(20) }}>
      {/* Search */}
      <input
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
        placeholder="🔍 Buscar tecido..."
        style={{
          width: '100%',
          padding: DS.spacing(3),
          fontSize: 16,
          border: `1px solid ${DS.color.border}`,
          borderRadius: DS.radius.lg,
          marginBottom: DS.spacing(4),
          background: DS.color.surface
        }}
      />

      {/* Stats */}
      <div style={{ 
        display: 'flex', 
        gap: DS.spacing(2), 
        marginBottom: DS.spacing(4),
        overflowX: 'auto',
        paddingBottom: DS.spacing(1)
      }}>
        <div style={{
          background: '#FEF2F2',
          border: '1px solid #FECACA',
          borderRadius: DS.radius.md,
          padding: `${DS.spacing(2)} ${DS.spacing(3)}`,
          minWidth: 'fit-content'
        }}>
          <span style={{ fontSize: 12, color: '#DC2626' }}>Zerados: </span>
          <strong style={{ color: '#DC2626' }}>{items.filter(i => i.stockLevel === 0).length}</strong>
        </div>
        <div style={{
          background: '#FEF3C7',
          border: '1px solid #FDE68A',
          borderRadius: DS.radius.md,
          padding: `${DS.spacing(2)} ${DS.spacing(3)}`,
          minWidth: 'fit-content'
        }}>
          <span style={{ fontSize: 12, color: '#D97706' }}>Baixo (&lt;5): </span>
          <strong style={{ color: '#D97706' }}>{items.filter(i => i.stockLevel > 0 && i.stockLevel < 5).length}</strong>
        </div>
        <div style={{
          background: '#ECFDF5',
          border: '1px solid #A7F3D0',
          borderRadius: DS.radius.md,
          padding: `${DS.spacing(2)} ${DS.spacing(3)}`,
          minWidth: 'fit-content'
        }}>
          <span style={{ fontSize: 12, color: '#059669' }}>OK: </span>
          <strong style={{ color: '#059669' }}>{items.filter(i => i.stockLevel >= 5).length}</strong>
        </div>
      </div>

      {/* Refresh button */}
      <button
        onClick={loadData}
        disabled={loading}
        style={{
          width: '100%',
          padding: DS.spacing(2),
          marginBottom: DS.spacing(3),
          background: DS.color.surfaceAlt,
          border: `1px solid ${DS.color.border}`,
          borderRadius: DS.radius.md,
          fontSize: 14,
          cursor: 'pointer'
        }}
      >
        {loading ? 'Atualizando...' : '↻ Atualizar lista'}
      </button>

      {/* Items List */}
      {loading && items.length === 0 ? (
        <div style={{ textAlign: 'center', padding: DS.spacing(8), color: DS.color.textMuted }}>
          Carregando...
        </div>
      ) : filteredItems.length === 0 ? (
        <div style={{ textAlign: 'center', padding: DS.spacing(8), color: DS.color.textMuted }}>
          {filter ? 'Nenhum item encontrado' : 'Nenhum tecido cadastrado'}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: DS.spacing(2) }}>
          {filteredItems.map(item => (
            <div
              key={item.id}
              style={{
                background: DS.color.surface,
                border: `1px solid ${item.stockLevel === 0 ? '#FECACA' : DS.color.border}`,
                borderRadius: DS.radius.lg,
                padding: DS.spacing(3),
                boxShadow: DS.shadow.xs
              }}
            >
              {/* Header */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: DS.spacing(2) }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, fontSize: 15, color: DS.color.textPrimary }}>
                    {item.nomeCompleto}
                  </div>
                  <div style={{ fontSize: 12, color: DS.color.textMuted }}>
                    {item.tissueSku}-{item.colorSku}
                  </div>
                </div>
                <div style={{
                  fontSize: 20,
                  fontWeight: 700,
                  color: item.stockLevel === 0 ? '#DC2626' : item.stockLevel < 5 ? '#D97706' : '#059669',
                  background: item.stockLevel === 0 ? '#FEF2F2' : item.stockLevel < 5 ? '#FEF3C7' : '#ECFDF5',
                  padding: `${DS.spacing(1)} ${DS.spacing(3)}`,
                  borderRadius: DS.radius.md,
                  minWidth: 50,
                  textAlign: 'center'
                }}>
                  {item.stockLevel}
                </div>
              </div>

              {/* Actions */}
              <div style={{ display: 'flex', gap: DS.spacing(2) }}>
                <button
                  onClick={() => { setActionModal({ item, type: 'IN' }); setQuantity(1) }}
                  style={{
                    flex: 1,
                    padding: DS.spacing(3),
                    background: '#ECFDF5',
                    border: '1px solid #10B981',
                    borderRadius: DS.radius.md,
                    color: '#059669',
                    fontWeight: 600,
                    fontSize: 14,
                    cursor: 'pointer'
                  }}
                >
                  + Entrada
                </button>
                <button
                  onClick={() => { setActionModal({ item, type: 'OUT' }); setQuantity(1) }}
                  style={{
                    flex: 1,
                    padding: DS.spacing(3),
                    background: '#FEF3C7',
                    border: '1px solid #F59E0B',
                    borderRadius: DS.radius.md,
                    color: '#D97706',
                    fontWeight: 600,
                    fontSize: 14,
                    cursor: 'pointer'
                  }}
                >
                  - Saída
                </button>
                <button
                  onClick={() => handleZero(item)}
                  style={{
                    padding: `${DS.spacing(3)} ${DS.spacing(4)}`,
                    background: '#FEF2F2',
                    border: '1px solid #EF4444',
                    borderRadius: DS.radius.md,
                    color: '#DC2626',
                    fontWeight: 600,
                    fontSize: 12,
                    cursor: 'pointer'
                  }}
                >
                  ZEROU
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Action Modal */}
      {actionModal && (
        <div style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          padding: DS.spacing(4)
        }}>
          <div style={{
            background: DS.color.surface,
            borderRadius: DS.radius.xl,
            padding: DS.spacing(6),
            width: '100%',
            maxWidth: 360
          }}>
            <h3 style={{ margin: 0, marginBottom: DS.spacing(4), fontSize: 18 }}>
              {actionModal.type === 'IN' ? '📥 Entrada' : '📤 Saída'} de Rolos
            </h3>
            
            <div style={{ marginBottom: DS.spacing(4), fontSize: 14, color: DS.color.textSecondary }}>
              {actionModal.item.nomeCompleto}
            </div>

            {/* Quantity Selector */}
            <div style={{ 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center',
              gap: DS.spacing(4),
              marginBottom: DS.spacing(6)
            }}>
              <button
                onClick={() => setQuantity(q => Math.max(1, q - 1))}
                style={{
                  width: 56, height: 56,
                  borderRadius: '50%',
                  border: `2px solid ${DS.color.border}`,
                  background: DS.color.surface,
                  fontSize: 24,
                  cursor: 'pointer'
                }}
              >-</button>
              <div style={{ 
                fontSize: 48, 
                fontWeight: 700, 
                minWidth: 80, 
                textAlign: 'center',
                color: actionModal.type === 'IN' ? '#059669' : '#D97706'
              }}>
                {quantity}
              </div>
              <button
                onClick={() => setQuantity(q => q + 1)}
                style={{
                  width: 56, height: 56,
                  borderRadius: '50%',
                  border: `2px solid ${DS.color.border}`,
                  background: DS.color.surface,
                  fontSize: 24,
                  cursor: 'pointer'
                }}
              >+</button>
            </div>

            {/* Buttons */}
            <div style={{ display: 'flex', gap: DS.spacing(3) }}>
              <button
                onClick={() => { setActionModal(null); setQuantity(1) }}
                style={{
                  flex: 1,
                  padding: DS.spacing(4),
                  background: DS.color.surfaceAlt,
                  border: `1px solid ${DS.color.border}`,
                  borderRadius: DS.radius.lg,
                  fontSize: 16,
                  cursor: 'pointer'
                }}
              >
                Cancelar
              </button>
              <button
                onClick={handleAction}
                disabled={submitting}
                style={{
                  flex: 1,
                  padding: DS.spacing(4),
                  background: actionModal.type === 'IN' ? '#10B981' : '#F59E0B',
                  border: 'none',
                  borderRadius: DS.radius.lg,
                  color: '#fff',
                  fontSize: 16,
                  fontWeight: 600,
                  cursor: 'pointer',
                  opacity: submitting ? 0.7 : 1
                }}
              >
                {submitting ? 'Salvando...' : 'Confirmar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
