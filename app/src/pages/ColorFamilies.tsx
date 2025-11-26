import React, { useEffect, useState } from 'react'
import { DS } from '@/design-system/tokens'
import { Container } from '@/design-system/components'
import { familyStatsDb, type FamilyStat } from '@/lib/db'
import { labToHex } from '@/lib/color-utils'
import HueWheel from '@/components/HueWheel'

export default function ColorFamilies() {
  const [stats, setStats] = useState<FamilyStat[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadStats()
  }, [])

  async function loadStats() {
    try {
      const data = await familyStatsDb.list()
      setStats(data)
    } catch (e) {
      console.error('Failed to load family stats:', e)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Container padY={12}>
      <div style={{ display: 'grid', gap: DS.spacing(8) }}>
        {/* Header */}
        <div>
          <h1 style={{
            color: DS.color.textPrimary,
            margin: 0,
            fontSize: DS.font.size.display,
            fontWeight: DS.font.weightLight,
            letterSpacing: DS.font.letterSpacing.tight,
            marginBottom: DS.spacing(2)
          }}>
            🎨 Famílias de Cores
          </h1>
          <p style={{
            color: DS.color.textSecondary,
            margin: 0,
            fontSize: DS.font.size.base,
            maxWidth: 640
          }}>
            Classificação automática baseada nos nomes das cores cadastradas. 
            Cada família mostra sua faixa de matiz no espaço de cores LAB.
          </p>
        </div>

        {/* Main Visualization */}
        <div style={{
          background: DS.color.surface,
          border: `1px solid ${DS.color.border}`,
          borderRadius: DS.radius.lg,
          padding: DS.spacing(8),
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: DS.spacing(6)
        }}>
          <HueWheel 
            size={360}
            forcedAngle={undefined}
            staticMode={true}
          />
          
          {/* Legend - Beautiful chips */}
          {stats.length > 0 && (
            <div style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: DS.spacing(3),
              justifyContent: 'center',
              maxWidth: 800
            }}>
              {stats.map(fam => {
                const color = getRepresentativeColor(fam.hueAvg)
                return (
                  <div
                    key={fam.familyName}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: DS.spacing(2),
                      padding: `${DS.spacing(2)} ${DS.spacing(3)}`,
                      background: DS.color.bgHover,
                      border: `1px solid ${DS.color.border}`,
                      borderRadius: DS.radius.pill,
                      fontSize: DS.font.size.sm,
                      fontWeight: DS.font.weightMedium
                    }}
                  >
                    <div style={{
                      width: 16,
                      height: 16,
                      borderRadius: '50%',
                      background: color,
                      border: `1px solid ${DS.color.border}`
                    }} />
                    <span style={{ color: DS.color.textPrimary }}>
                      {fam.familyName}
                    </span>
                    <span style={{ color: DS.color.textSecondary, fontSize: DS.font.size.xs }}>
                      ({fam.colorCount})
                    </span>
                  </div>
                )
              })}
            </div>
          )}
          
          {loading && (
            <div style={{ color: DS.color.textSecondary, fontSize: DS.font.size.sm }}>
              Carregando estatísticas...
            </div>
          )}
          
          {!loading && stats.length === 0 && (
            <div style={{
              color: DS.color.textSecondary,
              fontSize: DS.font.size.sm,
              textAlign: 'center',
              padding: DS.spacing(4)
            }}>
              Nenhuma cor cadastrada ainda. Vá para Cores e cadastre suas primeiras cores!
            </div>
          )}
        </div>

        {/* Family Cards Grid */}
        {stats.length > 0 && (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
            gap: DS.spacing(6)
          }}>
            {stats.map(family => {
              const primaryColor = getRepresentativeColor(family.hueAvg)
              const gradientEnd = getRepresentativeColor(family.hueAvg, 0.15)
              
              return (
                <div
                  key={family.familyName}
                  style={{
                    background: `linear-gradient(135deg, ${DS.color.surface} 0%, ${gradientEnd} 100%)`,
                    border: `2px solid ${primaryColor}`,
                    borderRadius: DS.radius.lg,
                    padding: DS.spacing(6),
                    boxShadow: DS.shadow.sm
                  }}
                >
                  {/* Family Header */}
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: DS.spacing(3),
                    marginBottom: DS.spacing(4)
                  }}>
                    <div style={{
                      width: 48,
                      height: 48,
                      borderRadius: '50%',
                      background: primaryColor,
                      border: `2px solid ${DS.color.border}`,
                      boxShadow: DS.shadow.md
                    }} />
                    <div style={{ flex: 1 }}>
                      <div style={{
                        color: DS.color.textPrimary,
                        fontSize: DS.font.size.lg,
                        fontWeight: DS.font.weightSemibold,
                        marginBottom: 2
                      }}>
                        {family.familyName}
                      </div>
                      <div style={{
                        color: DS.color.textSecondary,
                        fontSize: DS.font.size.sm
                      }}>
                        {family.colorCount} {family.colorCount === 1 ? 'cor' : 'cores'}
                      </div>
                    </div>
                  </div>

                  {/* Stats */}
                  <div style={{ display: 'grid', gap: DS.spacing(2) }}>
                    <StatRow 
                      label="Faixa de matiz"
                      value={`${Math.round(family.hueMin)}° - ${Math.round(family.hueMax)}°`}
                    />
                    <StatRow 
                      label="Matiz médio"
                      value={`${Math.round(family.hueAvg)}°`}
                    />
                    <StatRow 
                      label="Amplitude"
                      value={`${Math.round(getHueSpan(family.hueMin, family.hueMax))}°`}
                    />
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* Info Section */}
        <div style={{
          background: DS.color.surface,
          borderRadius: DS.radius.lg,
          padding: DS.spacing(8),
          border: `1px solid ${DS.color.border}`,
          boxShadow: DS.shadow.sm
        }}>
          <h3 style={{
            color: DS.color.textPrimary,
            fontSize: DS.font.size.xl,
            fontWeight: DS.font.weightSemibold,
            marginTop: 0,
            marginBottom: DS.spacing(5)
          }}>
            ℹ️ Como Funciona
          </h3>
          <div style={{ display: 'grid', gap: DS.spacing(3) }}>
            <InfoRow 
              title="Classificação automática"
              description="A família é extraída da primeira palavra do nome da cor que você cadastra"
            />
            <InfoRow 
              title="Limites adaptativos"
              description="O sistema calcula os limites de matiz (hue) baseado nas cores existentes em cada família"
            />
            <InfoRow 
              title="Novas famílias"
              description="Ao cadastrar 'Salmão Claro', uma nova família 'Salmão' é criada automaticamente"
            />
            <InfoRow 
              title="Fallback LAB"
              description="Cores sem nome específico usam classificação matemática por espaço LAB"
            />
            <InfoRow 
              title="Atualização em tempo real"
              description="Estatísticas são atualizadas automaticamente sempre que você adiciona uma nova cor"
            />
          </div>
        </div>
      </div>
    </Container>
  )
}

