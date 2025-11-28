import React, { useEffect, useMemo, useState } from 'react'
import { 
  Button, Title, Text, Paper, Group, Stack, TextInput, 
  ActionIcon, Badge, Grid, SimpleGrid, Card, Drawer, NumberInput,
  Box, ColorInput as MantineColorInput, Tooltip, Divider,
  Alert
} from '@mantine/core'
import { useForm } from '@mantine/form'
import { IconSearch, IconPlus, IconPencil, IconTrash, IconDeviceFloppy, IconPalette, IconAlertTriangle } from '@tabler/icons-react'
import { notifications } from '@mantine/notifications'
import { db, colorsDb, settingsDb } from '@/lib/db'
import { normalizeForSearch } from '@/lib/text'
import { ciede2000, inferFamilyFrom, detectFamilyFromName, labFromPartial, labToHex, hexToLab, setHueBoundaries } from '@/lib/color-utils'
import type { Color, ColorInput } from '@/types/color'

export default function Colors() {
  const [items, setItems] = useState<Color[]>([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [deltaThreshold, setDeltaThreshold] = useState<number>(2.0)

  // Test Color State
  const [testHex, setTestHex] = useState('')
  const [testLab, setTestLab] = useState<{L: number, a: number, b: number} | null>(null)

  const form = useForm<ColorInput>({
    initialValues: {
      name: '',
      hex: '',
      labL: undefined,
      labA: undefined,
      labB: undefined
    },
    validate: {
      name: (value) => value.length < 2 ? 'Nome muito curto' : null,
      hex: (value) => value && !/^#?[0-9a-fA-F]{6}$/.test(value) ? 'Hex inválido' : null
    }
  })

  useEffect(() => {
    load()
  }, [])

  async function load() {
    setLoading(true)
    try {
      await db.init()
      const list = await colorsDb.listColors()
      setItems(list)
      
      try {
        const thr = await settingsDb.getDeltaThreshold()
        if (thr) setDeltaThreshold(thr)
        const hb = await settingsDb.getHueBoundaries()
        if (hb) setHueBoundaries(hb)
      } catch {}
    } catch (error) {
      console.error(error)
      notifications.show({ title: 'Erro', message: 'Falha ao carregar cores', color: 'red' })
    } finally {
      setLoading(false)
    }
  }

  const filteredItems = useMemo(() => {
    const q = normalizeForSearch(query)
    let list = items
    if (q) {
      list = list.filter(it =>
        normalizeForSearch(it.name || '').includes(q) ||
        normalizeForSearch(it.sku || '').includes(q) ||
        normalizeForSearch(it.hex || '').includes(q)
      )
    }
    return list.sort((a, b) => a.name.localeCompare(b.name))
  }, [items, query])

  // Color Test Logic
  const testResult = useMemo(() => {
    if (!testLab && !testHex) return null
    
    let lab = testLab
    if (!lab && testHex) {
      const h = testHex.startsWith('#') ? testHex : `#${testHex}`
      if (/^#[0-9a-fA-F]{6}$/.test(h)) {
        const l = hexToLab(h)
        if (l) lab = l
      }
    }

    if (!lab) return null

    let best = Infinity
    let hit: Color | null = null
    
    for (const item of items) {
      const itemLab = labFromPartial({ hex: item.hex, labL: item.labL, labA: item.labA, labB: item.labB })
      if (itemLab) {
        const d = ciede2000(lab, itemLab)
        if (d < best) {
          best = d
          hit = item
        }
      }
    }

    return { best, hit, lab }
  }, [testHex, testLab, items])

  function handleOpenCreate() {
    setEditingId(null)
    form.reset()
    setDrawerOpen(true)
  }

  function handleOpenEdit(item: Color) {
    setEditingId(item.id)
    form.setValues({
      name: item.name,
      hex: item.hex,
      labL: item.labL,
      labA: item.labA,
      labB: item.labB
    })
    setDrawerOpen(true)
  }

  async function handleSubmit(values: ColorInput) {
    setSubmitting(true)
    try {
      // Auto-fill LAB from Hex if missing
      if (values.hex && (values.labL === undefined)) {
        const l = hexToLab(values.hex.startsWith('#') ? values.hex : `#${values.hex}`)
        if (l) {
          values.labL = Number(l.L.toFixed(2))
          values.labA = Number(l.a.toFixed(2))
          values.labB = Number(l.b.toFixed(2))
        }
      }

      if (editingId) {
        await colorsDb.updateColor({ id: editingId, ...values })
        notifications.show({ title: 'Sucesso', message: 'Cor atualizada', color: 'green' })
      } else {
        await colorsDb.createColor(values)
        notifications.show({ title: 'Sucesso', message: 'Cor criada', color: 'green' })
      }
      setDrawerOpen(false)
      await load()
    } catch (error) {
      console.error(error)
      notifications.show({ title: 'Erro', message: 'Falha ao salvar', color: 'red' })
    } finally {
      setSubmitting(false)
    }
  }

  async function handleDelete(id: string, name: string) {
    if (!window.confirm(`Excluir a cor "${name}"?`)) return
    try {
      await colorsDb.deleteColor(id)
      notifications.show({ title: 'Excluído', message: 'Cor removida', color: 'blue' })
      await load()
    } catch (error) {
      notifications.show({ title: 'Erro', message: 'Falha ao excluir', color: 'red' })
    }
  }

  return (
    <Box p="xl" style={{ maxWidth: 1600, margin: '0 auto' }}>
      <Stack gap="xl">
        <Group justify="space-between" align="flex-start">
          <div>
            <Title order={2} fw={300} style={{ letterSpacing: -0.5 }}>Cores</Title>
            <Text c="dimmed" size="sm">Gerencie a paleta de cores e faça testes de similaridade.</Text>
          </div>
          <Button leftSection={<IconPlus size={18} />} onClick={handleOpenCreate} color="blue">
            Nova Cor
          </Button>
        </Group>

        {/* Color Tester Panel */}
        <Paper withBorder p="md" radius="md" bg="gray.0">
          <Title order={4} mb="md" fw={500} c="dimmed">Colorímetro (Teste de Similaridade)</Title>
          <Grid>
            <Grid.Col span={{ base: 12, md: 4 }}>
              <MantineColorInput 
                label="Testar HEX" 
                placeholder="#FF0000" 
                value={testHex} 
                onChange={setTestHex} 
              />
            </Grid.Col>
            <Grid.Col span={{ base: 12, md: 8 }}>
              {testResult && testResult.hit ? (
                <Alert 
                  icon={<IconPalette size={16} />} 
                  title="Resultado da Análise"
                  color={testResult.best < deltaThreshold ? 'red' : 'green'}
                  variant="light"
                >
                  <Group>
                    <Text size="sm">
                      Mais próxima: <strong>{testResult.hit.name}</strong> (ΔE: {testResult.best.toFixed(2)})
                    </Text>
                    {testResult.best < deltaThreshold && (
                      <Badge color="red">Conflito Provável</Badge>
                    )}
                  </Group>
                </Alert>
              ) : (
                <Text size="sm" c="dimmed" mt="lg">Digite um código HEX para verificar conflitos com cores existentes.</Text>
              )}
            </Grid.Col>
          </Grid>
        </Paper>

        <Paper withBorder p="md" radius="md">
          <Group mb="md">
            <TextInput
              placeholder="Buscar cor..."
              leftSection={<IconSearch size={16} />}
              value={query}
              onChange={(e) => setQuery(e.currentTarget.value)}
              style={{ flex: 1 }}
            />
            <Badge variant="light" size="lg" color="gray">
              {filteredItems.length} cores
            </Badge>
          </Group>

          <SimpleGrid cols={{ base: 1, sm: 2, md: 3, lg: 4, xl: 5 }} spacing="md">
            {filteredItems.map(item => {
              const lab = labFromPartial({ hex: item.hex, labL: item.labL, labA: item.labA, labB: item.labB })
              const hex = item.hex || (lab ? labToHex(lab) : '#cccccc')
              const family = detectFamilyFromName(item.name) || 'Outros'

              return (
                <Card key={item.id} withBorder padding={0} radius="md" style={{ height: '100%', overflow: 'hidden', transition: 'transform 0.2s, box-shadow 0.2s' }}>
                  <Box 
                    h={100} 
                    style={{ 
                      backgroundColor: hex, 
                      position: 'relative',
                      borderBottom: '1px solid rgba(0,0,0,0.05)'
                    }}
                  >
                    <Group gap={4} style={{ position: 'absolute', top: 8, right: 8, backgroundColor: 'rgba(255,255,255,0.9)', borderRadius: 8, padding: 4, boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
                      <ActionIcon variant="subtle" color="gray" size="sm" onClick={() => handleOpenEdit(item)}>
                        <IconPencil size={14} />
                      </ActionIcon>
                      <ActionIcon variant="subtle" color="red" size="sm" onClick={() => handleDelete(item.id, item.name)}>
                        <IconTrash size={14} />
                      </ActionIcon>
                    </Group>
                  </Box>

                  <Stack gap="xs" p="md">
                    <div>
                      <Text fw={700} size="lg" truncate c="dark" style={{ lineHeight: 1.2 }}>{item.name}</Text>
                      <Text size="xs" c="dimmed" tt="uppercase" fw={600} style={{ letterSpacing: 0.5 }}>{family}</Text>
                    </div>
                    
                    <Group justify="space-between" mt="xs">
                      <Stack gap={0}>
                        <Text size="10px" c="dimmed" tt="uppercase" fw={700}>HEX</Text>
                        <Text size="sm" ff="monospace" c="dark">{hex}</Text>
                      </Stack>
                      <Stack gap={0} align="flex-end">
                        <Text size="10px" c="dimmed" tt="uppercase" fw={700}>SKU</Text>
                        <Text size="sm" ff="monospace" c="dark">{item.sku || '—'}</Text>
                      </Stack>
                    </Group>
                  </Stack>
                </Card>
              )
            })}
          </SimpleGrid>
          {filteredItems.length === 0 && !loading && (
            <Text c="dimmed" ta="center" py="xl">Nenhuma cor encontrada</Text>
          )}
        </Paper>
      </Stack>

      <Drawer
        opened={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        title={<Text fw={600} size="lg">{editingId ? 'Editar Cor' : 'Nova Cor'}</Text>}
        padding="xl"
        position="right"
        size="md"
      >
        <form onSubmit={form.onSubmit(handleSubmit)}>
          <Stack gap="md">
            <TextInput
              label="Nome da Cor"
              placeholder="Ex: Vermelho Vivo"
              required
              {...form.getInputProps('name')}
            />
            
            <MantineColorInput
              label="Cor (HEX)"
              placeholder="#FF0000"
              {...form.getInputProps('hex')}
            />

            <Divider label="Avançado (LAB)" labelPosition="center" />
            
            <Group grow>
              <NumberInput
                label="L"
                decimalScale={2}
                {...form.getInputProps('labL')}
              />
              <NumberInput
                label="a"
                decimalScale={2}
                {...form.getInputProps('labA')}
              />
              <NumberInput
                label="b"
                decimalScale={2}
                {...form.getInputProps('labB')}
              />
            </Group>

            <Group justify="flex-end" mt="xl">
              <Button variant="default" onClick={() => setDrawerOpen(false)}>Cancelar</Button>
              <Button type="submit" loading={submitting} leftSection={<IconDeviceFloppy size={18} />}>
                Salvar
              </Button>
            </Group>
          </Stack>
        </form>
      </Drawer>
    </Box>
  )
}
