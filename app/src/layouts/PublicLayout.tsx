import React from 'react'
import { Outlet, Link } from 'react-router-dom'
import { DS } from '@/design-system/tokens'
import { useAuth } from '@/context/AuthContext'

export default function PublicLayout() {
  const { user } = useAuth()

  return (
    <div className="notranslate" translate="no" style={{ 
      minHeight: '100dvh', 
      background: DS.color.bg,
      color: DS.color.textPrimary,
      display: 'flex',
      flexDirection: 'column',
      fontFamily: DS.font.familySans
    }}>
      <header style={{
        padding: `${DS.spacing(4)} ${DS.spacing(6)}`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        borderBottom: `1px solid ${DS.color.border}`,
        background: 'rgba(255,255,255,0.9)',
        backdropFilter: 'blur(8px)',
        position: 'sticky',
        top: 0,
        zIndex: 100
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: DS.spacing(3) }}>
          <Link to="/vitrine" style={{ 
            fontWeight: DS.font.weightBold, 
            fontSize: DS.font.size.lg,
            color: DS.color.textPrimary,
            textDecoration: 'none',
            letterSpacing: DS.font.letterSpacing.tight
          }}>
            RAZAI
          </Link>
          <div style={{ width: 1, height: 16, background: DS.color.border }}></div>
          <Link to="/vitrine" style={{ 
            color: DS.color.textSecondary,
            textDecoration: 'none',
            fontSize: DS.font.size.sm,
            fontWeight: DS.font.weightMedium
          }}>
            Catálogo
          </Link>
        </div>

        {user && (
          <Link to="/" style={{ 
            fontSize: DS.font.size.sm,
            fontWeight: DS.font.weightMedium,
            color: DS.color.textPrimary,
            textDecoration: 'none',
            padding: `${DS.spacing(1.5)} ${DS.spacing(3)}`,
            borderRadius: DS.radius.md,
            border: `1px solid ${DS.color.border}`,
            background: DS.color.surface,
            transition: 'all 0.2s'
          }}
          onMouseOver={e => {
            e.currentTarget.style.borderColor = DS.color.textPrimary
            e.currentTarget.style.background = DS.color.surfaceAlt
          }}
          onMouseOut={e => {
            e.currentTarget.style.borderColor = DS.color.border
            e.currentTarget.style.background = DS.color.surface
          }}
          >
            Voltar ao Sistema
          </Link>
        )}
      </header>

      <main style={{ flex: 1, width: '100%', maxWidth: '1200px', margin: '0 auto', padding: DS.spacing(6) }}>
        <Outlet />
      </main>

      <footer style={{
        padding: DS.spacing(8),
        textAlign: 'center',
        color: DS.color.textMuted,
        fontSize: DS.font.size.xs,
        borderTop: `1px solid ${DS.color.border}`,
        marginTop: 'auto',
        background: DS.color.surfaceAlt
      }}>
        &copy; {new Date().getFullYear()} Razai. Todos os direitos reservados.
      </footer>
    </div>
  )
}
