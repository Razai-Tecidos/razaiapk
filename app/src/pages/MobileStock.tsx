import React, { useState, useEffect, useMemo } from 'react'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import { db, linksDb } from '@/lib/db'
import { CutterMode } from '@/modules/cutter-mode/CutterMode'
import { notifications } from '@mantine/notifications'
import LazyImage from '@/components/LazyImage'
import { DS } from '@/design-system/tokens'

// Icons
import { 
  IconCut, 
  IconBook, 
  IconSearch, 
  IconLogout, 
  IconAlertCircle, 
  IconLayersIntersect,
  IconInfoCircle,
  IconHome,
  IconChevronRight,
  IconFilter
} from '@tabler/icons-react'
import { Loader, Modal, Button, Group, Text, Badge, Drawer, Stack, TextInput } from '@mantine/core'

type Tab = 'home' | 'tissues' | 'catalog'

export default function MobileStock() {
  const { role, signOut } = useAuth()
  const [activeTab, setActiveTab] = useState<Tab>('home')
  const [isCutterModeOpen, setIsCutterModeOpen] = useState(false)

  // Data State
  const [stats, setStats] = useState({ tissues: 0, colors: 0 })
  const [loadingStats, setLoadingStats] = useState(true)

  useEffect(() => {
    fetchStats()
  }, [])

  async function fetchStats() {
    try {
      const [tissuesResponse, colorsResponse] = await Promise.all([
        supabase.from('tissues').select('*', { count: 'exact', head: true }),
        supabase.from('colors').select('*', { count: 'exact', head: true }),
      ])
      setStats({
        tissues: tissuesResponse.count || 0,
        colors: colorsResponse.count || 0,
      })
    } catch (error) {
      console.error('Error fetching stats:', error)
    } finally {
      setLoadingStats(false)
    }
  }

  const renderContent = () => {
    switch (activeTab) {
      case 'home':
        return (
          <HomeView 
            role={role} 
            stats={stats} 
            loading={loadingStats} 
            onOpenCutter={() => setIsCutterModeOpen(true)}
            onNavigate={setActiveTab}
            onSignOut={signOut}
          />
        )
      case 'tissues':
        return <TissuesView />
      case 'catalog':
        return <CatalogView />
      default:
        return null
    }
  }

  return (
    <div style={{ 
      height: '100dvh', 
      display: 'flex', 
      flexDirection: 'column',
      background: '#F9FAFB', 
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
      overflow: 'hidden'
    }}>
      {/* Main Content Area - Scrollable */}
      <div style={{ flex: 1, overflowY: 'auto', paddingBottom: 80 }}>
        {renderContent()}
      </div>

      {/* Bottom Navigation */}
      <div style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        background: 'white',
        borderTop: '1px solid #E5E7EB',
        display: 'flex',
        justifyContent: 'space-around',
        padding: '12px 0',
        paddingBottom: 'max(12px, env(safe-area-inset-bottom))',
        zIndex: 100
      }}>
        <NavButton 
          active={activeTab === 'home'} 
          onClick={() => setActiveTab('home')} 
          icon={IconHome} 
          label="Início" 
        />
        <NavButton 
          active={activeTab === 'tissues'} 
          onClick={() => setActiveTab('tissues')} 
          icon={IconLayersIntersect} 
          label="Tecidos" 
        />
        <NavButton 
          active={activeTab === 'catalog'} 
          onClick={() => setActiveTab('catalog')} 
          icon={IconBook} 
          label="Catálogo" 
        />
      </div>

      <CutterMode isOpen={isCutterModeOpen} onClose={() => setIsCutterModeOpen(false)} />
    </div>
  )
}

function NavButton({ active, onClick, icon: Icon, label }: any) {
  return (
    <button 
      onClick={onClick}
      style={{
        background: 'none',
        border: 'none',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 4,
        color: active ? '#3B82F6' : '#9CA3AF',
        cursor: 'pointer',
        flex: 1
      }}
    >
      <Icon size={24} stroke={active ? 2.5 : 1.5} />
      <span style={{ fontSize: 10, fontWeight: active ? 600 : 400 }}>{label}</span>
    </button>
  )
}

// --- Views ---

