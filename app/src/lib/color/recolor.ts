import { rgbToOKLab, oklchToOklab, oklabToOklch, oklabToRgb, clampOklchToSrgb } from './oklab'

export interface RecolorOptions {
  targetHex: string
  strength: number // 0..1 how much of the target chroma to inject (chroma strength)
  protectHighlights: boolean
  highlightThreshold?: number // percentile luminance (0.95 default)
  chromaSoftLimit?: number // soft chroma cap before compression
  hueStrength?: number // 0..1 how much to rotate hue toward target (default = strength)
  highlightBlend?: number // 0..1 fraction of effect suppressed in highlights (default 0.7)
  // Advanced controls
  midtoneBoost?: number // 0..1 extra chroma in midtones to avoid washed look (default 0.25)
  highlightHueBlend?: number // 0..1 reduce hue rotation in highlights (default 0.5)
  highlightNeutralize?: boolean // if true, keep highlights nearly neutral (very low chroma)
  // Dark-target controls
  toneMatch?: number // 0..1 mix OKLab L toward target L with masks (default 0)
  colorDensity?: number // 0..1 targeted chroma boost around high-mid L (default 0)
  deepDark?: number // 0..1 additional luminance pull toward target if target is darker (post toneMatch)
  highlightDarken?: number // 0..1 fraction of deepDark applied inside highlight mask (default 0 = keep highlights)
  // Optional external masks from preprocessing
  externalHighlightMask?: Uint8Array
  externalHighlightSoft?: Float32Array
}

export interface RecolorResult {
  canvas: HTMLCanvasElement
  stats: {
    meanL: number
    meanCBefore: number
    meanCAfter: number
    highlightPixels: number
  }
}

// Simple luminance from sRGB (BT.709 weights) expecting 0..255
function luminance(r: number,g: number,b: number){
  return 0.2126*r + 0.7152*g + 0.0722*b
}

// Build highlight mask using adaptive luminance percentile and low chroma condition
function buildHighlightMask(data: Uint8ClampedArray, w: number, h: number, perc: number): Uint8Array {
  const lum: number[] = []
  for (let i=0;i<data.length;i+=4) lum.push(luminance(data[i], data[i+1], data[i+2]))
  const sorted = lum.slice().sort((a,b)=>a-b)
  const idx = Math.floor(sorted.length * perc)
  const thr = sorted[idx]
  const mask = new Uint8Array(w*h)
  for (let i=0,p=0;i<data.length;i+=4,p++) {
    const r=data[i],g=data[i+1],b=data[i+2]
    const L=luminance(r,g,b)
    if (L >= thr) mask[p]=255
  }
  // quick 3x3 erosion then dilation (smooth edges)
  const tmp=new Uint8Array(w*h)
  // erosion
  for (let y=1;y<h-1;y++) for (let x=1;x<w-1;x++) {
    let keep=255
    for (let dy=-1;dy<=1;dy++) for (let dx=-1;dx<=1;dx++) if (mask[(y+dy)*w+(x+dx)]===0) keep=0
    tmp[y*w+x]=keep
  }
  // dilation
  const out=new Uint8Array(w*h)
  for (let y=1;y<h-1;y++) for (let x=1;x<w-1;x++) {
    let val=0
    for (let dy=-1;dy<=1;dy++) for (let dx=-1;dx<=1;dx++) if (tmp[(y+dy)*w+(x+dx)]===255){ val=255 }
    out[y*w+x]=val
  }
  return out
}

