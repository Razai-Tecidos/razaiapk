import React, { useState, useEffect } from 'react'
import { Modal, Input, DSButton, Stack, Row, Text, Select } from '@/design-system/components'
import { TecidoCorView } from '@/types/tecidoCor'
import { registerStockMovement } from '@/lib/stock-api'
import { notifications } from '@mantine/notifications'

interface StockEntryModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
  links: TecidoCorView[]
  initialLink?: TecidoCorView | null
  initialType?: 'IN' | 'OUT' | 'ADJUST'
}

export const StockEntryModal: React.FC<StockEntryModalProps> = ({ isOpen, onClose, onSuccess, links, initialLink, initialType = 'IN' }) => {
  const [selectedLinkId, setSelectedLinkId] = useState('')
  const [quantity, setQuantity] = useState('')
  const [type, setType] = useState<'IN' | 'OUT' | 'ADJUST'>('IN')
  const [loading, setLoading] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')

  // Reset form when opening
  useEffect(() => {
    if (isOpen) {
      setSelectedLinkId(initialLink ? initialLink.id : '')
      setQuantity('')
      setType(initialType)
      setSearchTerm('')
      setLoading(false)
    }
  }, [isOpen, initialLink, initialType])

  const filteredLinks = links.filter(l => 
    l.nomeCompleto.toLowerCase().includes(searchTerm.toLowerCase()) ||
    l.tissueSku.toLowerCase().includes(searchTerm.toLowerCase()) ||
    l.colorSku.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedLinkId || !quantity) return

    const qty = parseInt(quantity, 10)
    if (isNaN(qty) || qty <= 0) {
      notifications.show({ title: 'Erro', message: 'Quantidade inválida', color: 'red' })
      return
    }

    setLoading(true)
    try {
      const res = await registerStockMovement(selectedLinkId, type, qty)
      if (res.ok) {
        notifications.show({ title: 'Sucesso', message: 'Movimentação registrada', color: 'green' })
        onSuccess()
        onClose()
      } else {
        notifications.show({ title: 'Erro', message: res.error || 'Falha ao registrar', color: 'red' })
      }
    } catch (err) {
      notifications.show({ title: 'Erro', message: 'Erro inesperado', color: 'red' })
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Movimentação de Estoque" size="md">
      <form onSubmit={handleSubmit}>
        <Stack gap={6}>
          
          <div>
            <Text size="sm" weight={500} style={{ marginBottom: 8 }}>Tipo de Movimento</Text>
            <Row gap={4}>
              <DSButton 
                variant={type === 'IN' ? 'solid' : 'outline'} 
                tone="success" 
                onClick={() => setType('IN')}
                style={{ flex: 1 }}
              >
                Entrada (+)
              </DSButton>
              <DSButton 
                variant={type === 'OUT' ? 'solid' : 'outline'} 
                tone="danger" 
                onClick={() => setType('OUT')}
                style={{ flex: 1 }}
              >
                Saída (-)
              </DSButton>
              <DSButton 
                variant={type === 'ADJUST' ? 'solid' : 'outline'} 
                tone="default" 
                onClick={() => setType('ADJUST')}
                style={{ flex: 1 }}
              >
                Ajuste (+/-)
              </DSButton>
            </Row>
          </div>

          <div>
            <Text size="sm" weight={500} style={{ marginBottom: 8 }}>Buscar Tecido/Cor</Text>
            <Input 
              placeholder="Digite nome, SKU ou cor..." 
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              fullWidth
              autoFocus
            />
          </div>

          <div>
            <Text size="sm" weight={500} style={{ marginBottom: 8 }}>Selecione o Item</Text>
            <Select 
              value={selectedLinkId} 
              onChange={e => setSelectedLinkId(e.target.value)}
              fullWidth
              required
              size={10} // Show multiple items
              style={{ height: 'auto', minHeight: 150 }}
            >
              <option value="" disabled>Selecione na lista...</option>
              {filteredLinks.map(l => (
                <option key={l.id} value={l.id}>
                  {l.tissueSku} - {l.nomeCompleto} ({l.colorSku})
                </option>
              ))}
            </Select>
            {filteredLinks.length === 0 && (
              <Text size="xs" style={{ color: 'orange', marginTop: 4 }}>
                Nenhum item encontrado. Cadastre o vínculo no Catálogo primeiro.
              </Text>
            )}
          </div>

          <div>
            <Text size="sm" weight={500} style={{ marginBottom: 8 }}>Quantidade (Rolos)</Text>
            <Input 
              type="number" 
              min="1" 
              placeholder="Ex: 5" 
              value={quantity}
              onChange={e => setQuantity(e.target.value)}
              fullWidth
              required
            />
          </div>

          <div style={{ marginTop: 16, display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
            <DSButton variant="ghost" onClick={onClose} disabled={loading}>Cancelar</DSButton>
            <DSButton type="submit" tone="accent" disabled={loading || !selectedLinkId}>
              {loading ? 'Salvando...' : 'Confirmar'}
            </DSButton>
          </div>

        </Stack>
      </form>
    </Modal>
  )
}
