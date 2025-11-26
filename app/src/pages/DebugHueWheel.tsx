import React from 'react'
import HueWheel, { Legend } from '@/components/HueWheel'
import { DEFAULT_HUE_BOUNDS } from '@/lib/color-utils'
import * as htmlToImage from 'html-to-image'
import gifshot from 'gifshot'
import { DS } from '@/design-system/tokens'
import { Container } from '@/design-system/components'

function inputStyle(): React.CSSProperties { return { width:90, padding: `${DS.spacing(2)} ${DS.spacing(3)}`, borderRadius: DS.radius.sm, border: `1px solid ${DS.color.border}`, background: DS.color.bg, color: DS.color.textPrimary, fontSize: DS.font.size.sm, fontWeight: 500 } }
function row(): React.CSSProperties { return { display:'flex', alignItems:'center', gap: DS.spacing(3) } }
function label(): React.CSSProperties { return { minWidth:160, color: DS.color.textPrimary, fontSize: DS.font.size.sm, fontWeight: 500 } }

const PRESET_DEBUG = {
  vermelhoStart: 350,
  laranjaStart: 20,
  amareloStart: 60,
  verdeStart: 120,
  verdeEnd: 170,
  azulStart: 170,
  roxoStart: 260,
  magentaStart: 310,
}

// Preset de referência temporário solicitado (somente para visual/debug)
const PRESET_REFERENCIA = {
  vermelhoStart: 345,
  laranjaStart: 20,
  amareloStart: 55,
  verdeStart: 95,
  verdeEnd: 170,
  azulStart: 170,
  roxoStart: 270,
  magentaStart: 310,
}

