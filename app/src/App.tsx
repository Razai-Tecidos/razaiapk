import React from 'react'
import { Outlet, Link, useLocation } from 'react-router-dom'
import { Burger, Drawer, Stack, Group, Box } from '@mantine/core'
import { useDisclosure } from '@mantine/hooks'
import { DS } from '@/design-system/tokens'
import { APP_VERSION } from './version'

function Header() {
  const { pathname } = useLocation()
  const [opened, { toggle, close }] = useDisclosure(false)

  const links = [
    { to: '/', label: 'Início' },
    { to: '/tecidos', label: 'Tecidos' },
    { to: '/cores', label: 'Cores' },
    { to: '/familias', label: 'Famílias' },
    { to: '/estampas', label: 'Estampas' },
    { to: '/tecido-cor', label: 'Tecido-Cor' },
    { to: '/tecido-estampa', label: 'Tecido-Estampa' },
    { to: '/recolor', label: 'Recolorir' },
    { to: '/catalogo', label: 'Catálogo' },
    { to: '/estoque', label: 'Estoque' },
    { to: '/exportacoes', label: 'Exportações' },
    { to: '/configuracoes', label: 'Config' },
    { to: '/vitrine', label: 'Vitrine ↗' }
  ]

  const LinkItem = ({ to, label, mobile = false }: { to: string, label: string, mobile?: boolean }) => {
    const isActive = to === '/' ? pathname === '/' : pathname.startsWith(to)
    return (
      <Link 
        to={to} 
        onClick={mobile ? close : undefined}
        style={{ 
          color: isActive ? DS.color.accent : DS.color.textSecondary,
          textDecoration: 'none',
          fontSize: mobile ? DS.font.size.md : DS.font.size.sm,
          fontWeight: isActive ? DS.font.weightMedium : DS.font.weightRegular,
          transition: 'all 0.2s ease',
          padding: mobile ? `${DS.spacing(3)} ${DS.spacing(4)}` : `${DS.spacing(2)} ${DS.spacing(3)}`,
          borderRadius: DS.radius.md,
          background: isActive ? DS.color.surfaceAlt : 'transparent',
          display: 'block',
          width: mobile ? '100%' : 'auto'
        }}
      >
        {label}
      </Link>
    )
  }

  return (
    <header style={{
      padding: `${DS.spacing(3)} ${DS.spacing(4)}`,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      borderBottom: `1px solid ${DS.color.border}`,
      background: DS.color.bg,
      position: 'sticky',
      top: 0,
      zIndex: 100,
      height: 64,
      boxSizing: 'border-box'
    }}>
      <div style={{ display:'flex', alignItems:'center', gap: DS.spacing(3) }}>
        <div style={{ 
          fontWeight: DS.font.weightSemibold, 
          fontSize: DS.font.size.lg,
          color: DS.color.textPrimary,
          letterSpacing: DS.font.letterSpacing.tight
        }}>
          Razai Tools
        </div>
        <span style={{
          fontSize: DS.font.size.xs,
          padding: `${DS.spacing(0.5)} ${DS.spacing(2)}`,
          background: DS.color.surfaceAlt,
          border: `1px solid ${DS.color.border}`,
          borderRadius: DS.radius.pill,
          color: DS.color.textSecondary,
          fontWeight: DS.font.weightMedium
        }}>
          v{APP_VERSION}
        </span>
      </div>

      {/* Desktop Nav */}
      <Box visibleFrom="lg">
        <nav style={{ display:'flex', gap: DS.spacing(1), alignItems: 'center', height: '100%' }}>
          {links.map((link) => (
            <LinkItem key={link.to} {...link} />
          ))}
        </nav>
      </Box>

      {/* Mobile Nav Trigger */}
      <Box hiddenFrom="lg">
        <Burger opened={opened} onClick={toggle} size="sm" />
      </Box>

      {/* Mobile Drawer */}
      <Drawer 
        opened={opened} 
        onClose={close} 
        size="75%" 
        padding="md" 
        hiddenFrom="lg" 
        zIndex={1000}
        title="Menu"
      >
        <Stack gap="xs">
          {links.map((link) => (
            <LinkItem key={link.to} {...link} mobile />
          ))}
        </Stack>
      </Drawer>
    </header>
  )
}

export default function App() {
  return (
    <div style={{ 
      minHeight: '100dvh', 
      background: DS.color.bg,
      color: DS.color.textPrimary,
      display: 'flex',
      flexDirection: 'column'
    }}>
      <Header />
      <main style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        <Outlet />
      </main>
    </div>
  )
}
