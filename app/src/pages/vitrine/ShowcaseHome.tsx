import React, { useEffect, useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { DS } from '@/design-system/tokens'

export default function ShowcaseHome() {
  const [tissues, setTissues] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedComposition, setSelectedComposition] = useState<string>('')
  const navigate = useNavigate()

  useEffect(() => {
    ;(async () => {
      setLoading(true)
      try {
        const { data, error } = await supabase
          .from('tissues')
          .select('*')
          .order('name')
        
        if (error) throw error
        setTissues(data || [])
      } catch (e) {
        console.error(e)
      } finally {
        setLoading(false)
      }
    })()
  }, [])

  const compositions = useMemo(() => {
    const set = new Set<string>()
    tissues.forEach(t => {
      if (t.composition) set.add(t.composition)
    })
    return Array.from(set).sort()
  }, [tissues])

  const filteredTissues = useMemo(() => {
    return tissues.filter(t => {
      const matchesSearch = 
        t.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        t.sku.toLowerCase().includes(searchTerm.toLowerCase())
      
      const matchesComposition = 
        !selectedComposition || t.composition === selectedComposition

      return matchesSearch && matchesComposition
    })
  }, [tissues, searchTerm, selectedComposition])

  return (
    <div className="notranslate" translate="no" style={{ paddingBottom: DS.spacing(10) }}>
      <div style={{ marginBottom: DS.spacing(8), textAlign: 'center' }}>
        <h1 style={{
          color: DS.color.textPrimary, 
          margin: `0 0 ${DS.spacing(2)} 0`, 
          fontSize: DS.font.size.display, 
          fontWeight: DS.font.weightLight,
          letterSpacing: DS.font.letterSpacing.tight
        }}>
          Catálogo Digital
        </h1>
        <p style={{ color: DS.color.textSecondary, margin: 0, fontSize: DS.font.size.md }}>
          Explore nossa coleção de tecidos e cores.
        </p>
      </div>

      <div style={{ 
        maxWidth: '600px', 
        margin: `0 auto ${DS.spacing(8)} auto`,
        display: 'flex',
        flexDirection: 'column',
        gap: DS.spacing(4)
      }}>
        <input 
          type="text"
          placeholder="Buscar por nome ou SKU..."
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
          style={{
            width: '100%',
            padding: DS.spacing(3),
            borderRadius: DS.radius.md,
            border: `1px solid ${DS.color.border}`,
            fontSize: DS.font.size.base,
            outline: 'none',
            transition: 'border-color 0.2s',
            background: DS.color.surface
          }}
          onFocus={e => e.target.style.borderColor = DS.color.focus}
          onBlur={e => e.target.style.borderColor = DS.color.border}
        />
        
        {compositions.length > 0 && (
          <div style={{ display: 'flex', gap: DS.spacing(2), overflowX: 'auto', paddingBottom: DS.spacing(2) }}>
            <button
              onClick={() => setSelectedComposition('')}
              style={{
                padding: `${DS.spacing(1.5)} ${DS.spacing(3)}`,
                borderRadius: DS.radius.pill,
                border: `1px solid ${selectedComposition === '' ? DS.color.textPrimary : DS.color.border}`,
                background: selectedComposition === '' ? DS.color.textPrimary : 'transparent',
                color: selectedComposition === '' ? '#fff' : DS.color.textSecondary,
                fontSize: DS.font.size.sm,
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                transition: 'all 0.2s'
              }}
            >
              Todos
            </button>
            {compositions.map(comp => (
              <button
                key={comp}
                onClick={() => setSelectedComposition(comp)}
                style={{
                  padding: `${DS.spacing(1.5)} ${DS.spacing(3)}`,
                  borderRadius: DS.radius.pill,
                  border: `1px solid ${selectedComposition === comp ? DS.color.textPrimary : DS.color.border}`,
                  background: selectedComposition === comp ? DS.color.textPrimary : 'transparent',
                  color: selectedComposition === comp ? '#fff' : DS.color.textSecondary,
                  fontSize: DS.font.size.sm,
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                  transition: 'all 0.2s'
                }}
              >
                {comp}
              </button>
            ))}
          </div>
        )}
      </div>
      
      {loading ? (
        <div style={{ padding: DS.spacing(10), textAlign: 'center', color: DS.color.textMuted }}>
          Carregando catálogo...
        </div>
      ) : (
        <div style={{ 
          display: 'grid', 
          gap: DS.spacing(4), 
          gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
          marginTop: DS.spacing(6)
        }}>
          {filteredTissues.map((item: any) => (
            <div 
              key={item.id} 
              onClick={() => navigate(`/vitrine/tecido/${item.id}`)}
              style={{
                border: `1px solid ${DS.color.border}`,
                borderRadius: DS.radius.lg,
                padding: DS.spacing(5),
                cursor: 'pointer',
                background: DS.color.surface,
                transition: 'all 0.2s ease',
                boxShadow: DS.shadow.xs
              }}
              onMouseOver={e => {
                e.currentTarget.style.transform = 'translateY(-2px)'
                e.currentTarget.style.boxShadow = DS.shadow.md
                e.currentTarget.style.borderColor = DS.color.borderStrong
              }}
              onMouseOut={e => {
                e.currentTarget.style.transform = 'translateY(0)'
                e.currentTarget.style.boxShadow = DS.shadow.xs
                e.currentTarget.style.borderColor = DS.color.border
              }}
            >
              <h3 style={{ 
                margin: `0 0 ${DS.spacing(1)} 0`, 
                fontSize: DS.font.size.lg, 
                color: DS.color.textPrimary,
                fontWeight: DS.font.weightMedium
              }}>
                {item.name}
              </h3>
              <div style={{ 
                fontSize: DS.font.size.sm, 
                color: DS.color.textSecondary,
                display: 'flex',
                alignItems: 'center',
                gap: DS.spacing(2),
                flexWrap: 'wrap'
              }}>
                <span style={{ 
                  background: DS.color.surfaceAlt, 
                  padding: '2px 6px', 
                  borderRadius: DS.radius.sm,
                  fontFamily: 'monospace'
                }}>
                  {item.sku}
                </span>
                <span>{item.width}cm</span>
                {item.composition && (
                  <span style={{ color: DS.color.textMuted }}>• {item.composition}</span>
                )}
              </div>
            </div>
          ))}
          {filteredTissues.length === 0 && (
            <div style={{ gridColumn: '1/-1', padding: DS.spacing(10), textAlign: 'center', color: DS.color.textMuted }}>
              Nenhum tecido encontrado para sua busca.
            </div>
          )}
        </div>
      )}
    </div>
  )
}
