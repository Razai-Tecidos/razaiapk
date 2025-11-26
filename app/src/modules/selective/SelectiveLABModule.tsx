import React, { useRef, useState } from 'react'
import { Button, Group, Stack, TextInput, Slider, Switch, Card, Loader, Text, Select } from '@mantine/core'
import { recolorFabric } from '../../lib/color/recolor'
import { recolorFabricIntrinsicsLite } from '../../lib/color/intrinsics'
import { preprocessImage } from '../../lib/color/preprocess'
import { rgbToOKLab } from '../../lib/color/oklab'
import { autoFitIntrinsics } from '../../lib/color/auto-fit'
import { autoTuneRecolor } from '../../lib/color/auto-tune'

type PresetKey = 'seda' | 'sedaDark' | 'algodao' | 'veludo'
type Preset = {
  strength: number
  protectHighlights: boolean
  label: string
  hueStrength?: number
  highlightHueBlend?: number
  highlightNeutralize?: boolean
  midtoneBoost?: number
  highlightBlend?: number
  toneMatch?: number
  colorDensity?: number
  deepDark?: number
  highlightDarken?: number
}
const PRESETS: Record<PresetKey, Preset> = {
  // Satin is very sensitive to chroma in speculars; start more conservative
  seda: { strength: 0.75, protectHighlights: true, label: 'Seda (brilhos fortes, preserva highl.)', hueStrength: 0.8, highlightHueBlend: 0.75, highlightNeutralize: true, midtoneBoost: 0.25, highlightBlend: 0.9, toneMatch: 0, colorDensity: 0, deepDark: 0, highlightDarken: 0 },
  sedaDark: { strength: 0.85, protectHighlights: true, label: 'Seda (alvo escuro: tom + menos proteção)', hueStrength: 0.85, highlightHueBlend: 0.5, highlightNeutralize: true, midtoneBoost: 0.25, highlightBlend: 0.7, toneMatch: 0.45, colorDensity: 0.25, deepDark: 0.5, highlightDarken: 0.25 },
  algodao: { strength: 0.95, protectHighlights: false, label: 'Algodão (difuso, pouca proteção)', hueStrength: 0.9, highlightHueBlend: 0.2, highlightNeutralize: false, midtoneBoost: 0.4, highlightBlend: 0.3, toneMatch: 0.15, colorDensity: 0.2, deepDark: 0.15, highlightDarken: 0.05 },
  veludo: { strength: 0.7, protectHighlights: true, label: 'Veludo (reduzir saturação nas sombras)', hueStrength: 0.8, highlightHueBlend: 0.6, highlightNeutralize: true, midtoneBoost: 0.2, highlightBlend: 0.7, toneMatch: 0.2, colorDensity: 0.15, deepDark: 0.25, highlightDarken: 0.15 }
}

