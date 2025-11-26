import React from 'react'
import { CatalogItem } from '@/types/catalog'
import CardContainer from './CardContainer'
import { DS } from '@/design-system/tokens'

export interface CatalogCardProps {
  item: CatalogItem
  onSelect?: (item: CatalogItem) => void
  selected?: boolean
}

export const CatalogCard: React.FC<CatalogCardProps> = ({ item, onSelect, selected }) => {
  const colors = item.colors.slice(0, 18)
  return (
    <CardContainer
      size="LARGE"
      selected={selected}
      onClick={() => onSelect?.(item)}
      ariaLabel={`${item.tissueName} (${item.tissueSku})`}
    >
      <div style={{ fontWeight: 600, marginBottom: 4 }}>{item.tissueName} <span style={{ color: '#666' }}>({item.tissueSku})</span></div>
      <div style={{ fontSize: 12, color: '#444', minHeight: 16 }}>{item.composition || '—'}</div>
      <div style={{ fontSize: 11, color: '#777', marginBottom: 6 }}>{item.width ? `${item.width}cm` : ''}</div>
      <div style={{ fontSize: 10, color: '#555', marginBottom: 6 }}>Cores: {item.colors.length}</div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
        {colors.map(c => (
          <div key={c.skuFilho} title={c.colorName} style={{ width: 18, height: 18, borderRadius: 4, background: c.hex || '#ddd', border: '1.5px solid rgba(0,0,0,0.15)' }} />
        ))}
      </div>
    </CardContainer>
  )
}
