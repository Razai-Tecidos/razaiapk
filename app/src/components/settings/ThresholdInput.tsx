import React, { useMemo } from 'react'
import { DS } from '@/design-system/tokens'
import { DEFAULT_DE_THRESHOLD } from '@/lib/settings'

interface ThresholdInputProps {
  value: number
  onChange: (value: number) => void
}

export default function ThresholdInput({ value, onChange }: ThresholdInputProps) {
  const isDefault = useMemo(() => Math.abs(value - DEFAULT_DE_THRESHOLD) < 1e-9, [value])

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
      <span style={{ minWidth: 140, color: DS.color.textPrimary }}>
        Limiar ΔE00 (padrão {DEFAULT_DE_THRESHOLD})
      </span>
      <input
        data-testid="delta-input"
        type="number"
        min="0.1"
        step="0.1"
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        style={{
          width: 90,
          padding: `${DS.spacing(2)} ${DS.spacing(3)}`,
          borderRadius: DS.radius.md,
          border: `1px solid ${DS.color.border}`,
          background: DS.color.surface,
          color: DS.color.textPrimary,
          fontSize: DS.font.size.base,
        }}
      />
      {isDefault && (
        <span style={{ fontSize: 11, color: '#7c3aed', fontWeight: 500 }}>
          ✓ Padrão
        </span>
      )}
    </div>
  )
}
