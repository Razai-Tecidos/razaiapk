import React, { useEffect, useMemo, useState } from 'react'
import { 
  Button, Title, Text, Paper, Group, Stack, TextInput, 
  ActionIcon, Badge, Grid, Card, Drawer, NumberInput,
  LoadingOverlay, Box, Tooltip
} from '@mantine/core'
import { useForm } from '@mantine/form'
import { IconSearch, IconPlus, IconPencil, IconTrash, IconX, IconDeviceFloppy } from '@tabler/icons-react'
import { notifications } from '@mantine/notifications'
import { db } from '@/lib/db'
import { normalizeForSearch } from '@/lib/text'
import type { Tissue, TissueInput } from '@/types/tissue'
import { DS } from '@/design-system/tokens'

export default function Tissues() {
  const [items, setItems] = useState<Tissue[]>([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const form = useForm<TissueInput>({
    initialValues: {
      name: '',
      width: 150,
      composition: '',
      color: undefined
    },
    validate: {
      name: (value) => value.length < 2 ? 'Nome muito curto' : null,
      width: (value) => (value < 50 || value > 300) ? 'Largura inválida (50-300)' : null,
      composition: (value) => value.length < 2 ? 'Composição obrigatória' : null
    }
  })

  useEffect(() => {
    load()
  }, [])

  async function load() {
    setLoading(true)
    try {
      await db.init()
      const list = await db.listTissues()
      setItems(list)
    } catch (error) {
      console.error(error)
      notifications.show({ title: 'Erro', message: 'Falha ao carregar tecidos', color: 'red' })
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
        normalizeForSearch(it.composition || '').includes(q)
      )
    }
    return list.sort((a, b) => a.name.localeCompare(b.name))
  }, [items, query])

  function handleOpenCreate() {
    setEditingId(null)
    form.reset()
    setDrawerOpen(true)
  }

  function handleOpenEdit(item: Tissue) {
    setEditingId(item.id)
    form.setValues({
      name: item.name,
      width: item.width,
      composition: item.composition,
      color: item.color
    })
    setDrawerOpen(true)
  }

  async function handleSubmit(values: TissueInput) {
    setSubmitting(true)
    try {
      if (editingId) {
        await db.updateTissue({ id: editingId, ...values })
        notifications.show({ title: 'Sucesso', message: 'Tecido atualizado', color: 'green' })
      } else {
        await db.createTissue(values)
        notifications.show({ title: 'Sucesso', message: 'Tecido criado', color: 'green' })
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
    if (!window.confirm(`Excluir o tecido "${name}"?`)) return
    try {
      await db.deleteTissue(id)
      notifications.show({ title: 'Excluído', message: 'Tecido removido', color: 'blue' })
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
            <Title order={2} fw={300} style={{ letterSpacing: -0.5 }}>Tecidos</Title>
            <Text c="dimmed" size="sm">Gerencie o catálogo de bases de tecido.</Text>
          </div>
          <Button leftSection={<IconPlus size={18} />} onClick={handleOpenCreate} color="blue">
            Novo Tecido
          </Button>
        </Group>

        <Paper withBorder p="md" radius="md">
          <Group mb="md">
            <TextInput
              placeholder="Buscar tecido..."
              leftSection={<IconSearch size={16} />}
              value={query}
              onChange={(e) => setQuery(e.currentTarget.value)}
              style={{ flex: 1 }}
            />
            <Badge variant="light" size="lg" color="gray">
              {filteredItems.length} tecidos
            </Badge>
          </Group>

          <Grid gutter="md">
            {filteredItems.map(item => (
              <Grid.Col key={item.id} span={{ base: 12, sm: 6, md: 4, lg: 3 }}>
                <Card withBorder padding="lg" radius="md" style={{ height: '100%' }}>
                  <Group justify="space-between" mb="xs">
                    <Badge variant="light" color="blue">{item.sku}</Badge>
                    <Group gap={4}>
                      <ActionIcon variant="subtle" color="gray" onClick={() => handleOpenEdit(item)}>
                        <IconPencil size={16} />
                      </ActionIcon>
                      <ActionIcon variant="subtle" color="red" onClick={() => handleDelete(item.id, item.name)}>
                        <IconTrash size={16} />
                      </ActionIcon>
                    </Group>
                  </Group>
                  
                  <Text fw={600} size="lg" mt="xs">{item.name}</Text>
                  
                  <Stack gap={4} mt="md">
                    <Group justify="space-between">
                      <Text size="sm" c="dimmed">Largura</Text>
                      <Text size="sm">{item.width} cm</Text>
                    </Group>
                    <Group justify="space-between">
                      <Text size="sm" c="dimmed">Composição</Text>
                      <Text size="sm" truncate style={{ maxWidth: '60%' }} title={item.composition}>
                        {item.composition}
                      </Text>
                    </Group>
                  </Stack>
                </Card>
              </Grid.Col>
            ))}
            {filteredItems.length === 0 && !loading && (
              <Grid.Col span={12}>
                <Text c="dimmed" ta="center" py="xl">Nenhum tecido encontrado</Text>
              </Grid.Col>
            )}
          </Grid>
        </Paper>
      </Stack>

      <Drawer
        opened={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        title={<Text fw={600} size="lg">{editingId ? 'Editar Tecido' : 'Novo Tecido'}</Text>}
        padding="xl"
        position="right"
        size="md"
      >
        <form onSubmit={form.onSubmit(handleSubmit)}>
          <Stack gap="md">
            <TextInput
              label="Nome do Tecido"
              placeholder="Ex: Helanca Light"
              required
              {...form.getInputProps('name')}
            />
            
            <NumberInput
              label="Largura (cm)"
              placeholder="150"
              min={50}
              max={300}
              required
              {...form.getInputProps('width')}
            />
            
            <TextInput
              label="Composição"
              placeholder="Ex: 100% Poliéster"
              required
              {...form.getInputProps('composition')}
            />

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
