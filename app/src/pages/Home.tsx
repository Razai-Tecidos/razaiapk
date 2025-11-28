import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { 
  Title, Text, Paper, Group, Stack, SimpleGrid, Card, 
  ThemeIcon, Box, Badge, Container, Grid, Alert, List,
  Button, ActionIcon, Modal, TextInput, Select, FileInput
} from '@mantine/core'
import { useForm } from '@mantine/form'
import { 
  IconNeedleThread, IconPalette, IconTexture, IconLink, 
  IconPhoto, IconColorFilter, IconFileText, IconPackage, 
  IconSettings, IconScissors, IconPlus, IconDownload,
  IconUpload
} from '@tabler/icons-react'
import { db, colorsDb, patternsDb } from '@/lib/db'
import { importFullBackup } from '@/lib/import'
import { notifications } from '@mantine/notifications'
import { getLastUploadRecord } from '@/lib/cloud-sync'
import { CutterMode } from '@/modules/cutter-mode'
import { ActivityCard } from '@/components/ActivityCard'

type ModalType = 'tissue' | 'color' | 'pattern' | 'import' | null

interface ActivityItem {
  id: string
  type: 'tissue' | 'color' | 'pattern'
  name: string
  detail: string
  date: Date
}

export default function Home() {
  const navigate = useNavigate()
  const [activeModal, setActiveModal] = useState<ModalType>(null)
  const [stats, setStats] = useState({ tissues: 0, colors: 0, patterns: 0 })
  const [recentActivity, setRecentActivity] = useState<ActivityItem[]>([])
  const [lastSync, setLastSync] = useState<{ ok: boolean; ts: number } | null>(null)
  
  // Form states
  const [tissueName, setTissueName] = useState('')
  const [tissueType, setTissueType] = useState('Liso')
  const [colorName, setColorName] = useState('')
  const [colorHex, setColorHex] = useState('')
  const [patternName, setPatternName] = useState('')
  const [patternFamily, setPatternFamily] = useState('Outras')
  const [patternFile, setPatternFile] = useState<File | null>(null)
  const [importing, setImporting] = useState(false)

  // Cutter Mode
  const [cutterModalOpen, setCutterModalOpen] = useState(false)

  useEffect(() => {
    loadStats()
    const syncRec = getLastUploadRecord()
    if (syncRec) {
      setLastSync({ ok: syncRec.ok, ts: syncRec.ts })
    }
  }, [])

  async function loadStats() {
    try {
      await db.init()
      const [tissues, colors, patterns] = await Promise.all([
        db.listTissues(),
        colorsDb.listColors(),
        patternsDb.listPatterns()
      ])
      setStats({
        tissues: tissues.length,
        colors: colors.length,
        patterns: patterns.length
      })

      // Build recent activity
      const all: ActivityItem[] = []
      tissues.forEach(t => all.push({
        id: t.id,
        type: 'tissue',
        name: t.name,
        detail: t.sku,
        date: new Date(t.createdAt)
      }))
      colors.forEach(c => all.push({
        id: c.id,
        type: 'color',
        name: c.name,
        detail: c.sku,
        date: new Date(c.createdAt)
      }))
      patterns.forEach(p => all.push({
        id: p.id,
        type: 'pattern',
        name: p.name,
        detail: p.family,
        date: new Date(p.createdAt)
      }))

      all.sort((a, b) => b.date.getTime() - a.date.getTime())
      setRecentActivity(all.slice(0, 5))

    } catch (error) {
      console.error('Failed to load stats:', error)
    }
  }

  async function handleCreateTissue() {
    if (!tissueName.trim()) return
    try {
      await db.createTissue({ 
        name: tissueName.trim(), 
        width: 0,
        composition: '',
        color: undefined
      })
      notifications.show({ title: 'Sucesso', message: 'Tecido criado com sucesso', color: 'green' })
      setActiveModal(null)
      setTissueName('')
      setTissueType('Liso')
      await loadStats()
      navigate('/tecidos')
    } catch (error: any) {
      notifications.show({ title: 'Erro', message: error.message || 'Falha ao criar tecido', color: 'red' })
    }
  }

  async function handleCreateColor() {
    if (!colorName.trim()) return
    try {
      await colorsDb.createColor({
        name: colorName.trim(),
        hex: colorHex.trim() || undefined,
        labL: undefined,
        labA: undefined,
        labB: undefined
      })
      notifications.show({ title: 'Sucesso', message: 'Cor criada com sucesso', color: 'green' })
      setActiveModal(null)
      setColorName('')
      setColorHex('')
      await loadStats()
      navigate('/cores')
    } catch (error: any) {
      notifications.show({ title: 'Erro', message: error.message || 'Falha ao criar cor', color: 'red' })
    }
  }

  async function handleCreatePattern() {
    if (!patternName.trim()) return
    try {
      let base64: string | undefined
      if (patternFile) {
        const reader = new FileReader()
        base64 = await new Promise<string>((resolve, reject) => {
          reader.onload = () => resolve(reader.result as string)
          reader.onerror = reject
          reader.readAsDataURL(patternFile)
        })
      }
      await patternsDb.createPattern({
        name: patternName.trim(),
        family: patternFamily.trim() || 'Outras'
      })
      notifications.show({ title: 'Sucesso', message: 'Estampa criada com sucesso', color: 'green' })
      setActiveModal(null)
      setPatternName('')
      setPatternFile(null)
      await loadStats()
      navigate('/estampas')
    } catch (error: any) {
      notifications.show({ title: 'Erro', message: error.message || 'Falha ao criar estampa', color: 'red' })
    }
  }

  async function handleImportBackup(file: File) {
    setImporting(true)
    try {
      const text = await file.text()
      await importFullBackup(text, {
        createTissue: (input) => db.createTissue(input),
        createColor: (input) => colorsDb.createColor(input),
        createPattern: (input) => patternsDb.createPattern(input)
      })
      notifications.show({ title: 'Sucesso', message: 'Backup importado com sucesso', color: 'green' })
      setActiveModal(null)
      await loadStats()
    } catch (error: any) {
      notifications.show({ title: 'Erro', message: error.message || 'Falha ao importar backup', color: 'red' })
    } finally {
      setImporting(false)
    }
  }

  const modules = [
    { to: "/tecidos", title: "Tecidos", desc: "Cadastro e visualização completa.", icon: IconNeedleThread, color: "blue" },
    { to: "/cores", title: "Cores", desc: "Gerir famílias e métricas LAB.", icon: IconPalette, color: "pink" },
    { to: "/estampas", title: "Estampas", desc: "Registrar estampas.", icon: IconTexture, color: "grape" },
    { to: "/tecido-cor", title: "Tecido-Cor", desc: "Gerar SKUs filhos.", icon: IconLink, color: "cyan" },
    { to: "/tecido-estampa", title: "Tecido-Estampa", desc: "Gerar SKUs com estampas.", icon: IconPhoto, color: "violet" },
    { to: "/recolor", title: "Recolorir", desc: "Simulação de cores.", icon: IconColorFilter, color: "orange" },
    { to: "/catalogo", title: "Catálogo", desc: "Exportar PDF.", icon: IconFileText, color: "teal" },
    { to: "/estoque", title: "Estoque", desc: "Gestão de rolos e saldo.", icon: IconPackage, color: "green" },
    { to: "/configuracoes", title: "Configurações", desc: "Ajustes do sistema.", icon: IconSettings, color: "gray" },
  ]

  return (
    <Box p="xl" style={{ maxWidth: 1600, margin: '0 auto' }}>
      <Stack gap="xl">
        {/* Hero Section */}
        <Box py="xl">
          <Title order={1} fw={300} style={{ letterSpacing: -1, fontSize: 42 }}>Razai Tools</Title>
          <Text size="lg" c="dimmed" mt="sm" maw={600}>
            Ferramentas profissionais para gestão de tecidos, cores, estampas e geração de SKUs.
          </Text>
          
          <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="lg" mt={40}>
            <Paper withBorder p="lg" radius="md" style={{ textAlign: 'center' }}>
              <Text size="xs" c="dimmed" tt="uppercase" fw={700}>Tecidos</Text>
              <Text fw={700} style={{ fontSize: 42, lineHeight: 1 }} mt="xs">{stats.tissues}</Text>
            </Paper>
            <Paper withBorder p="lg" radius="md" style={{ textAlign: 'center' }}>
              <Text size="xs" c="dimmed" tt="uppercase" fw={700}>Cores</Text>
              <Text fw={700} style={{ fontSize: 42, lineHeight: 1 }} mt="xs">{stats.colors}</Text>
            </Paper>
            <Paper withBorder p="lg" radius="md" style={{ textAlign: 'center' }}>
              <Text size="xs" c="dimmed" tt="uppercase" fw={700}>Estampas</Text>
              <Text fw={700} style={{ fontSize: 42, lineHeight: 1 }} mt="xs">{stats.patterns}</Text>
            </Paper>
          </SimpleGrid>
        </Box>

        <Grid gutter="xl">
          {/* Left Column: Modules */}
          <Grid.Col span={{ base: 12, lg: 8 }}>
            <Text size="sm" c="dimmed" tt="uppercase" fw={700} mb="md" style={{ letterSpacing: 1 }}>Módulos</Text>
            <SimpleGrid cols={{ base: 1, sm: 2, md: 3 }} spacing="md">
              {modules.map((m) => (
                <Paper 
                  key={m.to} 
                  component="a" 
                  href={m.to}
                  onClick={(e) => { e.preventDefault(); navigate(m.to) }}
                  withBorder 
                  p="md" 
                  radius="md" 
                  style={{ 
                    cursor: 'pointer', 
                    transition: 'transform 0.2s, box-shadow 0.2s',
                    textDecoration: 'none',
                    color: 'inherit'
                  }}
                  className="hover-card"
                >
                  <Group align="flex-start" mb="sm">
                    <ThemeIcon size="lg" radius="md" variant="light" color={m.color}>
                      <m.icon size={20} />
                    </ThemeIcon>
                  </Group>
                  <Text fw={600} size="lg">{m.title}</Text>
                  <Text size="sm" c="dimmed" mt={4}>{m.desc}</Text>
                </Paper>
              ))}
            </SimpleGrid>
          </Grid.Col>

          {/* Right Column: Actions & Activity */}
          <Grid.Col span={{ base: 12, lg: 4 }}>
            <Stack gap="xl">
              {/* Quick Actions */}
              <Box>
                <Text size="sm" c="dimmed" tt="uppercase" fw={700} mb="md" style={{ letterSpacing: 1 }}>Ações Rápidas</Text>
                <Stack gap="sm">
                  <Button 
                    color="red" 
                    size="lg" 
                    leftSection={<IconScissors size={20} />} 
                    onClick={() => setCutterModalOpen(true)}
                    fullWidth
                    justify="flex-start"
                  >
                    Avisar Falta (Modo Cortador)
                  </Button>
                  
                  <SimpleGrid cols={2}>
                    <Button variant="light" leftSection={<IconPlus size={16} />} onClick={() => setActiveModal('tissue')}>Tecido</Button>
                    <Button variant="light" leftSection={<IconPlus size={16} />} onClick={() => setActiveModal('color')}>Cor</Button>
                    <Button variant="light" leftSection={<IconPlus size={16} />} onClick={() => setActiveModal('pattern')}>Estampa</Button>
                    <Button variant="subtle" leftSection={<IconDownload size={16} />} onClick={() => setActiveModal('import')}>Importar</Button>
                  </SimpleGrid>
                </Stack>
              </Box>

              {/* Recent Activity */}
              <Paper withBorder p="md" radius="md" bg="gray.0">
                <Group justify="space-between" mb="md">
                  <Text fw={600}>Atividade Recente</Text>
                  {lastSync && (
                    <Badge variant="dot" color={lastSync.ok ? 'green' : 'red'}>
                      Sync
                    </Badge>
                  )}
                </Group>
                
                {recentActivity.length === 0 ? (
                  <Text c="dimmed" size="sm" ta="center" py="md">Sem atividades recentes.</Text>
                ) : (
                  <Stack gap="sm">
                    {recentActivity.map((item) => (
                      <ActivityCard
                        key={`${item.type}-${item.id}`}
                        type={item.type}
                        name={item.name}
                        detail={item.detail}
                        date={item.date}
                      />
                    ))}
                  </Stack>
                )}
              </Paper>
            </Stack>
          </Grid.Col>
        </Grid>
      </Stack>

      {/* Cutter Mode Modal */}
      <CutterMode isOpen={cutterModalOpen} onClose={() => setCutterModalOpen(false)} />

      {/* Modals */}
      <Modal opened={activeModal === 'tissue'} onClose={() => setActiveModal(null)} title="Novo Tecido">
        <Stack gap="md">
          <TextInput
            label="Nome do Tecido"
            placeholder="Ex: Algodão Premium"
            required
            value={tissueName}
            onChange={(e) => setTissueName(e.target.value)}
          />
          <Select
            label="Tipo"
            data={['Liso', 'Estampado', 'Misto']}
            value={tissueType}
            onChange={(v) => setTissueType(v || 'Liso')}
          />
          <Group justify="flex-end" mt="md">
            <Button variant="default" onClick={() => setActiveModal(null)}>Cancelar</Button>
            <Button onClick={handleCreateTissue} disabled={!tissueName.trim()}>Criar Tecido</Button>
          </Group>
        </Stack>
      </Modal>

      <Modal opened={activeModal === 'color'} onClose={() => setActiveModal(null)} title="Nova Cor">
        <Stack gap="md">
          <TextInput
            label="Nome da Cor"
            placeholder="Ex: Vermelho Intenso"
            required
            value={colorName}
            onChange={(e) => setColorName(e.target.value)}
          />
          <TextInput
            label="HEX (opcional)"
            placeholder="#FF0000"
            value={colorHex}
            onChange={(e) => setColorHex(e.target.value)}
          />
          <Text size="xs" c="dimmed">Você pode adicionar valores LAB posteriormente na página de Cores.</Text>
          <Group justify="flex-end" mt="md">
            <Button variant="default" onClick={() => setActiveModal(null)}>Cancelar</Button>
            <Button onClick={handleCreateColor} disabled={!colorName.trim()}>Criar Cor</Button>
          </Group>
        </Stack>
      </Modal>

      <Modal opened={activeModal === 'pattern'} onClose={() => setActiveModal(null)} title="Nova Estampa">
        <Stack gap="md">
          <TextInput
            label="Nome da Estampa"
            placeholder="Ex: Floral Primavera"
            required
            value={patternName}
            onChange={(e) => setPatternName(e.target.value)}
          />
          <FileInput
            label="Imagem (opcional)"
            accept="image/*"
            onChange={setPatternFile}
            leftSection={<IconUpload size={14} />}
          />
          <Group justify="flex-end" mt="md">
            <Button variant="default" onClick={() => setActiveModal(null)}>Cancelar</Button>
            <Button onClick={handleCreatePattern} disabled={!patternName.trim()}>Criar Estampa</Button>
          </Group>
        </Stack>
      </Modal>

      <Modal opened={activeModal === 'import'} onClose={() => setActiveModal(null)} title="Importar Backup">
        <Stack gap="md">
          <Text size="sm">Selecione um arquivo JSON de backup para importar tecidos, cores e estampas.</Text>
          <FileInput
            accept=".json"
            onChange={(file) => {
              if (file) handleImportBackup(file)
            }}
            disabled={importing}
            leftSection={<IconUpload size={14} />}
          />
          {importing && <Text size="sm" c="dimmed">Importando...</Text>}
          <Group justify="flex-end" mt="md">
            <Button variant="default" onClick={() => setActiveModal(null)} disabled={importing}>Cancelar</Button>
          </Group>
        </Stack>
      </Modal>
    </Box>
  )
}