function HomeView({ role, stats, loading, onOpenCutter, onNavigate, onSignOut }: any) {
  const [searchQuery, setSearchQuery] = useState('')

  return (
    <div style={{ padding: 20 }}>
      {/* Hero Card */}
      <div style={{
        background: '#1F2937',
        borderRadius: '24px',
        padding: '24px',
        color: 'white',
        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
        marginBottom: 24
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px' }}>
          <div>
            <div style={{ fontSize: '10px', letterSpacing: '4px', textTransform: 'uppercase', color: 'rgba(255,255,255,0.6)', marginBottom: '4px' }}>
              RAZAI {role === 'admin' ? 'ADMIN' : ''}
            </div>
            <div style={{ fontSize: '28px', fontWeight: 700, lineHeight: 1.1 }}>
              Operação Cutter
            </div>
          </div>
          <button 
            onClick={onSignOut}
            style={{ background: '#0F172A', border: 'none', padding: '8px', borderRadius: '12px', cursor: 'pointer', color: 'white' }}
          >
            <IconLogout size={20} />
          </button>
        </div>

        <div style={{ marginBottom: '24px' }}>
          <button 
            onClick={onOpenCutter}
            style={{
              width: '100%', display: 'flex', alignItems: 'center',
              background: '#3B82F6', border: 'none', borderRadius: '20px',
              padding: '16px 20px', marginBottom: '12px', cursor: 'pointer', color: 'white', textAlign: 'left'
            }}
          >
            <IconCut size={24} style={{ marginRight: '12px' }} />
            <div>
              <div style={{ fontWeight: 600, fontSize: '16px' }}>Registrar falta</div>
              <div style={{ fontSize: '12px', color: '#DBEAFE' }}>Fluxo guiado</div>
            </div>
          </button>
        </div>

        <div style={{ display: 'flex', gap: '12px' }}>
          <StatBox label="Tecidos" value={stats.tissues} loading={loading} />
          <StatBox label="Cores" value={stats.colors} loading={loading} />
        </div>
      </div>

      {/* Shortcuts */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ fontSize: '16px', fontWeight: 600, color: '#1F2937', marginBottom: '12px' }}>Acessos rápidos</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px' }}>
          <ShortcutCard 
            label="Registrar falta" desc="Fluxo guiado" icon={IconAlertCircle} 
            onClick={onOpenCutter} 
          />
          <ShortcutCard 
            label="Abrir tecidos" desc="Lista completa" icon={IconLayersIntersect} 
            onClick={() => onNavigate('tissues')} 
          />
          <ShortcutCard 
            label="Ver catálogo" desc="Compartilhar" icon={IconBook} 
            onClick={() => onNavigate('catalog')} 
          />
        </div>
      </div>
    </div>
  )
}

function StatBox({ label, value, loading }: any) {
  return (
    <div style={{ flex: 1, background: 'rgba(255,255,255,0.1)', borderRadius: '16px', padding: '16px' }}>
      {loading ? (
        <div style={{ height: '28px', background: 'rgba(255,255,255,0.1)', borderRadius: '4px' }} />
      ) : (
        <>
          <div style={{ fontSize: '24px', fontWeight: 700 }}>{value}</div>
          <div style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '1px', color: 'rgba(255,255,255,0.6)', marginTop: '4px' }}>{label}</div>
        </>
      )}
    </div>
  )
}

function ShortcutCard({ label, desc, icon: Icon, onClick }: any) {
  return (
    <button
      onClick={onClick}
      style={{
        width: 'calc(50% - 6px)', background: 'white', border: '1px solid #E5E7EB',
        borderRadius: '20px', padding: '16px', textAlign: 'left', cursor: 'pointer',
        display: 'flex', flexDirection: 'column', alignItems: 'flex-start'
      }}
    >
      <div style={{ width: '36px', height: '36px', borderRadius: '18px', border: '1px solid #E5E7EB', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '12px', color: '#3B82F6' }}>
        <Icon size={18} />
      </div>
      <div style={{ fontWeight: 600, fontSize: '14px', color: '#1F2937' }}>{label}</div>
      <div style={{ fontSize: '11px', color: '#6B7280', marginTop: '4px' }}>{desc}</div>
    </button>
  )
}

