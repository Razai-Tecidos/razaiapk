import React, { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
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
        padding: `${DS.spacing(3)} ${DS.spacing(6)}`,
        background: '#25D366',
        color: '#fff',
        border: 'none',
        borderRadius: DS.radius.md,
        fontWeight: DS.font.weightSemibold,
        fontSize: DS.font.size.base,
        cursor: 'pointer',
        marginTop: DS.spacing(8),
        width: '100%',
        justifyContent: 'center',
        transition: 'opacity 0.2s'
      }}
      onMouseOver={e => e.currentTarget.style.opacity = '0.9'}
      onMouseOut={e => e.currentTarget.style.opacity = '1'}
    >
      <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" style={{ marginRight: 8 }}><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/></svg>
      Falar com Vendedor
    </button>
  )
}

export default function ShowcaseLinkDetails() {
  const { id } = useParams<{ id: string }>()
  const [link, setLink] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!id) return
    ;(async () => {
      setLoading(true)
      try {
        const { data, error } = await supabase
          .from('links')
          .select('*, tissues(*), colors(*)')
          .eq('id', id)
          .single()
        
        if (error) throw error
        
        setLink({
          ...data,
          image: data.image_path ? supabase.storage.from('tissue-images').getPublicUrl(data.image_path).data.publicUrl : null,
          tissueName: data.tissues?.name,
          colorName: data.colors?.name,
          hex: data.colors?.hex,
          width: data.tissues?.width,
          composition: data.tissues?.composition,
          skuFilho: data.sku_filho
        })
      } catch (e) {
        console.error(e)
        setError('Produto não encontrado')
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

  if (error || !link) {
    return (
      <div style={{ padding: DS.spacing(10), textAlign: 'center' }}>
        <h2 style={{ color: DS.color.textPrimary, marginBottom: DS.spacing(4) }}>{error || 'Produto não encontrado'}</h2>
        <Link to="/vitrine" style={{ color: DS.color.info, textDecoration: 'underline' }}>
          Voltar ao Catálogo
        </Link>
      </div>
    )
  }

  return (
    <div className="notranslate" translate="no" style={{ paddingBottom: DS.spacing(10) }}>
      <div style={{ marginBottom: DS.spacing(6) }}>
        <Link to={`/vitrine/tecido/${link.tissue_id}`} style={{ 
          color: DS.color.textSecondary, 
          textDecoration: 'none', 
          fontSize: DS.font.size.sm,
          display: 'inline-flex',
          alignItems: 'center',
          gap: DS.spacing(1)
        }}>
          ← Voltar para {link.tissueName}
        </Link>
      </div>

      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', 
        gap: DS.spacing(8),
        alignItems: 'start'
      }}>
        {/* Image Section */}
        <div style={{ 
          background: DS.color.surfaceAlt, 
          borderRadius: DS.radius.xl, 
          overflow: 'hidden',
          border: `1px solid ${DS.color.border}`,
          aspectRatio: '1/1',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: DS.shadow.sm
        }}>
          {link.image ? (
            <img 
              src={link.image} 
              alt={link.skuFilho} 
              style={{ width: '100%', height: '100%', objectFit: 'contain' }} 
            />
          ) : (
            <div style={{ 
              width: '100%', 
              height: '100%', 
              background: link.hex || DS.color.surfaceAlt,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: link.hex ? '#fff' : DS.color.textMuted
            }}>
              {!link.hex && 'Sem imagem'}
            </div>
          )}
        </div>

        {/* Details Section */}
        <div>
          <h1 style={{ 
            color: DS.color.textPrimary, 
            margin: `0 0 ${DS.spacing(2)} 0`, 
            fontSize: DS.font.size.display, 
            fontWeight: DS.font.weightLight,
            lineHeight: DS.font.lineHeight.tight,
            letterSpacing: DS.font.letterSpacing.tight
          }}>
            {link.tissueName} - {link.colorName}
          </h1>
          
          <div style={{ 
            fontSize: DS.font.size.lg, 
            color: DS.color.textSecondary, 
            marginBottom: DS.spacing(6),
            fontFamily: 'monospace',
            background: DS.color.surfaceAlt,
            display: 'inline-block',
            padding: '4px 8px',
            borderRadius: DS.radius.md
          }}>
            {link.skuFilho}
          </div>

          <div style={{ display: 'grid', gap: DS.spacing(4) }}>
            <DetailRow label="Tecido" value={link.tissueName} />
            <DetailRow label="Cor" value={link.colorName} />
            <DetailRow label="Composição" value={link.composition} />
            <DetailRow label="Largura" value={link.width ? `${link.width} cm` : '—'} />
          </div>

          <WhatsAppButton 
            text={`Olá! Gostaria de saber mais sobre o produto *${link.tissueName} - ${link.colorName}* (${link.skuFilho}).`}
            url={window.location.href}
          />

          {link.hex && (
            <div style={{ marginTop: DS.spacing(6) }}>
              <div style={{ fontSize: DS.font.size.xs, color: DS.color.textSecondary, marginBottom: DS.spacing(2) }}>
                Referência de Cor
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: DS.spacing(3) }}>
                <div style={{ 
                  width: 48, 
                  height: 48, 
                  borderRadius: DS.radius.md, 
                  background: link.hex,
                  border: `1px solid ${DS.color.border}`,
                  boxShadow: DS.shadow.xs
                }} />
                <span style={{ fontFamily: 'monospace', color: DS.color.textPrimary }}>
                  {link.hex}
                </span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function DetailRow({ label, value }: { label: string, value?: string | number }) {
  if (!value) return null
  return (
    <div style={{ 
      display: 'grid', 
      gridTemplateColumns: '120px 1fr', 
      paddingBottom: DS.spacing(2),
      borderBottom: `1px solid ${DS.color.border}`
    }}>
      <span style={{ color: DS.color.textSecondary, fontSize: DS.font.size.sm }}>{label}</span>
      <span style={{ color: DS.color.textPrimary, fontWeight: DS.font.weightMedium }}>{value}</span>
    </div>
  )
}