// Helper Components
function StatRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={{
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: `${DS.spacing(2)} 0`
    }}>
      <span style={{
        color: DS.color.textSecondary,
        fontSize: DS.font.size.sm
      }}>
        {label}
      </span>
      <span style={{
        color: DS.color.textPrimary,
        fontSize: DS.font.size.sm,
        fontWeight: DS.font.weightMedium,
        fontFamily: 'monospace'
      }}>
        {value}
      </span>
    </div>
  )
}

function InfoRow({ title, description }: { title: string; description: string }) {
  return (
    <div style={{ display: 'flex', gap: DS.spacing(3), alignItems: 'flex-start' }}>
      <span style={{
        color: DS.color.accent,
        fontSize: 20,
        fontWeight: DS.font.weightBold,
        minWidth: 24
      }}>
        •
      </span>
      <div style={{ flex: 1 }}>
        <div style={{
          color: DS.color.textPrimary,
          fontSize: DS.font.size.base,
          fontWeight: DS.font.weightSemibold,
          marginBottom: 4,
          lineHeight: 1.4
        }}>
          {title}
        </div>
        <div style={{
          color: DS.color.textSecondary,
          fontSize: DS.font.size.sm,
          lineHeight: 1.6
        }}>
          {description}
        </div>
      </div>
    </div>
  )
}

// Helper Functions
function getRepresentativeColor(hueAvg: number, opacity: number = 1): string {
  // Convert hue to LAB with vibrant chroma and medium lightness
  const L = 60
  const chroma = 60
  const hueRad = (hueAvg * Math.PI) / 180
  const a = chroma * Math.cos(hueRad)
  const b = chroma * Math.sin(hueRad)
  
  const hex = labToHex({ L, a, b })
  
  if (opacity < 1) {
    // Convert to rgba for opacity
    const r = parseInt(hex.slice(1, 3), 16)
    const g = parseInt(hex.slice(3, 5), 16)
    const bl = parseInt(hex.slice(5, 7), 16)
    return `rgba(${r}, ${g}, ${bl}, ${opacity})`
  }
  
  return hex
}

function getHueSpan(min: number, max: number): number {
  // Handle wrap-around (e.g., 350° to 10°)
  if (max < min) {
    return (360 - min) + max
  }
  return max - min
}
