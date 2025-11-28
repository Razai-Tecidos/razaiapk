import React, { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import { CutterMode } from '@/modules/cutter-mode/CutterMode'
import { notifications } from '@mantine/notifications'

// Icons
import { 
  IconCut, 
  IconBook, 
  IconSearch, 
  IconLogout, 
  IconSettings, 
  IconAlertCircle, 
  IconLayersIntersect,
  IconInfoCircle
} from '@tabler/icons-react'

export default function MobileStock() {
  const { user, signOut, role } = useAuth()
  const [stats, setStats] = useState({ tissues: 0, colors: 0 })
  const [loading, setLoading] = useState(true)
  const [isCutterModeOpen, setIsCutterModeOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')

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
      setLoading(false)
    }
  }

  const handleSignOut = async () => {
    await signOut()
  }

  return (
    <div style={{ 
      minHeight: '100dvh', 
      background: '#F9FAFB', 
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif'
    }}>
      {/* Hero Card */}
      <div style={{
        background: '#1F2937', // Gray 800
        margin: '20px',
        marginBottom: '16px',
        borderRadius: '24px',
        padding: '24px',
        color: 'white',
        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
      }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px' }}>
          <div>
            <div style={{ 
              fontSize: '10px', 
              letterSpacing: '4px', 
              textTransform: 'uppercase', 
              color: 'rgba(255,255,255,0.6)',
              marginBottom: '4px'
            }}>
              RAZAI {role === 'admin' ? 'ADMIN' : ''}
            </div>
            <div style={{ fontSize: '28px', fontWeight: 700, lineHeight: 1.1 }}>
              Operação Cutter
            </div>
            <div style={{ 
              color: 'rgba(255,255,255,0.8)', 
              marginTop: '8px', 
              fontSize: '13px', 
              maxWidth: '200px',
              lineHeight: '1.4'
            }}>
              Controle de estoque impecável com poucos toques.
            </div>
          </div>
          <button 
            onClick={handleSignOut}
            style={{
              background: '#0F172A',
              border: 'none',
              padding: '8px',
              borderRadius: '12px',
              cursor: 'pointer',
              color: 'white',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            <IconLogout size={20} />
          </button>
        </div>

        {/* Hero Actions */}
        <div style={{ marginBottom: '24px' }}>
          <button 
            onClick={() => setIsCutterModeOpen(true)}
            style={{
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              background: '#3B82F6', // Blue 500
              border: 'none',
              borderRadius: '20px',
              padding: '16px 20px',
              marginBottom: '12px',
              cursor: 'pointer',
              color: 'white',
              textAlign: 'left'
            }}
          >
            <IconCut size={24} style={{ marginRight: '12px' }} />
            <div>
              <div style={{ fontWeight: 600, fontSize: '16px' }}>Registrar falta</div>
              <div style={{ fontSize: '12px', color: '#DBEAFE' }}>Fluxo guiado</div>
            </div>
          </button>

          <button 
            onClick={() => notifications.show({ title: 'Em breve', message: 'Catálogo mobile em desenvolvimento', color: 'blue' })}
            style={{
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'white',
              border: 'none',
              borderRadius: '20px',
              padding: '12px',
              cursor: 'pointer',
              color: '#3B82F6',
              fontWeight: 600,
              fontSize: '14px'
            }}
          >
            <IconBook size={18} style={{ marginRight: '8px' }} />
            Abrir catálogo
          </button>
        </div>

        {/* Stats Grid */}
        <div style={{ display: 'flex', gap: '12px' }}>
          <div style={{ 
            flex: 1, 
            background: 'rgba(255,255,255,0.1)', 
            borderRadius: '16px', 
            padding: '16px' 
          }}>
            {loading ? (
              <div style={{ height: '28px', background: 'rgba(255,255,255,0.1)', borderRadius: '4px' }} />
            ) : (
              <>
                <div style={{ fontSize: '24px', fontWeight: 700 }}>{stats.tissues}</div>
                <div style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '1px', color: 'rgba(255,255,255,0.6)', marginTop: '4px' }}>Tecidos</div>
              </>
            )}
          </div>
          <div style={{ 
            flex: 1, 
            background: 'rgba(255,255,255,0.1)', 
            borderRadius: '16px', 
            padding: '16px' 
          }}>
            {loading ? (
              <div style={{ height: '28px', background: 'rgba(255,255,255,0.1)', borderRadius: '4px' }} />
            ) : (
              <>
                <div style={{ fontSize: '24px', fontWeight: 700 }}>{stats.colors}</div>
                <div style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '1px', color: 'rgba(255,255,255,0.6)', marginTop: '4px' }}>Cores</div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Shortcuts Section */}
      <div style={{ padding: '0 20px 20px 20px' }}>
        <div style={{ fontSize: '16px', fontWeight: 600, color: '#1F2937', marginBottom: '12px' }}>
          Acessos rápidos
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px' }}>
          {[
            { label: 'Registrar falta', desc: 'Fluxo guiado', icon: IconAlertCircle, action: () => setIsCutterModeOpen(true) },
            { label: 'Abrir tecidos', desc: 'Lista completa', icon: IconLayersIntersect, action: () => notifications.show({ title: 'Em breve', message: 'Lista de tecidos em desenvolvimento', color: 'blue' }) },
            { label: 'Ver catálogo', desc: 'Compartilhar', icon: IconBook, action: () => notifications.show({ title: 'Em breve', message: 'Catálogo em desenvolvimento', color: 'blue' }) },
          ].map((item, i) => (
            <button
              key={i}
              onClick={item.action}
              style={{
                width: 'calc(50% - 6px)',
                background: 'white',
                border: '1px solid #E5E7EB',
                borderRadius: '20px',
                padding: '16px',
                textAlign: 'left',
                cursor: 'pointer',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'flex-start'
              }}
            >
              <div style={{ 
                width: '36px', 
                height: '36px', 
                borderRadius: '18px', 
                border: '1px solid #E5E7EB', 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center',
                marginBottom: '12px',
                color: '#3B82F6'
              }}>
                <item.icon size={18} />
              </div>
              <div style={{ fontWeight: 600, fontSize: '14px', color: '#1F2937' }}>{item.label}</div>
              <div style={{ fontSize: '11px', color: '#6B7280', marginTop: '4px' }}>{item.desc}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Search Panel */}
      <div style={{ padding: '0 20px 20px 20px' }}>
        <div style={{ 
          background: 'white', 
          borderRadius: '20px', 
          border: '1px solid #E5E7EB',
          padding: '16px'
        }}>
          <div style={{ fontSize: '16px', fontWeight: 600, color: '#1F2937', marginBottom: '12px' }}>
            Busca global
          </div>
          
          <div style={{ 
            display: 'flex', 
            alignItems: 'center', 
            background: '#F3F4F6', 
            borderRadius: '12px', 
            padding: '12px',
            border: '1px solid #E5E7EB'
          }}>
            <IconSearch size={18} color="#9CA3AF" style={{ marginRight: '8px' }} />
            <input 
              placeholder="Digite código, tecido ou cor"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                border: 'none',
                background: 'transparent',
                fontSize: '16px',
                width: '100%',
                outline: 'none',
                color: '#1F2937'
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  setIsCutterModeOpen(true)
                  // Ideally pass the query to CutterMode, but for now just open it
                }
              }}
            />
          </div>

          <div style={{ 
            marginTop: '16px', 
            display: 'flex', 
            alignItems: 'center', 
            background: '#EFF6FF', 
            padding: '12px', 
            borderRadius: '12px' 
          }}>
            <div style={{ 
              width: '40px', 
              height: '40px', 
              borderRadius: '20px', 
              background: '#DBEAFE', 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center',
              marginRight: '12px',
              color: '#3B82F6'
            }}>
              <IconInfoCircle size={20} />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 600, fontSize: '14px', color: '#1F2937' }}>Tudo em um só lugar</div>
              <div style={{ fontSize: '12px', color: '#6B7280' }}>Pesquise por SKU, cor ou tecido.</div>
            </div>
          </div>
        </div>
      </div>

      {/* Cutter Mode Overlay */}
      <CutterMode isOpen={isCutterModeOpen} onClose={() => setIsCutterModeOpen(false)} />
    </div>
  )
}
