import React from 'react'
import { DS } from '@/design-system/tokens'
import { HueBoundaries } from '@/lib/color-utils'
import HueWheel, { Legend } from '@/components/HueWheel'

interface HueWheelPanelProps {
  bounds: HueBoundaries
  wheelRotation: number
  onWheelRotationChange: (value: number) => void
  visualRotation: number
  onVisualRotationChange: (value: number) => void
}

export default function HueWheelPanel({
  bounds,
  wheelRotation,
  onWheelRotationChange,
  visualRotation,
  onVisualRotationChange,
}: HueWheelPanelProps) {
  function clampDeg(d: number): number {
    return Math.max(0, Math.min(359, Math.round(d)))
  }

  function inputStyle(): React.CSSProperties {
    return {
      width: 90,
      padding: '6px 8px',
      borderRadius: 8,
      border: `1px solid ${DS.color.border}`,
      background: DS.color.surface,
      color: DS.color.textPrimary,
    }
  }

  return (
    <div style={{ background: DS.color.surface, border: `1px solid ${DS.color.border}`, borderRadius: 12, padding: 16 }}>
      <h3 style={{ color: DS.color.textPrimary, margin: '0 0 12px' }}>Roda cromática</h3>

      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
        <span style={{ color: DS.color.textPrimary }}>Rotação da roda (°)</span>
        <input
          type="number"
          min={0}
          max={359}
          value={wheelRotation}
          onChange={(e) => onWheelRotationChange(clampDeg(Number(e.target.value)))}
          style={inputStyle()}
        />
        <span style={{ color: DS.color.textSecondary, fontSize: 12 }}>(marcadores + hover)</span>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
        <span style={{ color: DS.color.textPrimary }}>Rotação visual (°)</span>
        <input
          type="number"
          min={0}
          max={359}
          value={visualRotation}
          onChange={(e) => onVisualRotationChange(clampDeg(Number(e.target.value)))}
          style={inputStyle()}
        />
      </div>

      <HueWheel bounds={bounds} offsetDeg={wheelRotation} bgRotateDeg={(wheelRotation + visualRotation) % 360} />
      <Legend bounds={bounds} />

      <div style={{ margin: '12px 0' }}>
        <div style={{ height: 1, background: DS.color.border }} />
      </div>

      <h4 style={{ color: DS.color.textPrimary, margin: '0 0 8px' }}>Como funcionam os limites de cor</h4>
      <ul style={{ margin: 0, paddingLeft: 18, color: DS.color.textSecondary, fontSize: 12 }}>
        <li>Ângulos em graus (0–359).</li>
        <li>Fim de uma família = início da próxima.</li>
        <li>Verde e Azul possuem ruptura explícita (sem ciano).</li>
      </ul>

      {(() => {
        const b = bounds
        function seg(a: number, b: number) {
          return `${a}° – ${b}°`
        }
        return (
          <div style={{ marginTop: 8, display: 'grid', gap: 4, color: '#94a3b8', fontSize: 12 }}>
            <div>Vermelho: {seg(b.vermelhoStart, b.laranjaStart)}</div>
            <div>Laranja: {seg(b.laranjaStart, b.amareloStart)}</div>
            <div>Amarelo: {seg(b.amareloStart, b.verdeStart)}</div>
            <div>Verde: {seg(b.verdeStart, (b as any).verdeEnd)}</div>
            <div>Azul: {seg((b as any).azulStart, b.roxoStart)}</div>
            <div>Roxo: {seg(b.roxoStart, b.magentaStart)}</div>
            <div>Rosa: {seg(b.magentaStart, b.vermelhoStart)}</div>
          </div>
        )
      })()}
    </div>
  )
}
