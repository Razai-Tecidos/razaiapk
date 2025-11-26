import React from 'react'
import type { CatalogFilters } from '@/types/catalog'
import { DS } from '@/design-system/tokens'

export interface CatalogFilterBarProps {
  value: CatalogFilters
  onChange: (f: CatalogFilters) => void
  onGeneratePdf?: () => void
}

export const CatalogFilterBar: React.FC<CatalogFilterBarProps> = ({ value, onChange, onGeneratePdf }) => {
  function update<K extends keyof CatalogFilters>(key: K, val: CatalogFilters[K]) {
    onChange({ ...value, [key]: val })
  }

  return (
    <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 16 }}>
      <input
        placeholder="Buscar..."
        value={value.search || ''}
        onChange={e => update('search', e.target.value)}
        style={{ padding: '6px 10px', minWidth: 160 }}
      />
      <select
        value={value.fabricType || ''}
        onChange={e => update('fabricType', e.target.value || undefined)}
        style={{ padding: '6px 10px' }}
      >
        <option value="">Tipo de tecido</option>
        <option value="malha">Malha</option>
        <option value="satin">Satin</option>
        <option value="denim">Denim</option>
      </select>
      <label style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        <input
          type="checkbox"
          checked={!!value.onlyActive}
          onChange={e => update('onlyActive', e.target.checked)}
        /> Ativos
      </label>
      {onGeneratePdf && (
        <button onClick={onGeneratePdf} style={{ padding: '6px 14px', background: DS.color.accent, color: '#fff', borderRadius: 4, border: 'none', cursor: 'pointer', fontWeight: 500 }}>
          Gerar PDF
        </button>
      )}
    </div>
  )
}