export default function DebugHueWheel() {
  const [bounds, setBounds] = React.useState({...PRESET_DEBUG})
  const [angle, setAngle] = React.useState<number>(0)
  const [offset, setOffset] = React.useState<number>(0)
  const [recording, setRecording] = React.useState(false)
  const [gifDataUrl, setGifDataUrl] = React.useState<string | null>(null)
  const captureRef = React.useRef<HTMLDivElement>(null)

  async function recordGif() {
    if (recording) return
    setRecording(true)
    setGifDataUrl(null)
    try {
      const host = captureRef.current
      if (!host) return
      const w = host.offsetWidth || 300
      const h = host.offsetHeight || 300
      // Angles sequence for demo
      const seq: number[] = []
      for (let a=0; a<360; a+=20) seq.push(a)
      seq.push(350, 355, 359, 0, 5, 10) // foco na fronteira Vermelhoâ†”Rosa
      const frames: string[] = []
      for (const a of seq) {
        setAngle(a)
        // aguarda render
        await new Promise(r => requestAnimationFrame(()=> r(null)))
        await new Promise(r => setTimeout(r, 60))
        const dataUrl = await htmlToImage.toPng(host, { pixelRatio: 2, cacheBust: true })
        frames.push(dataUrl)
      }
      await new Promise<void>((resolve, reject) => {
        gifshot.createGIF({
          images: frames,
          gifWidth: w,
          gifHeight: h,
          interval: 0.15,
          numWorkers: 2,
          frameDuration: 1, // usado por alguns navegadores
          sampleInterval: 7,
          crossOrigin: 'anonymous'
        }, (obj: any) => {
          if (!obj.error) {
            setGifDataUrl(obj.image)
            resolve()
          } else {
            reject(new Error(obj.error))
          }
        })
      })
    } catch (e) {
      console.error('GIF record failed', e)
    } finally {
      setRecording(false)
    }
  }

  return (
    <Container padY={12}>
    <section style={{display:'grid', gap: 24}}>
      <h1 style={{color: DS.color.textPrimary, margin:0, fontSize: DS.font.size.display, fontWeight: DS.font.weightLight, letterSpacing: DS.font.letterSpacing.tight}}>Debug da roda cromática</h1>
      <div style={{display:'grid', gap: 24, gridTemplateColumns:'repeat(auto-fit, minmax(420px, 1fr))', alignItems:'start'}}>
        <div style={{background: DS.color.surface, border:`1px solid ${DS.color.border}`, borderRadius: DS.radius.lg, padding: DS.spacing(6), boxShadow: DS.shadow.sm}}>
          <h3 style={{color: DS.color.textPrimary, margin:`0 0 ${DS.spacing(5)}`, fontSize: DS.font.size.lg, fontWeight: DS.font.weightSemibold}}>Controles</h3>
          <div style={row()}>
            <span style={label()}>Ângulo de hover simulado</span>
            <input type="range" min={0} max={359} value={angle} onChange={e=> setAngle(Number(e.target.value))} />
            <input type="number" min={0} max={359} value={angle} onChange={e=> setAngle(Number(e.target.value)||0)} style={inputStyle()} />
          </div>
          <div style={{height:8}} />
          <div style={row()}>
            <span style={label()}>Offset (rotação visual)</span>
            <input type="range" min={0} max={359} value={offset} onChange={e=> setOffset(Number(e.target.value))} />
            <input type="number" min={0} max={359} value={offset} onChange={e=> setOffset(Number(e.target.value)||0)} style={inputStyle()} />
          </div>
          <div style={{height:8}} />
          <h4 style={{color:DS.color.textPrimary, margin:`${DS.spacing(4)} 0 ${DS.spacing(3)}`, fontSize: DS.font.size.base, fontWeight: DS.font.weightSemibold}}>Limiares (h° início e fim)</h4>
          <div style={{display:'grid', gridTemplateColumns:'160px 1fr 1fr', gap:10, alignItems:'center', color:DS.color.textSecondary, fontSize:13, fontWeight:600, padding:'0 4px', marginBottom:8}}>
            <span>Família</span>
            <span>Início (°)</span>
            <span>Fim (°)</span>
          </div>
          <div style={{display:'grid', gap:10}}>
            {([
              { name:'Vermelho', startKey:'vermelhoStart', endKey:'laranjaStart', nextStartKey:'laranjaStart' },
              { name:'Laranja',  startKey:'laranjaStart',  endKey:'amareloStart', nextStartKey:'amareloStart' },
              { name:'Amarelo',  startKey:'amareloStart',  endKey:'verdeStart',  nextStartKey:'verdeStart' },
              { name:'Verde',    startKey:'verdeStart',    endKey:'verdeEnd',    nextStartKey:'azulStart' },
              { name:'Azul',     startKey:'azulStart',     endKey:'roxoStart',   nextStartKey:'roxoStart' },
              { name:'Roxo',     startKey:'roxoStart',     endKey:'magentaStart',nextStartKey:'magentaStart' },
              { name:'Rosa',     startKey:'magentaStart',  endKey:'vermelhoStart', nextStartKey:'vermelhoStart' },
            ] as const).map(({name, startKey, endKey, nextStartKey})=> (
              <div key={name} style={{display:'grid', gridTemplateColumns:'160px 1fr 1fr', gap:10, alignItems:'center'}}>
                <span style={{color:DS.color.textPrimary, fontWeight:500}}>{name}</span>
                <input
                  type="number"
                  min={0}
                  max={359}
                  value={(bounds as any)[startKey]}
                  onChange={e=> {
                    const v = clampDeg(Number(e.target.value))
                    setBounds(prev => ({ ...prev, [startKey]: v }))
                  }}
                  style={inputStyle()}
                />
                <input
                  type="number"
                  min={0}
                  max={359}
                  value={(bounds as any)[endKey]}
                  onChange={e=> {
                    const v = clampDeg(Number(e.target.value))
                    setBounds(prev => ({ ...prev, [endKey]: v, [nextStartKey]: v }))
                  }}
                  style={inputStyle()}
                />
              </div>
            ))}
          </div>
          <div style={{display:'flex', flexWrap:'wrap', gap:10, marginTop:DS.spacing(5)}}>
            <button onClick={()=> setBounds(prev=> ({...prev, vermelhoStart: 359}))} style={btn()}>Vermelho=359°</button>
            <button onClick={()=> setBounds({...DEFAULT_HUE_BOUNDS})} style={btn()}>Restaurar padrões</button>
            <button onClick={()=> setBounds({...PRESET_DEBUG})} style={btn()}>Preset debug</button>
            <button onClick={()=> { setBounds({...PRESET_REFERENCIA}); setOffset(70) }} style={btn()}>Preset referência</button>
            <button onClick={recordGif} disabled={recording} style={{...btn(), opacity: recording? 0.6: 1}}>{recording? 'Gravando...' : 'Gravar GIF'}</button>
          </div>
          {gifDataUrl && (
            <div style={{marginTop:DS.spacing(4), display:'flex', alignItems:'center', gap:12, padding:DS.spacing(3), background:DS.color.bg, borderRadius:DS.radius.md, border:`1px solid ${DS.color.border}`}}>
              <a href={gifDataUrl} download={`hue-wheel-${Date.now()}.gif`} style={{...btn(), background:DS.color.success}}>Baixar GIF</a>
              <small style={{color:DS.color.textSecondary, fontWeight:500}}>Prévia ao lado</small>
            </div>
          )}
        </div>
        <div style={{background:DS.color.surface, border:`1px solid ${DS.color.border}`, borderRadius:DS.radius.lg, padding:DS.spacing(6), boxShadow: DS.shadow.sm}}>
          <h3 style={{color:DS.color.textPrimary, margin:`0 0 ${DS.spacing(4)}`, fontSize: DS.font.size.lg, fontWeight: DS.font.weightSemibold}}>Roda cromática</h3>
          <div ref={captureRef} style={{display:'inline-block'}}>
            <HueWheel bounds={bounds as any} forceHoverAngle={angle} offsetDeg={offset} showAngles />
          </div>
          <Legend />
          {gifDataUrl && (
            <div style={{marginTop: DS.spacing(5), padding: DS.spacing(3), background: DS.color.bg, borderRadius: DS.radius.md, border: `1px solid ${DS.color.border}`}}>
              <h4 style={{color: DS.color.textPrimary, fontSize: DS.font.size.sm, fontWeight: DS.font.weightSemibold, margin: `0 0 ${DS.spacing(3)}`}}>Prévia do GIF</h4>
              <img src={gifDataUrl} alt="Prévia do GIF" style={{maxWidth:'100%', border:`1px solid ${DS.color.borderSubtle}`, borderRadius: DS.radius.md, boxShadow: DS.shadow.sm}} />
            </div>
          )}
        </div>
      </div>
    </section>
    </Container>
  )
}

function clampDeg(n: number) {
  const x = Math.floor(Number.isFinite(n) ? n : 0)
  let m = x % 360
  if (m < 0) m += 360
  return m
}

function btn(): React.CSSProperties {
  return { background: DS.color.accent, color: '#ffffff', border:'none', padding: `${DS.spacing(2)} ${DS.spacing(4)}`, borderRadius: DS.radius.md, cursor:'pointer', fontSize: DS.font.size.sm, fontWeight: DS.font.weightMedium, transition: 'opacity 0.2s', boxShadow: DS.shadow.sm }
}

