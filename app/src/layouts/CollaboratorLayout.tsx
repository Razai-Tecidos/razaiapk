import React from 'react'
import { Outlet, Link } from 'react-router-dom'
import { DS } from '@/design-system/tokens'
import { useAuth } from '@/context/AuthContext'
import { Button, Container, Group, Text } from '@mantine/core'

export default function CollaboratorLayout() {
  const { signOut, user } = useAuth()

  return (
    <div style={{ 
      minHeight: '100dvh', 
      background: DS.color.bg,
      color: DS.color.textPrimary,
      display: 'flex',
      flexDirection: 'column'
    }}>
      {/* Header Simplificado Mobile */}
      <header style={{
        padding: `${DS.spacing(3)} ${DS.spacing(4)}`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        borderBottom: `1px solid ${DS.color.border}`,
        background: DS.color.surface,
        position: 'sticky',
        top: 0,
        zIndex: 100
      }}>
        <div style={{ fontWeight: DS.font.weightBold, fontSize: DS.font.size.lg }}>
          Razai Mobile
        </div>
        <Button variant="subtle" size="xs" onClick={() => signOut()} color="gray">
          Sair
        </Button>
      </header>

      <main style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: DS.spacing(2) }}>
        <Outlet />
      </main>
      
      {/* Bottom Navigation (Opcional, se tiver mais de uma tela para colaborador) */}
      {/* <nav>...</nav> */}
    </div>
  )
}
