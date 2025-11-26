import React from 'react'
import { DEFAULT_HUE_BOUNDS } from '@/lib/color-utils'
import { DS } from '@/design-system/tokens'

type Bounds = {
  vermelhoStart: number
  laranjaStart: number
  amareloStart: number
  verdeStart: number
  verdeEnd: number
  azulStart: number
  roxoStart: number
  magentaStart: number
}

function inArc(start: number, end: number, value: number) {
  if (start <= end) return value >= start && value < end
  return value >= start || value < end
}

export function classifyAngle(hue: number, b: Bounds) {
  if (inArc(b.vermelhoStart, b.laranjaStart, hue)) return 'Vermelho'
  if (inArc(b.laranjaStart, b.amareloStart, hue)) return 'Laranja'
  if (inArc(b.amareloStart, b.verdeStart, hue)) return 'Amarelo'
  if (inArc(b.verdeStart, (b as any).verdeEnd, hue)) return 'Verde'
  if (inArc(b.azulStart, b.roxoStart, hue)) return 'Azul'
  if (inArc(b.roxoStart, b.magentaStart, hue)) return 'Roxo'
  if (inArc(b.magentaStart, b.vermelhoStart, hue)) return 'Rosa'
  return '—'
}

function boundsForFamily(name: string, b: Bounds): [number, number] {
  switch (name) {
    case 'Vermelho': return [b.vermelhoStart, b.laranjaStart]
    case 'Laranja': return [b.laranjaStart, b.amareloStart]
    case 'Amarelo': return [b.amareloStart, b.verdeStart]
    case 'Verde': return [b.verdeStart, (b as any).verdeEnd]
    case 'Azul': return [(b as any).azulStart, b.roxoStart]
    case 'Roxo': return [b.roxoStart, b.magentaStart]
    case 'Rosa': return [b.magentaStart, b.vermelhoStart]
    default: return [0,0]
  }
}

export function Legend({ bounds }: { bounds?: Bounds }) {
  const b = bounds ?? DEFAULT_HUE_BOUNDS
  const items = [
    ['Vermelho', '#ef4444', `${b.vermelhoStart}°-${b.laranjaStart}°`],
    ['Laranja',  '#f59e0b', `${b.laranjaStart}°-${b.amareloStart}°`],
    ['Amarelo',  '#eab308', `${b.amareloStart}°-${b.verdeStart}°`],
    ['Verde',    '#22c55e', `${b.verdeStart}°-${(b as any).verdeEnd}°`],
    ['Azul',     '#3b82f6', `${(b as any).azulStart}°-${b.roxoStart}°`],
    ['Roxo',     '#8b5cf6', `${b.roxoStart}°-${b.magentaStart}°`],
    ['Rosa',     '#ec4899', `${b.magentaStart}°-${b.vermelhoStart}°`],
  ] as const
  return (
    <div style={{display:'flex', flexWrap:'wrap', gap:8, marginTop:8}}>
      {items.map(([name, color, range]) => (
        <span key={name} style={{display:'inline-flex', alignItems:'center', gap:6, background:DS.color.surface, border:`1px solid ${DS.color.border}`, padding:'6px 12px', borderRadius:999}}>
          <span style={{width:12, height:12, background:color, borderRadius:3, display:'inline-block', border:'1px solid rgba(0,0,0,0.1)'}} />
          <span style={{color:DS.color.textPrimary, fontSize:13, fontWeight:500}}>{name}</span>
          <span style={{color:DS.color.textSecondary, fontSize:11}}>{range}</span>
        </span>
      ))}
    </div>
  )
}

const __HUE_DEBUG = process.env.NODE_ENV !== 'production'

