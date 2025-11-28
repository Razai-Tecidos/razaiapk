import React from 'react'
import { Outlet, Link, useLocation } from 'react-router-dom'
import { Burger, Drawer, Stack, Group, Box, Button, Tooltip } from '@mantine/core'
import { useDisclosure } from '@mantine/hooks'
import { DS } from '@/design-system/tokens'
import { APP_VERSION } from './version'
import { supabase } from '@/lib/supabase'
import { IconBrandWindows, IconLogout, IconExternalLink } from '@tabler/icons-react'

function Header() {
  const { pathname } = useLocation()
  const [opened, { toggle, close }] = useDisclosure(false)

  const handleLogout = async () => {
    await supabase.auth.signOut()
    window.location.href = '/login'
  }

  const links = [
    { to: '/', label: 'Início' },
    { to: '/tecidos', label: 'Tecidos' },
    { to: '/cores', label: 'Cores' },
    { to: '/familias', label: 'Famílias' },
    { to: '/estampas', label: 'Estampas' },
    { to: '/tecido-cor', label: 'Vínculos' },
    { to: '/tecido-estampa', label: 'Vínc. Estampa' },
    { to: '/recolor', label: 'Recolorir' },
    { to: '/catalogo', label: 'Catálogo' },
    { to: '/estoque', label: 'Estoque' },
    { to: '/exportacoes', label: 'Exportações' },
    { to: '/configuracoes', label: 'Config' },
  ]

  const LinkItem = ({ to, label, mobile = false }: { to: string, label: string, mobile?: boolean }) => {
    const isActive = to === '/' ? pathname === '/' : pathname.startsWith(to)
    
    if (mobile) {
      return (
        <Link 
          to={to} 
          onClick={close}
          style={{ 
            color: isActive ? DS.color.brand : DS.color.textSecondary,
            textDecoration: 'none',
            fontSize: DS.font.size.md,
            fontWeight: isActive ? DS.font.weightSemibold : DS.font.weightMedium,
            padding: `${DS.spacing(3)} ${DS.spacing(4)}`,
            borderRadius: DS.radius.md,
            background: isActive ? DS.color.surfaceAlt : 'transparent',
            display: 'block',
            width: '100%'
          }}
        >
          {label}
        </Link>
      )
    }

    return (
      <Link 
        to={to} 
        style={{ 
          color: isActive ? DS.color.textInvert : DS.color.textMuted,
          textDecoration: 'none',
          fontSize: DS.font.size.sm,
          fontWeight: isActive ? DS.font.weightMedium : DS.font.weightRegular,
          transition: 'all 0.2s ease',
          padding: `${DS.spacing(1.5)} ${DS.spacing(3)}`,
          borderRadius: DS.radius.md,
          background: isActive ? 'rgba(255,255,255,0.1)' : 'transparent',
          display: 'block',
        }}
        onMouseOver={e => {
          if (!isActive) e.currentTarget.style.color = DS.color.textInvert
        }}
        onMouseOut={e => {
          if (!isActive) e.currentTarget.style.color = DS.color.textMuted
        }}
      >
        {label}
      </Link>
    )
  }

  return (
    <header style={{
      padding: `0 ${DS.spacing(6)}`,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      background: DS.color.brand,
      position: 'sticky',
      top: 0,
      zIndex: 100,
      height: 64,
      boxShadow: DS.shadow.md
    }}>
      <div style={{ display:'flex', alignItems:'center', gap: DS.spacing(3) }}>
        <div style={{ 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center', 
          width: 32, 
          height: 32, 
          background: 'rgba(255,255,255,0.1)', 
          borderRadius: DS.radius.md,
          color: '#fff'
        }}>
          <IconBrandWindows size={18} />
        </div>
        <div style={{ 
          fontWeight: DS.font.weightBold, 
          fontSize: DS.font.size.lg,
          color: DS.color.textInvert,
          letterSpacing: '-0.02em'
        }}>
          Razai Tools
        </div>
        <span style={{
          fontSize: '10px',
          padding: '2px 6px',
          background: 'rgba(255,255,255,0.1)',
          borderRadius: DS.radius.pill,
          color: 'rgba(255,255,255,0.6)',
          fontWeight: DS.font.weightMedium,
          fontFamily: DS.font.familyMono
        }}>
          v{APP_VERSION}
        </span>
      </div>

      {/* Desktop Nav */}
      <Box visibleFrom="xl">
        <nav style={{ display:'flex', gap: DS.spacing(1), alignItems: 'center', height: '100%' }}>
          {links.map((link) => (
            <LinkItem key={link.to} {...link} />
          ))}
        </nav>
      </Box>

      <Group gap="xs">
        <Tooltip label="Abrir Vitrine Pública">
          <Button 
            component={Link}
            to="/vitrine"
            target="_blank"
            variant="subtle" 
            size="xs" 
            style={{ color: DS.color.textMuted }}
          >
            <IconExternalLink size={18} />
          </Button>
        </Tooltip>
        
        <Tooltip label="Sair">
          <Button 
            variant="subtle" 
            size="xs" 
            color="gray" 
            onClick={handleLogout}
            style={{ color: DS.color.textMuted }}
          >
            <IconLogout size={18} />
          </Button>
        </Tooltip>

        {/* Mobile Nav Trigger */}
        <Box hiddenFrom="xl">
          <Burger opened={opened} onClick={toggle} size="sm" color="white" />
        </Box>
      </Group>

      {/* Mobile Drawer */}
      <Drawer 
        opened={opened} 
        onClose={close} 
        size="300px" 
        padding="md" 
        hiddenFrom="xl" 
        zIndex={1000}
        title={<span style={{ fontWeight: 700, fontSize: 18 }}>Menu</span>}
      >
        <Stack gap="xs">
          {links.map((link) => (
            <LinkItem key={link.to} {...link} mobile />
          ))}
          <Button 
            variant="light" 
            color="red" 
            onClick={handleLogout}
            fullWidth
            leftSection={<IconLogout size={16} />}
            mt="xl"
          >
            Sair do Sistema
          </Button>
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
      flexDirection: 'column',
      fontFamily: DS.font.familySans
    }}>
      <Header />
      <main style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        <Outlet />
      </main>
    </div>
  )
}