function TissuesView() {
  const [tissues, setTissues] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  useEffect(() => {
    db.listTissues().then(setTissues).finally(() => setLoading(false))
  }, [])

  const filtered = useMemo(() => {
    if (!search) return tissues
    const q = search.toLowerCase()
    return tissues.filter(t => t.name.toLowerCase().includes(q) || t.sku.toLowerCase().includes(q))
  }, [tissues, search])

  return (
    <div style={{ padding: 20 }}>
      <div style={{ marginBottom: 20 }}>
        <h2 style={{ fontSize: 24, fontWeight: 700, margin: '0 0 8px 0' }}>Tecidos</h2>
        <div style={{ display: 'flex', alignItems: 'center', background: 'white', border: '1px solid #E5E7EB', borderRadius: 12, padding: '8px 12px' }}>
          <IconSearch size={18} color="#9CA3AF" />
          <input 
            placeholder="Buscar tecido..." 
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{ border: 'none', outline: 'none', marginLeft: 8, flex: 1, fontSize: 16 }}
          />
        </div>
      </div>

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}><Loader color="gray" /></div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {filtered.map(t => (
            <div key={t.id} style={{ background: 'white', padding: 16, borderRadius: 16, border: '1px solid #E5E7EB', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontWeight: 600, fontSize: 16, color: '#1F2937' }}>{t.name}</div>
                <div style={{ fontSize: 13, color: '#6B7280' }}>{t.sku} • {t.width}cm</div>
              </div>
              <IconChevronRight size={20} color="#D1D5DB" />
            </div>
          ))}
          {filtered.length === 0 && <div style={{ textAlign: 'center', color: '#9CA3AF', padding: 20 }}>Nenhum tecido encontrado</div>}
        </div>
      )}
    </div>
  )
}

function CatalogView() {
  const [links, setLinks] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [selectedLink, setSelectedLink] = useState<any>(null)

  useEffect(() => {
    linksDb.list().then(ls => setLinks(ls.filter((l: any) => l.status === 'Ativo'))).finally(() => setLoading(false))
  }, [])

  const filtered = useMemo(() => {
    if (!search) return links
    const q = search.toLowerCase()
    return links.filter(l => 
      l.nomeCompleto.toLowerCase().includes(q) || 
      l.skuFilho.toLowerCase().includes(q) ||
      l.tissueName.toLowerCase().includes(q)
    )
  }, [links, search])

  return (
    <div style={{ padding: 20 }}>
      <div style={{ marginBottom: 20 }}>
        <h2 style={{ fontSize: 24, fontWeight: 700, margin: '0 0 8px 0' }}>Catálogo</h2>
        <div style={{ display: 'flex', alignItems: 'center', background: 'white', border: '1px solid #E5E7EB', borderRadius: 12, padding: '8px 12px' }}>
          <IconSearch size={18} color="#9CA3AF" />
          <input 
            placeholder="Buscar no catálogo..." 
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{ border: 'none', outline: 'none', marginLeft: 8, flex: 1, fontSize: 16 }}
          />
        </div>
      </div>

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}><Loader color="gray" /></div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          {filtered.map(l => (
            <div 
              key={l.id} 
              onClick={() => setSelectedLink(l)}
              style={{ background: 'white', borderRadius: 16, overflow: 'hidden', border: '1px solid #E5E7EB', cursor: 'pointer' }}
            >
              <div style={{ aspectRatio: '1', background: '#F3F4F6', position: 'relative' }}>
                {l.imageThumb || l.image ? (
                  <LazyImage src={l.imageThumb || l.image} alt={l.nomeCompleto} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#9CA3AF', fontSize: 12 }}>Sem foto</div>
                )}
              </div>
              <div style={{ padding: 12 }}>
                <div style={{ fontWeight: 600, fontSize: 14, color: '#1F2937', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{l.nomeCompleto}</div>
                <div style={{ fontSize: 11, color: '#6B7280' }}>{l.skuFilho}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal 
        opened={!!selectedLink} 
        onClose={() => setSelectedLink(null)} 
        title={selectedLink?.nomeCompleto}
        centered
        size="lg"
      >
        {selectedLink && (
          <Stack>
            <div style={{ aspectRatio: '1', background: '#F3F4F6', borderRadius: 8, overflow: 'hidden' }}>
               <LazyImage src={selectedLink.image || selectedLink.imageThumb} alt={selectedLink.nomeCompleto} style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
            </div>
            <Group justify="space-between">
              <div>
                <Text size="xs" c="dimmed">SKU</Text>
                <Text fw={700}>{selectedLink.skuFilho}</Text>
              </div>
              <div>
                <Text size="xs" c="dimmed">Tecido</Text>
                <Text fw={500}>{selectedLink.tissueName}</Text>
              </div>
              <div>
                <Text size="xs" c="dimmed">Cor</Text>
                <Text fw={500}>{selectedLink.colorName}</Text>
              </div>
            </Group>
            <Button fullWidth onClick={() => setSelectedLink(null)}>Fechar</Button>
          </Stack>
        )}
      </Modal>
    </div>
  )
}