export function recolorFabric(source: HTMLImageElement | HTMLCanvasElement | ImageBitmap, opts: RecolorOptions): RecolorResult {
  const { targetHex, strength, protectHighlights } = opts
  const highlightPerc = opts.highlightThreshold ?? 0.97
  const softLimit = opts.chromaSoftLimit ?? 0.22 // allow a bit more saturation
  const hueStrength = opts.hueStrength ?? strength
  const highlightBlend = opts.highlightBlend ?? 0.8 // stronger suppression in highlights
  const midtoneBoost = Math.max(0, Math.min(1, opts.midtoneBoost ?? 0.25))
  const highlightHueBlend = Math.max(0, Math.min(1, opts.highlightHueBlend ?? 0.5))
  const highlightNeutralize = !!opts.highlightNeutralize
  const toneMatch = Math.max(0, Math.min(1, opts.toneMatch ?? 0))
  const colorDensity = Math.max(0, Math.min(1, opts.colorDensity ?? 0))
  const deepDark = Math.max(0, Math.min(1, opts.deepDark ?? 0))
  const highlightDarken = Math.max(0, Math.min(1, opts.highlightDarken ?? 0))

  // Parse target color
  const m = targetHex.match(/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/)
  if (!m) throw new Error('Invalid target hex color')
  const full = targetHex.length===4 ? '#' + targetHex[1]+targetHex[1]+targetHex[2]+targetHex[2]+targetHex[3]+targetHex[3] : targetHex
  const tr = parseInt(full.slice(1,3),16), tg = parseInt(full.slice(3,5),16), tb = parseInt(full.slice(5,7),16)
  const [tL, ta, tb_] = rgbToOKLab(tr,tg,tb)
  const [_, tC, tHue] = oklabToOklch(tL, ta, tb_)

  // Draw source to canvas (downscale optional)
  const w = (source as any).naturalWidth ?? (source as any).width
  const h = (source as any).naturalHeight ?? (source as any).height
  const maxDim = 1600
  const scale = Math.min(1, maxDim / Math.max(w,h))
  const dw = Math.round(w*scale), dh = Math.round(h*scale)
  const canvas = document.createElement('canvas')
  canvas.width = dw
  canvas.height = dh
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!
  ctx.drawImage(source as any, 0, 0, dw, dh)
  const img = ctx.getImageData(0,0,dw,dh)
  const { data } = img

  let highlightMask: Uint8Array | null = null
  if (protectHighlights) {
    if (opts.externalHighlightMask && opts.externalHighlightMask.length === dw*dh) {
      highlightMask = opts.externalHighlightMask
    } else {
      highlightMask = buildHighlightMask(data, dw, dh, highlightPerc)
    }
  }

  let sumL=0, count=0, sumCBefore=0, sumCAfter=0, highlightPixels=0

  for (let i=0;i<data.length;i+=4) {
    const r = data[i], g = data[i+1], b = data[i+2]
    const [L, a, b_] = rgbToOKLab(r,g,b)
    const [__, Cbefore, hueBefore] = oklabToOklch(L,a,b_)

    sumL += L; sumCBefore += Cbefore; count++

    // Determine target chroma scaled by strength; luminance may be mixed later via toneMatch
    // Interpolate hue from original toward target by hueStrength (angular interpolation)
    let deltaHue = tHue - hueBefore
    // wrap shortest angle
    if (deltaHue > 180) deltaHue -= 360
    if (deltaHue < -180) deltaHue += 360
    let localHueStrength = hueStrength

    // Desired chroma: blend current with target chroma
    let desiredC = Cbefore*(1-strength) + tC*strength
    // Soften in shadows to avoid muddy darks
    if (L < 0.25) desiredC *= (L/0.25)*0.85
    // Boost midtones to increase perceived color strength without blowing highlights
    // Midtone weight peaks at L≈0.5 and fades toward shadows/highlights
    const mid = Math.max(0, 1 - Math.abs((L - 0.5) / 0.35)) // ~0 at extremes, ~1 at mid
    if (midtoneBoost > 0) desiredC *= (1 + midtoneBoost * mid)
    // Targeted density boost around high-mid L (≈0.6–0.7)
    if (colorDensity > 0) {
      const dens = Math.max(0, 1 - Math.abs((L - 0.65) / 0.18)) // ~1 at 0.65
      desiredC *= (1 + colorDensity * 0.6 * dens)
    }
    // Cap chroma softly
    const softLimitLocal = Math.min(0.26, softLimit + 0.06 * mid)
    if (desiredC > softLimitLocal) desiredC = softLimitLocal + (desiredC-softLimitLocal)*0.3

    // Protect highlights: reduce chroma change where mask active
    const softW = opts.externalHighlightSoft && opts.externalHighlightSoft.length === dw*dh ? opts.externalHighlightSoft[i/4] : (highlightMask && highlightMask[i/4] === 255 ? 1 : 0)
    if (softW > 0) {
      highlightPixels++
      // Partially revert chroma and hue effect instead of full cancel
      const hb = highlightBlend * softW
      desiredC = desiredC*(1 - hb) + Cbefore*hb
      // Reduce hue rotation in highlights to keep speculars more neutral
      localHueStrength *= (1 - highlightHueBlend*softW)
      if (highlightNeutralize) {
        // Strongly reduce chroma in highlights to near-neutral
        desiredC = Math.min(desiredC, Cbefore*(0.25 + 0.5*(1-softW)))
      }
    }

    // Optionally mix luminance toward target to avoid pastel highlights on dark targets
    let mixedL = L
    if (toneMatch > 0) {
      // Avoid crushing deep shadows; ramp in from L~0.05 to 0.15
      const shadowRamp = Math.max(0, Math.min(1, (L - 0.05) / 0.10))
      // Reduce effect on hard highlights when present
      let highlightAtten = 1
      if (softW > 0) highlightAtten = 0.4*(1 - 0.6*softW) // stronger attenuation on strong highlights
      // Emphasize upper-mid luminance where sheen lives (center ~0.7)
      const upperMid = Math.max(0, 1 - Math.abs((L - 0.7) / 0.2))
      const shaping = 0.5 + 0.5 * upperMid
      const wL = toneMatch * shadowRamp * highlightAtten * shaping
      mixedL = L + wL * (tL - L)
    }

    // Additional deep darkening pass for dark targets (only if target luminance is lower)
    if (deepDark > 0 && tL < mixedL) {
      const pixelIsHighlight = highlightMask && highlightMask[i/4] === 255
      const atten = pixelIsHighlight ? highlightDarken : 1
      if (atten > 0 || !pixelIsHighlight) {
        // Weight by how much brighter we are than target (normalized by 1.0 range)
        const diff = mixedL - tL
        const pull = diff * deepDark * (pixelIsHighlight ? atten : 1)
        mixedL = mixedL - pull
      }
    }
    // Clamp mixedL to 0..1 safety
    if (mixedL < 0) mixedL = 0; else if (mixedL > 1) mixedL = 1

    // Convert back
    const hueBlend = hueBefore + deltaHue * localHueStrength
    const wrappedHue = (hueBlend % 360 + 360) % 360
    const [nL, nC, nHue] = clampOklchToSrgb(mixedL, desiredC, wrappedHue)
    sumCAfter += nC
    const [oL, oa, ob] = oklchToOklab(nL, nC, nHue)
    const [nr, ng, nb] = oklabToRgb(oL, oa, ob)
    data[i] = nr; data[i+1] = ng; data[i+2] = nb // preserve alpha
  }

  ctx.putImageData(img, 0, 0)

  return {
    canvas,
    stats: {
      meanL: sumL / count,
      meanCBefore: sumCBefore / count,
      meanCAfter: sumCAfter / count,
      highlightPixels
    }
  }
}

// Placeholder for future WebGL pipeline; we keep interface identical so we can swap
export function recolorFabricFastGL(_source: HTMLImageElement | HTMLCanvasElement | ImageBitmap, _opts: RecolorOptions): Promise<RecolorResult> {
  return Promise.reject(new Error('WebGL pipeline not implemented yet'))
}
