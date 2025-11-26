import React, { useState } from 'react'
import { notifications } from '@mantine/notifications'
import { supabase } from '@/lib/supabase'
import { registerStockMovement, getStockLevel } from '@/lib/stock-api'
import { DS } from '@/design-system/tokens'

export default function CutterModePage() {
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

  return (
    <div style={{
      minHeight: '100vh',
      background: '#F9FAFB',
      padding: '2rem',
      display: 'flex',
      flexDirection: 'column'
    }}>
      <div style={{ maxWidth: '900px', margin: '0 auto', width: '100%' }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4rem' }}>
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
