import React, { useEffect, useMemo, useState } from 'react'
import { 
  Button, Title, Text, Paper, Group, Stack, TextInput, 
  Select, Checkbox, ActionIcon, Badge, Table, ScrollArea, 
  Box, Grid, Tooltip, Card, Divider, Switch,
  ThemeIcon, SimpleGrid
} from '@mantine/core'
import { IconSearch, IconTrash, IconX, IconPlus, IconLink, IconNeedleThread } from '@tabler/icons-react'
import { notifications } from '@mantine/notifications'
import { db, colorsDb, linksDb } from '@/lib/db'
import LazyImage from '@/components/LazyImage'
import type { Tissue } from '@/types/tissue'
import type { Color } from '@/types/color'
import type { TecidoCorView } from '@/types/tecidoCor'
import { inferFamilyFrom, labFromPartial, labToHex } from '@/lib/color-utils'
import { normalizeForSearch } from '@/lib/text'
import { DS } from '@/design-system/tokens'
import { isTauri } from '@/lib/platform'

export default function TecidoCorPage() {
  const [tissues, setTissues] = useState<Tissue[]>([])
  const [colors, setColors] = useState<Color[]>([])
  const [links, setLinks] = useState<TecidoCorView[]>([])
  
  // Selection State
  const [selectedTissueId, setSelectedTissueId] = useState<string>('')
  const [selectedColorIds, setSelectedColorIds] = useState<Set<string>>(new Set())
  const [selectedLinkIds, setSelectedLinkIds] = useState<Set<string>>(new Set())
  
  // Filters
  const [colorQuery, setColorQuery] = useState<string>('')
  const [filterTissue, setFilterTissue] = useState<string>('')
  const [filterFamily, setFilterFamily] = useState<string>('')
  
  // UI State
  const [compact, setCompact] = useState<boolean>(false)
  const [previewSrc, setPreviewSrc] = useState<string | null>(null)
  const [processing, setProcessing] = useState(false)
  
  useEffect(() => {
    loadData()
  }, [])

  async function loadData() {
    try {
      await db.init()
      const [ts, cs, ls] = await Promise.all([
        db.listTissues(),
        colorsDb.listColors(),
        linksDb.list(),
      ])
      setTissues(ts)
      setColors(cs)
      setLinks(ls)
    } catch (error) {
      console.error(error)
      notifications.show({ title: 'Erro', message: 'Falha ao carregar dados', color: 'red' })
    }
  }

  async function refreshLinks() {
    setLinks(await linksDb.list())
  }

  const families = useMemo(() => {
    const set = new Set<string>()
    for (const c of colors) {
      const fam = inferFamilyFrom({ hex: c.hex, labL: c.labL, labA: c.labA, labB: c.labB })
      if (fam && fam !== '—') set.add(fam)
    }
    return Array.from(set).sort()
  }, [colors])

  const filteredLinks = useMemo(() => {
    return links.filter(l => (
      (!filterTissue || l.tissueId === filterTissue) &&
      (!filterFamily || l.family === filterFamily)
    ))
  }, [links, filterTissue, filterFamily])

  function hexForColor(c: Color): string | null {
    if (c.hex) return c.hex
    const lab = labFromPartial({ hex: c.hex, labL: c.labL, labA: c.labA, labB: c.labB })
    return lab ? labToHex(lab) : null
  }

  function hexForLink(l: TecidoCorView): string | null {
    if (l.hex) return l.hex
    const c = colors.find(x => x.id === l.colorId)
    if (!c) return null
    return hexForColor(c)
  }

  async function gerarVinculos() {
    if (!selectedTissueId || selectedColorIds.size === 0) return
    setProcessing(true)
    try {
      const { created, duplicates } = await linksDb.createMany(selectedTissueId, Array.from(selectedColorIds))
      notifications.show({ 
        title: 'Sucesso', 
        message: `${created} vínculo(s) criado(s), ${duplicates} duplicado(s) ignorado(s).`, 
        color: 'green' 
      })
      setSelectedColorIds(new Set())
      await refreshLinks()
    } catch (error) {
      notifications.show({ title: 'Erro', message: 'Falha ao criar vínculos', color: 'red' })
    } finally {
      setProcessing(false)
    }
  }

  function toggleColor(id: string) {
    setSelectedColorIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  async function toggleStatus(link: TecidoCorView) {
    try {
      await linksDb.updateStatus(link.id, link.status === 'Ativo' ? 'Inativo' : 'Ativo')
      await refreshLinks()
    } catch (error) {
      notifications.show({ title: 'Erro', message: 'Falha ao atualizar status', color: 'red' })
    }
  }

  async function deleteLink(id: string) {
    if (!window.confirm('Tem certeza que deseja excluir este vínculo?')) return
    try { 
      await linksDb.delete(id)
      await refreshLinks()
      notifications.show({ title: 'Excluído', message: 'Vínculo removido', color: 'blue' })
    } catch (error) {
      notifications.show({ title: 'Erro', message: 'Falha ao excluir', color: 'red' })
    }
  }

  async function deleteSelectedLinks() {
    if (selectedLinkIds.size === 0) return
    if (!window.confirm(`Deseja excluir ${selectedLinkIds.size} vínculo(s) selecionado(s)?`)) return
    
    setProcessing(true)
    try {
      const ids = Array.from(selectedLinkIds)
      await Promise.all(ids.map(id => linksDb.delete(id)))
      notifications.show({ title: 'Sucesso', message: `${ids.length} vínculo(s) excluído(s).`, color: 'green' })
      setSelectedLinkIds(new Set())
      await refreshLinks()
    } catch (error) {
      notifications.show({ title: 'Erro', message: 'Falha ao excluir em massa', color: 'red' })
    } finally {
      setProcessing(false)
    }
  }

  // Filtered Colors for Grid
  const filteredColors = useMemo(() => {
    const q = normalizeForSearch(colorQuery)
    const list = (!q ? colors : colors.filter(c =>
      normalizeForSearch(c.name).includes(q) || normalizeForSearch(c.sku).includes(q)
    ))
    return list.sort((a,b)=>a.name.localeCompare(b.name,'pt-BR'))
  }, [colors, colorQuery])

  const displayColors = filteredColors.slice(0, 200)

  return (
    <Box p="xl" style={{ maxWidth: isTauri() ? 1600 : '100%', margin: '0 auto' }}>
      <Stack gap="xl">
        {/* Header */}
        <Group justify="space-between" align="flex-start">
          <div>
            <Title order={2} fw={300} style={{ letterSpacing: -0.5 }}>Vínculo Tecido-Cor</Title>
            <Text c="dimmed" size="sm">Gerencie as combinações de tecidos e cores para gerar SKUs.</Text>
          </div>
        </Group>

        {/* Main Creation Area */}
        <Grid gutter="xl">
          {/* Tissues Column */}
          <Grid.Col span={{ base: 12, md: 4 }}>
            <Paper withBorder p="md" radius="md" style={{ display: 'flex', flexDirection: 'column', minHeight: 400, maxHeight: 'calc(100vh - 200px)' }}>
              <Text fw={500} size="sm" c="dimmed" mb="sm" tt="uppercase" style={{ letterSpacing: 1 }}>Tecidos</Text>
              <ScrollArea style={{ flex: 1 }}>
                <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="xs">
                  {tissues.sort((a,b)=>a.name.localeCompare(b.name)).map(t => {
                    const selected = selectedTissueId === t.id
                    return (
                      <Card
                        key={t.id}
                        withBorder
                        shadow={selected ? 'sm' : 'none'}
                        padding="sm"
                        radius="md"
                        onClick={() => setSelectedTissueId(t.id)}
                        style={{
                          cursor: 'pointer',
                          borderColor: selected ? DS.color.info : 'var(--mantine-color-gray-3)',
                          backgroundColor: selected ? 'var(--mantine-color-blue-0)' : 'transparent',
                          transition: 'all 0.2s ease'
                        }}
                      >
                        <Stack gap="xs" align="center" style={{ textAlign: 'center' }}>
                          <ThemeIcon size="lg" variant={selected ? 'filled' : 'light'} color="blue" radius="md">
                             <IconNeedleThread size={20} />
                          </ThemeIcon>
                          <div>
                            <Text size="sm" fw={600} c="dark" lh={1.2} lineClamp={2}>{t.name}</Text>
                            <Text size="xs" c="dimmed" mt={4}>{t.sku}</Text>
                          </div>
                        </Stack>
                      </Card>
                    )
                  })}
                </SimpleGrid>
                {tissues.length === 0 && <Text c="dimmed" size="sm" ta="center" py="xl">Nenhum tecido</Text>}
              </ScrollArea>
            </Paper>
          </Grid.Col>

          {/* Colors Grid Column */}
          <Grid.Col span={{ base: 12, md: 8 }}>
            <Paper withBorder p="md" radius="md" h="100%" style={{ display: 'flex', flexDirection: 'column' }}>
              <Group justify="space-between" mb="md">
                <Text fw={500} size="sm" c="dimmed" tt="uppercase" style={{ letterSpacing: 1 }}>Cores</Text>
                <Group gap="xs">
                  <TextInput  
                    placeholder="Buscar cor..." 
                    leftSection={<IconSearch size={14} />}
                    size="xs"
                    value={colorQuery}
                    onChange={e => setColorQuery(e.target.value)}
                    style={{ width: 200 }}
                  />
                  <Checkbox 
                    label="Compacto" 
                    size="xs" 
                    checked={compact} 
                    onChange={e => setCompact(e.currentTarget.checked)} 
                  />
                </Group>
              </Group>

              <ScrollArea type="always" offsetScrollbars>
                <div 
                  style={{ 
                    display: 'grid', 
                    gridTemplateColumns: `repeat(auto-fill, minmax(${compact ? 120 : 140}px, 1fr))`, 
                    gap: 12,
                    paddingBottom: 12
                  }}
                >
                  {displayColors.map(c => {
                    const selected = selectedColorIds.has(c.id)
                    const hex = hexForColor(c)
                    return (
                      <Card 
                        key={c.id} 
                        padding={0} 
                        radius="md" 
                        withBorder 
                        style={{ 
                          cursor: 'pointer',
                          borderColor: selected ? DS.color.info : undefined,
                          ring: selected ? `2px solid ${DS.color.info}` : undefined,
                        }}
                        onClick={() => toggleColor(c.id)}
                      >
                        <Box h={compact ? 60 : 80} bg={hex || '#f1f1f1'} />
                        <Box p="xs">
                          <Text size="sm" fw={500} truncate>{c.name}</Text>
                          <Text size="xs" c="dimmed">{c.sku}</Text>
                        </Box>
                      </Card>
                    )
                  })}
                </div>
              </ScrollArea>
              
              {filteredColors.length > 200 && (
                <Text size="xs" c="dimmed" mt="xs" ta="center">
                  Mostrando 200 de {filteredColors.length} cores. Refine a busca.
                </Text>
              )}

              <Divider my="md" />

              <Group justify="space-between">
                <Text size="sm" c="dimmed">
                  Selecionadas: <Text span fw={700} c="dark">{selectedColorIds.size}</Text>
                </Text>
                <Group>
                  <Button variant="default" size="xs" onClick={() => setSelectedColorIds(new Set())} disabled={selectedColorIds.size === 0}>
                    Limpar
                  </Button>
                  <Button 
                    color="blue" 
                    size="xs" 
                    leftSection={<IconLink size={14} />}
                    onClick={gerarVinculos}
                    loading={processing}
                    disabled={!selectedTissueId || selectedColorIds.size === 0}
                  >
                    Gerar Vínculo
                  </Button>
                </Group>
              </Group>
            </Paper>
          </Grid.Col>
        </Grid>

        {/* Links Table Section */}
        <Paper withBorder radius="md" p="md">
          <Group mb="md" align="flex-end">
            <Stack gap={4}>
              <Text fw={500} size="sm" c="dimmed" tt="uppercase" style={{ letterSpacing: 1 }}>Vínculos Existentes</Text>
              <Text size="xs" c="dimmed">Gerencie os vínculos já criados</Text>
            </Stack>
            <Group style={{ flex: 1 }} align="flex-end">
              <Select
                label="Filtro Tecido"
                placeholder="Todos"
                data={[{ value: '', label: 'Todos' }, ...tissues.map(t => ({ value: t.id, label: t.name }))]}
                value={filterTissue}
                onChange={v => setFilterTissue(v || '')}
                size="xs"
                searchable
                clearable
                style={{ width: 200 }}
              />
              <Select
                label="Filtro Família"
                placeholder="Todas"
                data={[{ value: '', label: 'Todas' }, ...families.map(f => ({ value: f, label: f }))]}
                value={filterFamily}
                onChange={v => setFilterFamily(v || '')}
                size="xs"
                searchable
                clearable
                style={{ width: 150 }}
              />
              <Button variant="subtle" size="xs" onClick={() => { setFilterTissue(''); setFilterFamily('') }}>
                Limpar
              </Button>
            </Group>
            
            {selectedLinkIds.size > 0 && (
              <Group gap="xs">
                <Badge color="blue" variant="light">{selectedLinkIds.size} selecionados</Badge>
                <Button color="red" variant="light" size="xs" leftSection={<IconTrash size={14} />} onClick={deleteSelectedLinks} loading={processing}>
                  Excluir
                </Button>
              </Group>
            )}
          </Group>

          <ScrollArea>
            <Table verticalSpacing="sm" highlightOnHover>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th w={40}>
                    <Checkbox 
                      checked={filteredLinks.length > 0 && filteredLinks.every(l => selectedLinkIds.has(l.id))}
                      indeterminate={selectedLinkIds.size > 0 && selectedLinkIds.size < filteredLinks.length}
                      onChange={(e) => {
                        if (e.currentTarget.checked) setSelectedLinkIds(new Set(filteredLinks.map(l => l.id)))
                        else setSelectedLinkIds(new Set())
                      }}
                    />
                  </Table.Th>
                  <Table.Th>SKU Filho</Table.Th>
                  <Table.Th>Nome Completo</Table.Th>
                  <Table.Th>Tecido</Table.Th>
                  <Table.Th>Cor</Table.Th>
                  <Table.Th>Imagem</Table.Th>
                  <Table.Th>Família</Table.Th>
                  <Table.Th>Disponibilidade</Table.Th>
                  <Table.Th style={{ textAlign: 'right' }}>Ações</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {filteredLinks.map(l => (
                  <Table.Tr key={l.id} bg={selectedLinkIds.has(l.id) ? 'var(--mantine-color-blue-light)' : undefined}>
                    <Table.Td>
                      <Checkbox 
                        checked={selectedLinkIds.has(l.id)}
                        onChange={(e) => {
                          setSelectedLinkIds(prev => {
                            const next = new Set(prev)
                            if (e.currentTarget.checked) next.add(l.id)
                            else next.delete(l.id)
                            return next
                          })
                        }}
                      />
                    </Table.Td>
                    <Table.Td style={{ fontFamily: 'monospace' }}>{l.skuFilho}</Table.Td>
                    <Table.Td fw={500}>{l.nomeCompleto}</Table.Td>
                    <Table.Td>{l.tissueName}</Table.Td>
                    <Table.Td>
                      <Group gap="xs">
                        <Box w={16} h={16} bg={hexForLink(l) || 'transparent'} style={{ borderRadius: 4, border: '1px solid #eee' }} />
                        {l.colorName}
                      </Group>
                    </Table.Td>
                    <Table.Td>
                      {(l.imageThumb || l.image) ? (
                        <Tooltip label="Clique para ampliar">
                          <Box 
                            onClick={() => setPreviewSrc(l.imageThumb || l.image || null)}
                            style={{ cursor: 'zoom-in', width: 40, height: 40, borderRadius: 4, overflow: 'hidden' }}
                          >
                            <LazyImage src={l.imageThumb || l.image || ''} width={40} height={40} alt="" />
                          </Box>
                        </Tooltip>
                      ) : (
                        <Text c="dimmed" size="xs">—</Text>
                      )}
                    </Table.Td>
                    <Table.Td>{l.family}</Table.Td>
                    <Table.Td>
                      <Switch 
                        checked={l.status === 'Ativo'}
                        onChange={() => toggleStatus(l)}
                        color="green"
                        size="sm"
                        label={l.status === 'Ativo' ? 'Disponível' : 'Indisponível'}
                        styles={{ label: { fontSize: '12px', color: l.status === 'Ativo' ? 'var(--mantine-color-green-7)' : 'var(--mantine-color-gray-6)' } }}
                      />
                    </Table.Td>
                    <Table.Td>
                      <Group gap={4} justify="flex-end">
                        <Tooltip label="Upload Imagem">
                          <ActionIcon variant="light" color="blue" size="sm" component="label">
                            <IconPlus size={14} />
                            <input
                              type="file"
                              accept="image/*"
                              style={{ display: 'none' }}
                              onChange={async (e) => {
                                const file = e.target.files?.[0]
                                if (!file) return
                                await linksDb.setImageFull(l.id, file)
                                await refreshLinks()
                                notifications.show({ title: 'Upload', message: 'Imagem atualizada', color: 'green' })
                              }}
                            />
                          </ActionIcon>
                        </Tooltip>
                        <Tooltip label="Excluir">
                          <ActionIcon variant="light" color="red" size="sm" onClick={() => deleteLink(l.id)}>
                            <IconTrash size={14} />
                          </ActionIcon>
                        </Tooltip>
                      </Group>
                    </Table.Td>
                  </Table.Tr>
                ))}
                {filteredLinks.length === 0 && (
                  <Table.Tr>
                    <Table.Td colSpan={9}>
                      <Text c="dimmed" ta="center" py="xl">Nenhum vínculo encontrado</Text>
                    </Table.Td>
                  </Table.Tr>
                )}
              </Table.Tbody>
            </Table>
          </ScrollArea>
        </Paper>
      </Stack>

      {/* Image Preview Modal */}
      {previewSrc && (
        <Box 
          style={{ 
            position: 'fixed', inset: 0, zIndex: 1000, 
            backgroundColor: 'rgba(0,0,0,0.8)', 
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: 40
          }}
          onClick={() => setPreviewSrc(null)}
        >
          <Paper p="xs" radius="md" onClick={e => e.stopPropagation()} style={{ position: 'relative', maxWidth: '90vw', maxHeight: '90vh' }}>
            <ActionIcon 
              variant="filled" color="dark" radius="xl" 
              style={{ position: 'absolute', top: -12, right: -12, zIndex: 10 }}
              onClick={() => setPreviewSrc(null)}
            >
              <IconX size={18} />
            </ActionIcon>
            <img src={previewSrc} style={{ maxWidth: '100%', maxHeight: '85vh', borderRadius: 4, display: 'block' }} alt="Preview" />
          </Paper>
        </Box>
      )}
    </Box>
  )
}
