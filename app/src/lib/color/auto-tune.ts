import { rgbToOKLab, oklabToOklch } from './oklab'

export interface AutoTuneParams {
  strength: number
  hueStrength: number
  protectHighlights: boolean
  highlightBlend: number
  highlightHueBlend: number
  highlightNeutralize: boolean
  midtoneBoost: number
  toneMatch: number
  colorDensity: number
  deepDark: number
  highlightDarken: number
}

interface SubstrateMetrics {
  medianL: number
  p95L: number
  p5L: number
  meanC: number
  highlightCoverage: number
  isGlossy: boolean
}

function luminance(r:number,g:number,b:number){
  return 0.2126*r + 0.7152*g + 0.0722*b
}

function sampleSubstrate(source: HTMLImageElement | HTMLCanvasElement | ImageBitmap, maxSamples = 12000): SubstrateMetrics {
  // Suporte tanto para Image quanto para Canvas facade (napi)
  const w = (source as any).naturalWidth ?? (source as any).width
  const h = (source as any).naturalHeight ?? (source as any).height
  let data: Uint8ClampedArray
  if (typeof (source as any).getContext === 'function') {
    // Já é um canvas; ler pixels diretamente
    const ctxSrc = (source as any).getContext('2d', { willReadFrequently: true })
    if (!ctxSrc) throw new Error('Contexto não disponível para autoTune')
    const img = ctxSrc.getImageData(0,0,w,h)
    data = img.data
  } else {
    // Criar canvas temporário e desenhar
    const canvas = document.createElement('canvas')
    canvas.width = w
    canvas.height = h
    const ctx = canvas.getContext('2d', { willReadFrequently: true })!
    ctx.drawImage(source as any, 0,0,w,h)
    const img = ctx.getImageData(0,0,w,h)
    data = img.data
  }
  const step = Math.max(1, Math.floor((data.length/4) / maxSamples))
  const Ls: number[] = []
  let sumC=0, cCount=0, hlCount=0, total=0
  for (let i=0;i<data.length;i+=4*step){
    const r=data[i], g=data[i+1], b=data[i+2]
    const [L,a,b_] = rgbToOKLab(r,g,b)
    const [__, C] = oklabToOklch(L,a,b_)
    Ls.push(L)
    sumC += C; cCount++
    total++
  }
  const sorted = Ls.slice().sort((a,b)=>a-b)
  const medianL = sorted[Math.floor(sorted.length/2)]
  const p95L = sorted[Math.floor(sorted.length*0.95)]
  const p5L = sorted[Math.floor(sorted.length*0.05)]
  // highlight coverage estimate: proportion of samples above p95L
  const thr = p95L
  for (const L of Ls) if (L >= thr) hlCount++
  const highlightCoverage = hlCount / Ls.length
  const meanC = sumC / cCount
  // heuristic glossy: wide L range + some highlight coverage
  const range = p95L - p5L
  const isGlossy = highlightCoverage > 0.04 && range > 0.35
  return { medianL, p95L, p5L, meanC, highlightCoverage, isGlossy }
}

export function autoTuneRecolor(source: HTMLImageElement | HTMLCanvasElement | ImageBitmap, targetHex: string): AutoTuneParams {
  // Parse target
  const m = targetHex.match(/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/)
  if (!m) throw new Error('HEX inválido para autoTune')
  const full = targetHex.length===4 ? '#' + targetHex[1]+targetHex[1]+targetHex[2]+targetHex[2]+targetHex[3]+targetHex[3] : targetHex
  const tr = parseInt(full.slice(1,3),16), tg = parseInt(full.slice(3,5),16), tb = parseInt(full.slice(5,7),16)
  const [tL, ta, tb_] = rgbToOKLab(tr,tg,tb)
  const [__, tC] = oklabToOklch(tL, ta, tb_)

  const s = sampleSubstrate(source)

  // Base parameters
  const strength = 0.9
  let hueStrength = 0.9
  const protectHighlights = true

  // Hue strength: increase if hue difference large (approx via chroma mean as proxy)
  hueStrength = strength // unify for simplicity

  // Midtone boost: if target chroma significantly above substrate mean chroma
  let midtoneBoost = 0.25
  if (tC > s.meanC * 1.6) midtoneBoost = Math.min(0.5, 0.25 + (tC - s.meanC)/0.6 * 0.15)
  else if (tC < s.meanC * 0.7) midtoneBoost = Math.max(0.15, 0.25 - (s.meanC - tC)/0.5 * 0.12)

  // Tone / darkening logic
  const lumDiff = s.medianL - tL
  let toneMatch = 0
  let deepDark = 0
  if (lumDiff > 0.02) {
    toneMatch = Math.min(0.6, lumDiff / 0.5)
    // Additional deep dark if much darker target
    if (lumDiff > 0.10) deepDark = Math.min(0.7, (lumDiff - 0.08)/0.5)
  }

  // Color density for high-mid sheen fabrics: if glossy & target mid L
  let colorDensity = 0
  if (s.isGlossy && tL >= 0.35 && tL <= 0.75) {
    colorDensity = 0.25
    if (tC > 0.10) colorDensity += 0.1
    colorDensity = Math.min(0.4, colorDensity)
  }

  // Highlight protection & darken
  let highlightBlend = 0.65
  const highlightHueBlend = s.isGlossy ? 0.5 : 0.3
  let highlightNeutralize = s.isGlossy && tL < s.medianL ? false : true

  let highlightDarken = 0
  if (deepDark > 0 && s.highlightCoverage > 0.03) {
    highlightDarken = Math.min(0.45, deepDark * 0.55 * (1 - tL))
  }

  // If target much brighter than substrate -> reduce highlight suppression
  if (tL > s.medianL + 0.08) {
    highlightBlend = Math.max(0.45, highlightBlend - 0.15)
    highlightNeutralize = false
  }

  // Guard rails
  const clamp01 = (v:number)=> Math.max(0, Math.min(1,v))
  return {
    strength: clamp01(strength),
    hueStrength: clamp01(hueStrength),
    protectHighlights,
    highlightBlend: clamp01(highlightBlend),
    highlightHueBlend: clamp01(highlightHueBlend),
    highlightNeutralize,
    midtoneBoost: clamp01(midtoneBoost),
    toneMatch: clamp01(toneMatch),
    colorDensity: clamp01(colorDensity),
    deepDark: clamp01(deepDark),
    highlightDarken: clamp01(highlightDarken)
  }
}

// (Futuro) Função refinamento leve via busca local – placeholder
export function refineAutoParams(_source: HTMLImageElement | HTMLCanvasElement | ImageBitmap, params: AutoTuneParams, _targetHex: string): AutoTuneParams {
  return params
}
