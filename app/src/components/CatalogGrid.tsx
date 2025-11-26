import React from 'react'
import { CatalogItem } from '@/types/catalog'
import { CatalogCard } from './CatalogCard'

export interface CatalogGridProps {
  items: CatalogItem[]
  selectedIds?: Set<number>
  onSelect?: (item: CatalogItem) => void
}

export const CatalogGrid: React.FC<CatalogGridProps> = ({ items, onSelect, selectedIds }) => {
  return (
    <div style={{ display: 'grid', gap: 16, gridTemplateColumns: 'repeat(auto-fill,minmax(220px,1fr))' }}>
      {items.map(it => (
        <CatalogCard key={it.tissueId} item={it} onSelect={onSelect} selected={selectedIds?.has(it.tissueId)} />
      ))}
    </div>
  )
}
