import React, { useEffect, useState } from 'react'
import { 
  Title, Text, Paper, Group, Stack, SimpleGrid, Card, 
  ThemeIcon, Box, Badge, Container, Grid, Alert, List
} from '@mantine/core'
import { IconInfoCircle, IconPalette } from '@tabler/icons-react'
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
    <Box p="xl" style={{ maxWidth: 1600, margin: '0 auto' }}>
      <Stack gap="xl">
        {/* Header */}
        <div>
          <Title order={2} fw={300} style={{ letterSpacing: -0.5 }}>Famílias de Cores</Title>
            <Text c="dimmed" size="sm">
            Classificação automática baseada nos nomes das cores cadastradas. 
            Cada família mostra sua faixa de matiz no espaço de cores LAB.
          </Text>
        </div>

        <Grid gutter="xl">
          {/* Left Column: Chart & Legend */}
          <Grid.Col span={{ base: 12, lg: 5 }}>
            <Paper withBorder p="xl" radius="md" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 32 }}>
              <Box style={{ position: 'relative' }}>
                <HueWheel 
                  size={320}
                  forcedAngle={undefined}
                  staticMode={true}
                />
                <div style={{ 
                  position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
                  textAlign: 'center', pointerEvents: 'none'
                }}>
                  <Text size="xs" c="dimmed" tt="uppercase" fw={700}>Total</Text>
                  <Text size="xl" fw={700} style={{ fontSize: 32, lineHeight: 1 }}>
                    {stats.reduce((acc, curr) => acc + curr.colorCount, 0)}
                  </Text>
                  <Text size="xs" c="dimmed">Cores</Text>
                </div>
              </Box>
              
              {/* Legend Grid */}
              <Box w="100%">
                <Text size="sm" c="dimmed" tt="uppercase" fw={700} mb="md" ta="center">Legenda de Famílias</Text>
                <SimpleGrid cols={{ base: 2, sm: 3 }} spacing="xs">
                  {stats.map(fam => {
                    const color = getRepresentativeColor(fam.hueAvg)
                    return (
                      <Group key={fam.familyName} gap="xs" wrap="nowrap" style={{ 
                        padding: '6px 10px', 
                        borderRadius: 6, 
                        backgroundColor: 'var(--mantine-color-gray-0)',
                        border: '1px solid var(--mantine-color-gray-2)'
                      }}>
                        <Box w={12} h={12} style={{ borderRadius: '50%', backgroundColor: color, flexShrink: 0 }} />
                        <div style={{ overflow: 'hidden' }}>
                          <Text size="sm" fw={600} truncate>{fam.familyName}</Text>
                          <Text size="xs" c="dimmed" lh={1}>{fam.colorCount} cores</Text>
                        </div>
                      </Group>
                    )
                  })}
                </SimpleGrid>
              </Box>
            </Paper>
          </Grid.Col>

          {/* Right Column: Detailed Cards */}
          <Grid.Col span={{ base: 12, lg: 7 }}>
            <Stack gap="md">
              <Alert variant="light" color="blue" title="Como Funciona" icon={<IconInfoCircle size={16} />}>
                <List size="sm" spacing="xs" center>
                  <List.Item>A família é extraída da primeira palavra do nome da cor (ex: &quot;Azul Marinho&quot; → &quot;Azul&quot;).</List.Item>
                  <List.Item>O sistema calcula os limites de matiz (hue) baseado nas cores existentes.</List.Item>
                  <List.Item>Cores sem nome específico usam classificação matemática por espaço LAB.</List.Item>
                </List>
              </Alert>              <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
                {stats.map(family => {
                  const primaryColor = getRepresentativeColor(family.hueAvg)
                  return (
                    <Card key={family.familyName} withBorder padding="lg" radius="md">
                      <Group justify="space-between" mb="md">
                        <Group gap="sm">
                          <Box w={32} h={32} style={{ borderRadius: 8, backgroundColor: primaryColor }} />
                          <div>
                            <Text fw={700} size="lg" lh={1.2}>{family.familyName}</Text>
                            <Text size="xs" c="dimmed">{family.colorCount} cores cadastradas</Text>
                          </div>
                        </Group>
                        <Badge variant="light" color="gray" size="lg">
                          {formatHueValue(family.hueAvg)}
                        </Badge>
                      </Group>

                      <Stack gap="xs" bg="gray.0" p="xs" style={{ borderRadius: 8 }}>
                        <Group justify="space-between">
                          <Text size="xs" c="dimmed">Faixa de Matiz</Text>
                          <Text size="xs" fw={500} ff="monospace">{formatHueRange(family.hueMin, family.hueMax)}</Text>
                        </Group>
                        <Group justify="space-between">
                          <Text size="xs" c="dimmed">Amplitude</Text>
                          <Text size="xs" fw={500} ff="monospace">{formatHueSpan(family.hueMin, family.hueMax)}</Text>
                        </Group>
                      </Stack>
                    </Card>
                  )
                })}
              </SimpleGrid>
            </Stack>
          </Grid.Col>
        </Grid>
      </Stack>
    </Box>
  )
}

// Helper Functions
function getRepresentativeColor(hueAvg: number | null | undefined, opacity: number = 1): string {
  // Convert hue to LAB with vibrant chroma and medium lightness
  const safeHue = normalizeHue(hueAvg)
  const L = 60
  const chroma = 60
  const hueRad = (safeHue * Math.PI) / 180
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

function getHueSpan(min: number | null | undefined, max: number | null | undefined): number | null {
  // Handle wrap-around (e.g., 350° to 10°)
  const safeMin = typeof min === 'number' ? normalizeHue(min) : null
  const safeMax = typeof max === 'number' ? normalizeHue(max) : null
  if (safeMin === null || safeMax === null) return null
  if (safeMax < safeMin) {
    return (360 - safeMin) + safeMax
  }
  return safeMax - safeMin
}

function normalizeHue(value: number | null | undefined, fallback = 0): number {
  if (typeof value === 'number' && Number.isFinite(value)) {
    const wrapped = value % 360
    return wrapped < 0 ? wrapped + 360 : wrapped
  }
  return fallback
}

function formatHueValue(value: number | null | undefined): string {
  const hue = normalizeHue(value, NaN)
  return Number.isNaN(hue) ? '—' : `${Math.round(hue)}°`
}

function formatHueRange(min: number | null | undefined, max: number | null | undefined): string {
  const hueMin = normalizeHue(min, NaN)
  const hueMax = normalizeHue(max, NaN)
  if (Number.isNaN(hueMin) || Number.isNaN(hueMax)) {
    return '—'
  }
  return `${Math.round(hueMin)}° - ${Math.round(hueMax)}°`
}

function formatHueSpan(min: number | null | undefined, max: number | null | undefined): string {
  const span = getHueSpan(min, max)
  if (span === null) return '—'
  return `${Math.round(span)}°`
}