export default function HueWheel(props: { 
  bounds?: Bounds
  forceHoverAngle?: number | undefined
  offsetDeg?: number
  showAngles?: boolean
  showFamilySectors?: boolean
  bgRotateDeg?: number
  size?: number
  staticMode?: boolean
  forcedAngle?: number | undefined
}) {
  const b = props.bounds ?? DEFAULT_HUE_BOUNDS
  const [hover, setHover] = React.useState<{ family: string; x: number; y: number } | null>(null)
  const [angles, setAngles] = React.useState<{ display: number; logical: number } | null>(null)

  const size = props.size ?? 240
  const outerR = (size/240) * 108  // Scale proportionally
  const innerR = (size/240) * 78   // Scale proportionally
  
  // Extra padding for labels outside the wheel
  const labelPadding = 30
  const svgSize = size + labelPadding * 2
  const svgCx = svgSize / 2
  const svgCy = svgSize / 2

  // "offset" afeta o mapeamento de marcadores (ticks) e highlights.
  // Para rotação apenas visual do fundo, use bgRotateDeg.
  const offset = ((props.offsetDeg ?? 0) % 360 + 360) % 360
  const bgRotate = ((props.bgRotateDeg ?? 0) % 360 + 360) % 360

  const norm = (deg: number) => ((deg % 360) + 360) % 360
  const toDisplay = (logicalDeg: number) => norm(logicalDeg + offset)
  const toLogical = (displayDeg: number) => norm(displayDeg - offset)

  function polarToXY(angleDeg: number, r: number) {
    // 0° à direita, sentido horário
    const a = (angleDeg) * Math.PI / 180
    return { x: svgCx + r * Math.cos(a), y: svgCy + r * Math.sin(a) }
  }

  // Se forceHoverAngle for fornecido, computa hover artificialmente
  const forcedHover = React.useMemo(() => {
    if (props.forceHoverAngle == null) return null
    const a = ((props.forceHoverAngle % 360) + 360) % 360
    const r = (innerR + outerR) / 2
    const p = polarToXY(a, r)
    const fam = classifyAngle(toLogical(a), b)
    setAngles({ display: a, logical: toLogical(a) })
    return { family: fam, x: p.x, y: p.y }
  }, [props.forceHoverAngle, b, offset])

  const effHover = forcedHover ?? hover

  const boundaryTicks = [
    { name: 'Vermelho', deg: toDisplay(b.vermelhoStart) },
    { name: 'Laranja',  deg: toDisplay(b.laranjaStart) },
    { name: 'Amarelo',  deg: toDisplay(b.amareloStart) },
    { name: 'Verde',    deg: toDisplay(b.verdeStart) },
    { name: 'Fim do Verde', deg: toDisplay((b as any).verdeEnd) },
    { name: 'Início do Azul', deg: toDisplay(b.azulStart) },
    { name: 'Roxo',     deg: toDisplay(b.roxoStart) },
    { name: 'Rosa',     deg: toDisplay(b.magentaStart) },
  ]

  // Desenha setores como paths SVG para máxima compatibilidade (em vez de conic-gradient)
  function sectorPath(startDeg: number, endDeg: number) {
    const s = norm(startDeg)
    const e = norm(endDeg)
    if (s === e) return ''
    const segments: Array<[number, number]> = s < e ? [[s, e]] : [[s, 360], [0, e]]
    const paths: string[] = []
    for (const [a0, a1] of segments) {
      const p0o = polarToXY(a0, outerR)
      const p1o = polarToXY(a1, outerR)
      const p1i = polarToXY(a1, innerR)
      const p0i = polarToXY(a0, innerR)
      const sweepOuter = 1 // horário
      const sweepInner = 0 // anti-horário para voltar
      const large = (a1 - a0 + 360) % 360 > 180 ? 1 : 0
      const d = [
        `M ${p0o.x} ${p0o.y}`,
        `A ${outerR} ${outerR} 0 ${large} ${sweepOuter} ${p1o.x} ${p1o.y}`,
        `L ${p1i.x} ${p1i.y}`,
        `A ${innerR} ${innerR} 0 ${large} ${sweepInner} ${p0i.x} ${p0i.y}`,
        'Z'
      ].join(' ')
      paths.push(d)
    }
    return paths.join(' ')
  }

  // Constrói um espectro contínuo (nuances) via conic-gradient em HSL
  const bgGradient = React.useMemo(() => {
    const stops: string[] = []
    for (let d = 0; d <= 360; d += 4) {
      stops.push(`hsl(${d} 90% 55%) ${d}deg`)
    }
    return `conic-gradient(from 0deg, ${stops.join(', ')})`
  }, [])

  // Debug helpers: valida contiguidade e loga ranges após offset
  React.useEffect(() => {
    const fams = [
      ['Vermelho', b.vermelhoStart, b.laranjaStart],
      ['Laranja',  b.laranjaStart,  b.amareloStart],
      ['Amarelo',  b.amareloStart,  b.verdeStart],
      ['Verde',    b.verdeStart,    (b as any).verdeEnd],
      ['Azul',     (b as any).azulStart, b.roxoStart],
      ['Roxo',     b.roxoStart,     b.magentaStart],
      ['Rosa',     b.magentaStart,  b.vermelhoStart],
    ] as const
    let ok = true
    for (let i=0;i<fams.length;i++) {
      const [name, s, e] = fams[i]
      const next = fams[(i+1)%fams.length]
      if (norm(e) !== norm(next[1])) { ok = false }
      if (norm(s) === norm(e)) { ok = false }
    }
    if (__HUE_DEBUG) console.debug('[HueWheel] offset=', offset, 'contiguous=', ok)
    // Log order by display start
    const ordered = fams.map(([n,s,e])=>({n, s:toDisplay(s), e:toDisplay(e)})).sort((a,b)=>a.s-b.s)
    if (__HUE_DEBUG) console.debug('[HueWheel] sectors(display):', ordered)
  }, [b, offset])

  return (
    <div style={{marginTop:12, display:'grid', placeItems:'center', position:'relative', background:DS.color.surface, borderRadius:DS.radius.lg, padding:DS.spacing(8), border:`1px solid ${DS.color.borderSubtle}`}}>
      {/* Fundo com nuances (espectro completo) */}
  <div data-testid="hue-wheel-bg" aria-hidden="true" style={{position:'absolute', width:size, height:size, borderRadius:'50%', background:bgGradient, filter:'saturate(0.95) brightness(0.95)', transform:`rotate(${bgRotate}deg)`, pointerEvents:'none'}} />
      {/* Máscara para formar o anel (preserva o gradiente abaixo) */}
      <div aria-hidden="true" style={{position:'absolute', width:size, height:size, borderRadius:'50%', boxShadow:`inset 0 0 0 ${size/2 - outerR}px ${DS.color.surface}` , pointerEvents:'none'}} />
      <div aria-hidden="true" style={{position:'absolute', width:innerR*2, height:innerR*2, borderRadius:'50%', background:DS.color.surface, pointerEvents:'none'}} />

      <svg
        data-testid="hue-wheel"
        width={svgSize}
        height={svgSize}
        viewBox={`0 0 ${svgSize} ${svgSize}`}
        role="img"
        aria-label="Roda cromática"
        style={{position:'relative'}}
        onMouseMove={(e)=>{
          if (props.forceHoverAngle != null) return // quando forçado, não processa mouse
          const rect = (e.currentTarget as SVGSVGElement).getBoundingClientRect()
          const px = e.clientX - rect.left
          const py = e.clientY - rect.top
          const dx = px - svgCx
          const dy = py - svgCy
          const r = Math.hypot(dx, dy)
          if (r < innerR || r > outerR) { setHover(null); return }
          let ang = Math.atan2(dy, dx) * 180/Math.PI
          if (ang < 0) ang += 360
          const fam = classifyAngle(toLogical(ang), b)
          if (__HUE_DEBUG) console.debug('[HueWheel] hover', { cursorAngleDisplay: ang, cursorAngleLogical: toLogical(ang), family: fam, offset })
          setHover({ family: fam, x: px, y: py })
          setAngles({ display: ang, logical: toLogical(ang) })
        }}
        onMouseLeave={()=> props.forceHoverAngle == null && setHover(null)}
      >
        {/* Sectores de família (visuais) para refletir os limites atuais */}
        {(() => {
          if (props.showFamilySectors === false) return null
          const fams: Array<{ name: string; start: number; end: number; color: string }> = [
            { name:'Vermelho', start:b.vermelhoStart, end:b.laranjaStart, color:'#ef4444' },
            { name:'Laranja',  start:b.laranjaStart,  end:b.amareloStart, color:'#f59e0b' },
            { name:'Amarelo',  start:b.amareloStart,  end:b.verdeStart,  color:'#eab308' },
            { name:'Verde',    start:b.verdeStart,    end:(b as any).verdeEnd, color:'#22c55e' },
            { name:'Azul',     start:(b as any).azulStart, end:b.roxoStart, color:'#3b82f6' },
            { name:'Roxo',     start:b.roxoStart,     end:b.magentaStart, color:'#8b5cf6' },
            { name:'Rosa',     start:b.magentaStart,  end:b.vermelhoStart, color:'#ec4899' },
          ]
          return (
            <g aria-hidden="true">
              {fams.map((f)=>{
                const s = toDisplay(f.start)
                const e = toDisplay(f.end)
                const d = sectorPath(s, e)
                return <path key={f.name} d={d} fill={f.color} opacity={0.15} />
              })}
            </g>
          )
        })()}

        {/* Realce sutil do setor sob o mouse (sem cores sólidas) */}
        {effHover?.family && (() => {
          const [s0, e0] = boundsForFamily(effHover.family, b)
          const s = toDisplay(s0)
          const e = toDisplay(e0)
          const d = sectorPath(s, e)
          if (__HUE_DEBUG) console.debug('[HueWheel] render highlight', { family: effHover.family, startDisplay: s, endDisplay: e, offset })
          return <path d={d} fill="#ffffff" opacity={0.12} />
        })()}

        {/* Borda externa do anel */}
        <circle cx={svgCx} cy={svgCy} r={outerR} fill="none" stroke={DS.color.border} strokeWidth={2} />
        {boundaryTicks.map((t, idx) => {
          const pOuter = polarToXY(t.deg, outerR)
          const pInner = polarToXY(t.deg, innerR)
          const active = (() => {
            if (!effHover?.family) return false
            const [start, end] = boundsForFamily(effHover.family, b)
            const angClose = (a:number, c:number, tol=0.6) => {
              const d = (((a - c + 540) % 360) - 180)
              return Math.abs(d) <= tol
            }
            return angClose(t.deg, start) || angClose(t.deg, end)
          })()
          const color = (() => {
            switch (t.name) {
              case 'Vermelho': return '#ef4444'
              case 'Laranja': return '#f59e0b'
              case 'Amarelo': return '#eab308'
              case 'Verde':
              case 'Fim do Verde': return '#22c55e'
              case 'Início do Azul': return '#3b82f6'
              case 'Roxo': return '#8b5cf6'
              case 'Rosa': return '#ec4899'
              default: return '#64748b'
            }
          })()
          
          // Calcula posição para o label (fora do anel, radialmente)
          const labelR = outerR + 24
          const pLabel = polarToXY(t.deg, labelR)
          const logicalAngle = toLogical(t.deg)
          
          return (
            <g key={idx} data-family={t.name} data-highlighted={active ? 'true' : 'false'}>
              <line x1={pInner.x} y1={pInner.y} x2={pOuter.x} y2={pOuter.y} stroke={active? DS.color.textPrimary : color} strokeWidth={active? 4 : 3} opacity={active ? 1 : 0.85} />
              <text 
                x={pLabel.x} 
                y={pLabel.y} 
                textAnchor="middle" 
                alignmentBaseline="middle" 
                fill={active ? DS.color.textPrimary : DS.color.textSecondary} 
                fontSize={13} 
                fontWeight={active ? 700 : 600}
                style={{userSelect: 'none'}}
              >
                {Math.round(logicalAngle)}°
              </text>
              <title>{t.name} ({Math.round(logicalAngle)}°)</title>
            </g>
          )
        })}
        <circle cx={svgCx} cy={svgCy} r={innerR} fill={DS.color.surface} stroke={DS.color.border} strokeWidth={2} />
      </svg>
      {effHover?.family && (
        <div data-testid="hue-hover-label" style={{position:'absolute', left: effHover.x + 8, top: effHover.y + 8, transform:'translate(-50%, -100%)', background:DS.color.surface, color:DS.color.textPrimary, border:`1px solid ${DS.color.border}`, borderRadius:6, padding:'4px 8px', fontSize:12, pointerEvents:'none', whiteSpace:'nowrap', boxShadow: DS.shadow.md}}>
          {effHover.family}
          {props.showAngles && angles && (
            <span style={{marginLeft:8, color:'#a3a3a3'}}>({Math.round(angles.logical)}°)</span>
          )}
        </div>
      )}
    </div>
  )
}