export default function SelectiveLABModule() {
  const fileRef = useRef<HTMLInputElement>(null)
  const [originalEl, setOriginalEl] = useState<HTMLImageElement | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [hex, setHex] = useState<string>('#80574C')
  const [strength, setStrength] = useState<number>(0.85)
  const [protectHighlights, setProtectHighlights] = useState<boolean>(true)
  const [hueStrength, setHueStrength] = useState<number>(0.85)
  const [fullHue, setFullHue] = useState<boolean>(false)
  const [highlightHueBlend, setHighlightHueBlend] = useState<number>(0.5)
  const [highlightNeutralize, setHighlightNeutralize] = useState<boolean>(true)
  const [midtoneBoost, setMidtoneBoost] = useState<number>(0.25)
  const [highlightBlend, setHighlightBlend] = useState<number>(0.8)
  const [toneMatch, setToneMatch] = useState<number>(0)
  const [colorDensity, setColorDensity] = useState<number>(0)
  const [deepDark, setDeepDark] = useState<number>(0)
  const [highlightDarken, setHighlightDarken] = useState<number>(0)
  const [loading, setLoading] = useState<boolean>(false)
  const [stats, setStats] = useState<null | { meanL: number; meanCBefore: number; meanCAfter: number; highlightPixels: number }>(null)
  const [preset, setPreset] = useState<PresetKey>('seda')
  const [showAdvanced, setShowAdvanced] = useState<boolean>(true)
  const [autoApplied, setAutoApplied] = useState<boolean>(false)
  const [pipeline, setPipeline] = useState<'classic'|'intrinsics'>('classic')
  const [usePreprocess, setUsePreprocess] = useState<boolean>(true)
  const [pre, setPre] = useState<null | { canvas: HTMLCanvasElement; masks: { highlightBinary: Uint8Array; highlightSoft: Float32Array; diffuseBinary: Uint8Array } }>(null)

  const applyPreset = (key: PresetKey) => {
    const p = PRESETS[key]
    setPreset(key)
    setStrength(p.strength)
    setHueStrength(p.hueStrength ?? p.strength)
    setProtectHighlights(p.protectHighlights)
    if (typeof p.highlightHueBlend === 'number') setHighlightHueBlend(p.highlightHueBlend)
    if (typeof p.highlightNeutralize === 'boolean') setHighlightNeutralize(p.highlightNeutralize)
    if (typeof p.midtoneBoost === 'number') setMidtoneBoost(p.midtoneBoost)
    if (typeof p.highlightBlend === 'number') setHighlightBlend(p.highlightBlend)
    if (typeof p.toneMatch === 'number') setToneMatch(p.toneMatch)
    if (typeof p.colorDensity === 'number') setColorDensity(p.colorDensity)
    if (typeof p.deepDark === 'number') setDeepDark(p.deepDark)
    if (typeof p.highlightDarken === 'number') setHighlightDarken(p.highlightDarken)
  }

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      setOriginalEl(img)
      setPreviewUrl(url) // show original first
      // kick off preprocess asynchronously
      try {
        const r = preprocessImage(img)
        setPre({ canvas: r.canvas, masks: r.masks })
      } catch (err) {
        console.warn('preprocess failed:', err)
        setPre(null)
      }
    }
      img.src = url
  }

  const handleRecolor = async () => {
    if (!originalEl) return
    setLoading(true)
    try {
      const srcEl = usePreprocess && pre?.canvas ? pre.canvas : originalEl
      const result = pipeline === 'classic'
        ? recolorFabric(originalEl, {
            targetHex: hex,
            strength,
            hueStrength: fullHue ? 1 : hueStrength,
            protectHighlights,
            highlightBlend,
            highlightHueBlend,
            highlightNeutralize,
            midtoneBoost,
            // auto-toneMatch when preprocessed: push diffuse L toward target
            toneMatch: (usePreprocess && pre)
              ? (()=>{ const [tL] = rgbToOKLab(parseInt(hex.slice(1,3),16), parseInt(hex.slice(3,5),16), parseInt(hex.slice(5,7),16)); return Math.max(toneMatch, Math.min(1, Math.abs(tL - 0.6) * 1.1)) })()
              : toneMatch,
            colorDensity,
            deepDark,
            highlightDarken,
            externalHighlightMask: usePreprocess && pre ? pre.masks.highlightBinary : undefined,
            externalHighlightSoft: usePreprocess && pre ? pre.masks.highlightSoft : undefined
          })
        : recolorFabricIntrinsicsLite(srcEl!, {
            targetHex: hex,
            strength,
            hueStrength: fullHue ? 1 : hueStrength,
            preserveHighlights: protectHighlights,
            highlightNeutralize,
            highlightPreserveWeight: highlightBlend,
            // higher percentile for glossy fabrics presets to isolate the hottest speculars
            highlightPercentile: protectHighlights
              ? (preset === 'seda' ? 0.992 : preset === 'sedaDark' ? 0.988 : preset === 'veludo' ? 0.985 : 0.97)
              : undefined,
            externalHighlightMask: usePreprocess && pre ? pre.masks.highlightBinary : undefined,
            externalHighlightSoft: usePreprocess && pre ? pre.masks.highlightSoft : undefined,
            // slight filmic tone map for glossy fabrics
            useTonemap: true
          })
      setStats(result.stats)
      setPreviewUrl(result.canvas.toDataURL('image/png'))
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  const handleAuto = () => {
    if (!originalEl) return
    try {
      if (pipeline === 'classic') {
        const params = autoTuneRecolor(originalEl, hex)
        setStrength(params.strength)
        setHueStrength(params.hueStrength)
        setProtectHighlights(params.protectHighlights)
        setHighlightBlend(params.highlightBlend)
        setHighlightHueBlend(params.highlightHueBlend)
        setHighlightNeutralize(params.highlightNeutralize)
        setMidtoneBoost(params.midtoneBoost)
        setToneMatch(params.toneMatch)
        setColorDensity(params.colorDensity)
        setDeepDark(params.deepDark)
        setHighlightDarken(params.highlightDarken)
      } else {
        const p = autoFitIntrinsics(originalEl, hex)
        if (typeof p.strength === 'number') setStrength(p.strength)
        if (typeof p.hueStrength === 'number') setHueStrength(p.hueStrength)
        if (typeof p.preserveHighlights === 'boolean') setProtectHighlights(p.preserveHighlights)
        if (typeof p.highlightPreserveWeight === 'number') setHighlightBlend(p.highlightPreserveWeight)
        if (typeof p.highlightHueBlend === 'number') setHighlightHueBlend(p.highlightHueBlend)
        if (typeof p.highlightNeutralize === 'boolean') setHighlightNeutralize(p.highlightNeutralize)
      }
      setAutoApplied(true)
      // Optionally recolor immediately for fast feedback
      handleRecolor()
    } catch (e) {
      console.error(e)
    }
  }

  const handleReset = () => {
    if (!originalEl) return
    // show original again
    setPreviewUrl(originalEl.src)
    setStats(null)
  }

  const download = () => {
    if (!previewUrl) return
    const a = document.createElement('a')
    a.href = previewUrl
    a.download = 'tecido-recolorizado.png'
    a.click()
  }

  return (
    <Stack align="center" justify="flex-start" style={{ minHeight: '80vh', width: '100%', paddingTop: 24 }}>
      <Group>
        <Button onClick={() => fileRef.current?.click()} variant="filled">Carregar imagem</Button>
        <Button onClick={download} disabled={!previewUrl}>Salvar imagem</Button>
        <Button variant="default" onClick={handleReset} disabled={!originalEl}>Resetar</Button>
        <input type="file" accept="image/*" ref={fileRef} style={{ display: 'none' }} onChange={handleFile} />
      </Group>
      {previewUrl && (
        <Card shadow="sm" padding="md" radius="md" withBorder style={{ background: 'rgba(255,255,255,0.02)' }}>
          <img src={previewUrl} alt="Prévia" style={{ maxWidth: 640, maxHeight: 640, display: 'block', borderRadius: 8 }} />
        </Card>
      )}
      <Card shadow="sm" padding="md" radius="md" withBorder style={{ width: 640, background: 'rgba(255,255,255,0.02)' }}>
        <Stack gap="md">
          <Group justify="space-between">
            <Text fw={600}>Parâmetros de Recolorização</Text>
            <Select
              data={Object.entries(PRESETS).map(([k,v])=>({ value:k, label:v.label }))}
              value={preset}
              onChange={(val)=> val && applyPreset(val as PresetKey)}
              placeholder="Preset"
              w={300}
            />
          </Group>
          <Group>
            <TextInput label="Cor HEX" value={hex} onChange={e=> { setHex(e.currentTarget.value); setAutoApplied(false) }} style={{ width: 140 }} />
            <input type="color" value={hex} onChange={e=> { setHex(e.target.value); setAutoApplied(false) }} style={{ width: 42, height: 42, border: 'none', background: 'none' }} />
            <Switch label="Proteger brilhos" checked={protectHighlights} onChange={e=> { setProtectHighlights(e.currentTarget.checked); setAutoApplied(false) }} />
            <Switch label="Hue total" checked={fullHue} onChange={e=> setFullHue(e.currentTarget.checked)} />
            <Select
              data={[{value:'classic',label:'Pipeline: Classic (OKLab)'},{value:'intrinsics',label:'Pipeline: Intrinsics‑lite'}]}
              value={pipeline}
              onChange={(v)=> { if (v === 'classic' || v === 'intrinsics') setPipeline(v) }}
              w={240}
            />
          </Group>
          <Group>
            <Button variant="light" onClick={handleAuto} disabled={!originalEl || loading}>Auto Ajuste</Button>
            <Switch label="Avançado" checked={showAdvanced} onChange={e=> setShowAdvanced(e.currentTarget.checked)} />
            <Switch label="Auto pré-processo (WB/Exposição/Brilhos)" checked={usePreprocess} onChange={e=> setUsePreprocess(e.currentTarget.checked)} />
            {autoApplied && <Text size="xs" c="green">Auto OK</Text>}
          </Group>
          {showAdvanced && <Stack gap={4}>
            <Text size="sm">Força da crominância: {Math.round(strength*100)}%</Text>
            <Slider value={strength} onChange={setStrength} min={0} max={1} step={0.01} marks={[{value:0,label:'0%'},{value:1,label:'100%'}]} />
          </Stack>}
          {showAdvanced && <Stack gap={4}>
            <Text size="sm">Força da rotação de Hue: {fullHue ? '100% (forçado)' : Math.round(hueStrength*100)+'%'} </Text>
            <Slider value={fullHue ? 1 : hueStrength} disabled={fullHue} onChange={setHueStrength} min={0} max={1} step={0.01} marks={[{value:0,label:'0%'},{value:1,label:'100%'}]} />
          </Stack>}
          {showAdvanced && <Stack gap={4}>
            <Text size="sm">Proteção de Hue nos brilhos: {Math.round(highlightHueBlend*100)}%</Text>
            <Slider value={highlightHueBlend} onChange={setHighlightHueBlend} min={0} max={1} step={0.01} marks={[{value:0,label:'0%'},{value:1,label:'100%'}]} />
          </Stack>}
          {showAdvanced && <Stack gap={4}>
            <Text size="sm">Supressão de cor nos brilhos: {Math.round(highlightBlend*100)}%</Text>
            <Slider value={highlightBlend} onChange={setHighlightBlend} min={0} max={1} step={0.01} marks={[{value:0,label:'0%'},{value:1,label:'100%'}]} />
          </Stack>}
          {showAdvanced && <Stack gap={4}>
            <Text size="sm">Boost de cor nos meios-tons: {Math.round(midtoneBoost*100)}%</Text>
            <Slider value={midtoneBoost} onChange={setMidtoneBoost} min={0} max={1} step={0.01} marks={[{value:0,label:'0%'},{value:1,label:'100%'}]} />
          </Stack>}
          {showAdvanced && <Stack gap={4}>
            <Text size="sm">Aproximar luminosidade do alvo (Tone match): {Math.round(toneMatch*100)}%</Text>
            <Slider value={toneMatch} onChange={setToneMatch} min={0} max={1} step={0.01} marks={[{value:0,label:'0%'},{value:1,label:'100%'}]} />
          </Stack>}
          {showAdvanced && <Stack gap={4}>
            <Text size="sm">Densidade de cor (high‑mids): {Math.round(colorDensity*100)}%</Text>
            <Slider value={colorDensity} onChange={setColorDensity} min={0} max={1} step={0.01} marks={[{value:0,label:'0%'},{value:1,label:'100%'}]} />
          </Stack>}
          {showAdvanced && <Stack gap={4}>
            <Text size="sm">Escurecer tecido (deep dark): {Math.round(deepDark*100)}%</Text>
            <Slider value={deepDark} onChange={setDeepDark} min={0} max={1} step={0.01} marks={[{value:0,label:'0%'},{value:1,label:'100%'}]} />
          </Stack>}
          {showAdvanced && <Stack gap={4}>
            <Text size="sm">Escurecer brilhos: {Math.round(highlightDarken*100)}%</Text>
            <Slider value={highlightDarken} onChange={setHighlightDarken} min={0} max={1} step={0.01} marks={[{value:0,label:'0%'},{value:1,label:'100%'}]} />
          </Stack>}
          {showAdvanced && <Switch label="Neutralizar brilhos (evitar estourar)" checked={highlightNeutralize} onChange={e=> setHighlightNeutralize(e.currentTarget.checked)} />}
          <Group>
            <Button onClick={handleRecolor} disabled={!originalEl || loading}>Aplicar Recolor</Button>
            {loading && <Loader size="sm" />}
          </Group>
          {stats && (
            <Text size="xs" c="dimmed">
              Lmédia {stats.meanL.toFixed(3)} | C antes {stats.meanCBefore.toFixed(3)} → depois {stats.meanCAfter.toFixed(3)} | pixels highlight preservados {stats.highlightPixels}
            </Text>
          )}
          <Text size="xs" c="dimmed">
            Pipeline: {pipeline === 'classic' ? 'OKLab clássico com preservação de L' : 'Intrinsics‑lite (albedo·sombreamento + preservação de especular)'}.
            Hue interpolado; proteção/supressão de highlights; neutralização opcional; reforço de cor; clamp de gamut. Intrinsics faz separação difusa/especular e recomposição com leve tone map.
          </Text>
        </Stack>
      </Card>
    </Stack>
  )
}
