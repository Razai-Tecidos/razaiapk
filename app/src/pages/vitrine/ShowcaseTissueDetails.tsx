import React, { useEffect, useState } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { DS } from '@/design-system/tokens'

function WhatsAppButton({ text, url }: { text: string, url: string }) {
  const handleShare = () => {
    const fullText = `${text} ${url}`
    const waUrl = `https://wa.me/?text=${encodeURIComponent(fullText)}`
    window.open(waUrl, '_blank')
  }

  return (
    <button 
      onClick={handleShare}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: DS.spacing(2),
        padding: `${DS.spacing(2)} ${DS.spacing(4)}`,
        background: '#25D366',
        color: '#fff',
        border: 'none',
        borderRadius: DS.radius.md,
        fontWeight: DS.font.weightMedium,
        fontSize: DS.font.size.sm,
        cursor: 'pointer',
        transition: 'opacity 0.2s'
      }}
      onMouseOver={e => e.currentTarget.style.opacity = '0.9'}
      onMouseOut={e => e.currentTarget.style.opacity = '1'}
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" style={{ marginRight: 4 }}><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/></svg>
      Falar com Vendedor
    </button>
  )
}

export default function ShowcaseTissueDetails() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [tissue, setTissue] = useState<any>(null)
  const [links, setLinks] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!id) return
    ;(async () => {
      setLoading(true)
      try {
        const { data: tissueData, error: tError } = await supabase
          .from('tissues')
          .select('*')
          .eq('id', id)
          .single()
        
        if (tError) throw tError
        setTissue(tissueData)

        const { data: linksData, error: lError } = await supabase
          .from('links')
          .select('*, tissues(*), colors(*)')
          .eq('tissue_id', id)
          .eq('tissue_id', id)
        
        if (lError) throw lError
        
        const mappedLinks = (linksData || []).map((l: any) => ({
          id: l.id,
          skuFilho: l.sku_filho,
          colorName: l.colors?.name,
          hex: l.colors?.hex,
          status: l.status,
          image: l.image_path ? supabase.storage.from('tissue-images').getPublicUrl(l.image_path).data.publicUrl : null
        }))
        
        setLinks(mappedLinks)
      } catch (e) {
        console.error(e)
        setError('Não foi possível carregar os detalhes.')
      } finally {
        setLoading(false)
      }
    })()
  }, [id])

  if (loading) {
    return (
      <div style={{ padding: DS.spacing(10), textAlign: 'center', color: DS.color.textMuted }}>
        Carregando...
      </div>
    )
  }

  if (error || !tissue) {
    return (
      <div style={{ padding: DS.spacing(10), textAlign: 'center' }}>
        <h2 style={{ color: DS.color.textPrimary, marginBottom: DS.spacing(4) }}>{error || 'Tecido não encontrado'}</h2>
        <Link to="/vitrine" style={{ color: DS.color.info, textDecoration: 'underline' }}>
          Voltar ao Catálogo
        </Link>
      </div>
    )
  }

  return (
    <div className="notranslate" translate="no" style={{ paddingBottom: DS.spacing(10) }}>
      <Link to="/vitrine" style={{ 
        color: DS.color.textSecondary, 
        textDecoration: 'none', 
        fontSize: DS.font.size.sm,
        display: 'inline-flex',
        alignItems: 'center',
        gap: DS.spacing(1),
        marginBottom: DS.spacing(6)
      }}>
        ← Voltar ao Catálogo
      </Link>

      <div style={{ 
        marginBottom: DS.spacing(8),
        padding: DS.spacing(6),
        background: DS.color.surfaceAlt,
        borderRadius: DS.radius.lg,
        border: `1px solid ${DS.color.border}`
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: DS.spacing(4) }}>
          <div>
            <h1 style={{
              color: DS.color.textPrimary, 
              margin: `0 0 ${DS.spacing(2)} 0`, 
              fontSize: DS.font.size.display, 
              fontWeight: DS.font.weightLight,
              letterSpacing: DS.font.letterSpacing.tight
            }}>
              {tissue.name}
            </h1>
            <div style={{ 
              display: 'flex', 
              flexWrap: 'wrap',
              gap: DS.spacing(4), 
              color: DS.color.textSecondary,
              fontSize: DS.font.size.sm,
              alignItems: 'center'
            }}>
              <span style={{ background: '#fff', padding: '4px 8px', borderRadius: DS.radius.sm, border: `1px solid ${DS.color.border}` }}>
                SKU: <strong>{tissue.sku}</strong>
              </span>
              {tissue.width && <span>Largura: <strong>{tissue.width}cm</strong></span>}
              {tissue.composition && <span>Composição: <strong>{tissue.composition}</strong></span>}
            </div>
          </div>
          <WhatsAppButton 
            text={`Olá! Gostaria de saber mais sobre o tecido *${tissue.name}* (${tissue.sku}).`}
            url={window.location.href}
          />
        </div>
      </div>

      <h2 style={{ 
        fontSize: DS.font.size.xl, 
        fontWeight: DS.font.weightMedium, 
        color: DS.color.textPrimary,
        marginBottom: DS.spacing(6),
        borderBottom: `1px solid ${DS.color.border}`,
        paddingBottom: DS.spacing(2)
      }}>
        Cores Disponíveis ({links.length})
      </h2>

      {links.length === 0 ? (
        <p style={{ color: DS.color.textMuted, fontStyle: 'italic' }}>Nenhuma cor cadastrada.</p>
      ) : (
        <div style={{ 
          display: 'grid', 
          gap: DS.spacing(4), 
          gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))' 
        }}>
          {links.map(link => (
            <Link 
              key={link.id}
              to={`/vitrine/link/${link.id}`}
              style={{
                border: `1px solid ${DS.color.border}`,
                borderRadius: DS.radius.lg,
                overflow: 'hidden',
                textDecoration: 'none',
                display: 'block',
                background: DS.color.surface,
                transition: 'all 0.2s ease',
                boxShadow: DS.shadow.xs,
                opacity: link.status === 'Inativo' ? 0.7 : 1
              }}
              onMouseOver={e => {
                e.currentTarget.style.transform = 'translateY(-4px)'
                e.currentTarget.style.boxShadow = DS.shadow.md
              }}
              onMouseOut={e => {
                e.currentTarget.style.transform = 'translateY(0)'
                e.currentTarget.style.boxShadow = DS.shadow.xs
              }}
            >
              <div style={{ aspectRatio: '1/1', background: DS.color.surfaceAlt, position: 'relative' }}>
                {link.image ? (
                  <img 
                    src={link.image} 
                    alt={link.colorName} 
                    style={{ width: '100%', height: '100%', objectFit: 'cover', filter: link.status === 'Inativo' ? 'grayscale(30%)' : 'none' }} 
                  />
                ) : (
                  <div style={{ 
                    width: '100%', 
                    height: '100%', 
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'center',
                    background: link.hex || DS.color.surfaceAlt,
                    color: link.hex ? '#fff' : DS.color.textMuted
                  }}>
                    {!link.hex && 'Sem foto'}
                  </div>
                )}
              </div>
              <div style={{ padding: DS.spacing(3) }}>
                <div style={{ fontWeight: DS.font.weightMedium, color: DS.color.textPrimary, marginBottom: DS.spacing(1), fontSize: DS.font.size.sm }}>
                  {link.colorName || 'Cor sem nome'}
                </div>
                <div style={{ fontSize: DS.font.size.xs, color: DS.color.textSecondary, fontFamily: 'monospace' }}>
                  {link.skuFilho}
                </div>
                <div style={{ 
                  marginTop: DS.spacing(2), 
                  fontSize: '11px', 
                  fontWeight: 600, 
                  color: link.status === 'Inativo' ? '#E03131' : '#2F9E44',
                  textTransform: 'uppercase'
                }}>
                  {link.status === 'Inativo' ? 'Indisponível' : 'Disponível'}
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
