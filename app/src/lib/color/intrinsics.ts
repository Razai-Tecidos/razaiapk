import { rgbToOKLab, oklabToOklch, oklchToOklab, oklabToRgb, srgbToLinear, linearToSrgb, clampOklchToSrgb } from './oklab'
import { applyTonemapRGB } from './tone'

export interface IntrinsicsOptions {
  targetHex: string
  strength: number        // 0..1 chroma injection on albedo
  hueStrength?: number    // 0..1 hue rotation on albedo (defaults to strength)
  preserveHighlights?: boolean // keep specular highlights closer to original
  highlightPercentile?: number // 0..1 percentile for highlight detection (default 0.97)
  highlightNeutralize?: boolean // reduce chroma in highlights
  highlightPreserveWeight?: number // 0..1 how much original to keep in highlights when composing (default 0.7)
  highlightHueBlend?: number // reserved for future use to attenuate hue rotation inside highlights
  useTonemap?: boolean // apply filmic tone map at the end
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

function luminanceLinear(r: number, g: number, b: number) {
  // BT.709 on linear channels
  return 0.2126*r + 0.7152*g + 0.0722*b
}

function buildHighlightMaskFromLuminance(lums: Float32Array, w: number, h: number, perc: number): Uint8Array {
  const arr = Array.from(lums)
  const sorted = arr.slice().sort((a,b)=>a-b)
  const idx = Math.floor(sorted.length * perc)
  const thr = sorted[Math.max(0, Math.min(sorted.length-1, idx))]
  const mask = new Uint8Array(w*h)
  for (let i=0;i<lums.length;i++) if (lums[i] >= thr) mask[i] = 255
  return mask
}

export function recolorFabricIntrinsicsLite(source: HTMLImageElement | HTMLCanvasElement | ImageBitmap, opts: IntrinsicsOptions): RecolorResult {
  const {
    targetHex,
    strength,
    hueStrength = strength,
    preserveHighlights = true,
    highlightPercentile = 0.97,
    highlightNeutralize = true,
    highlightPreserveWeight = 0.7,
    useTonemap = false
  } = opts

  // parse target
  const m = targetHex.match(/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/)
  if (!m) throw new Error('Invalid target hex color')
  const full = targetHex.length===4 ? '#' + targetHex[1]+targetHex[1]+targetHex[2]+targetHex[2]+targetHex[3]+targetHex[3] : targetHex
  const tr = parseInt(full.slice(1,3),16), tg = parseInt(full.slice(3,5),16), tb = parseInt(full.slice(5,7),16)
  const [tL, ta, tb_] = rgbToOKLab(tr,tg,tb)
  const [_, tC, tHue] = oklabToOklch(tL, ta, tb_)

  // draw source
  const w = (source as any).naturalWidth ?? (source as any).width
  const h = (source as any).naturalHeight ?? (source as any).height
  const maxDim = 1600
  const scale = Math.min(1, maxDim / Math.max(w,h))
  const dw = Math.round(w*scale), dh = Math.round(h*scale)

  const canvas = document.createElement('canvas')
  canvas.width = dw; canvas.height = dh
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!
  ctx.drawImage(source as any, 0, 0, dw, dh)
  const img = ctx.getImageData(0,0,dw,dh)
  const data = img.data

  // compute linear RGB, luminance, and rough shading (S)
  const lin = new Float32Array((dw*dh)*3)
  const lum = new Float32Array(dw*dh)
  for (let p=0, i=0; i<data.length; i+=4, p++) {
    const r = srgbToLinear(data[i])
    const g = srgbToLinear(data[i+1])
    const b = srgbToLinear(data[i+2])
    lin[p*3+0] = r; lin[p*3+1] = g; lin[p*3+2] = b
    lum[p] = luminanceLinear(r,g,b)
  }
  // shading estimate S = local luminance (avoid zero)
  const S = lum

  // build or use external highlight mask
  let highlightMask: Uint8Array | null = null
  if (preserveHighlights) {
    if (opts.externalHighlightMask && opts.externalHighlightMask.length === dw*dh) {
      highlightMask = opts.externalHighlightMask
    } else {
      highlightMask = buildHighlightMaskFromLuminance(lum, dw, dh, highlightPercentile)
    }
  }

  // albedo A = lin / max(eps, S)
  const eps = 1e-4
  const A = new Float32Array(lin.length)
  for (let p=0; p<dw*dh; p++) {
    const s = Math.max(eps, S[p])
    A[p*3+0] = Math.min(3, lin[p*3+0] / s)
    A[p*3+1] = Math.min(3, lin[p*3+1] / s)
    A[p*3+2] = Math.min(3, lin[p*3+2] / s)
  }

  let sumL=0, sumCBefore=0, sumCAfter=0, count=0, highlightPixels=0

  // recolor the albedo in OKLab/OKLCh space
  for (let p=0; p<dw*dh; p++) {
    const ar = Math.max(0, Math.min(1, A[p*3+0]))
    const ag = Math.max(0, Math.min(1, A[p*3+1]))
    const ab = Math.max(0, Math.min(1, A[p*3+2]))
    const [L, a, b] = rgbToOKLab(Math.round(ar*255), Math.round(ag*255), Math.round(ab*255))
    const [__, Cbefore, hueBefore] = oklabToOklch(L, a, b)

    sumL += L; sumCBefore += Cbefore; count++

    let deltaHue = tHue - hueBefore
    if (deltaHue > 180) deltaHue -= 360
    if (deltaHue < -180) deltaHue += 360

    const desiredC = Cbefore*(1-strength) + tC*strength
    const hueBlend = hueBefore + deltaHue * hueStrength
    const wrappedHue = (hueBlend % 360 + 360) % 360

    const [nL, nC, nHue] = clampOklchToSrgb(L, desiredC, wrappedHue)
    sumCAfter += nC
    const [oL, oa, ob] = oklchToOklab(nL, nC, nHue)
    const [nr, ng, nb] = oklabToRgb(oL, oa, ob)
    // back to linear (0..1) — oklabToRgb returns 0..255 sRGB, pass directly
    A[p*3+0] = srgbToLinear(nr)
    A[p*3+1] = srgbToLinear(ng)
    A[p*3+2] = srgbToLinear(nb)
  }

  // compose: D' = A' * S, then preserve specular by blending with original using highlight mask
  for (let p=0; p<dw*dh; p++) {
    const Ds_r = A[p*3+0] * S[p]
    const Ds_g = A[p*3+1] * S[p]
    const Ds_b = A[p*3+2] * S[p]

    let r = Ds_r, g = Ds_g, b = Ds_b

    // weight for highlights; prefer soft external mask if given
    const softW = opts.externalHighlightSoft && opts.externalHighlightSoft.length === dw*dh ? opts.externalHighlightSoft[p] : (highlightMask && highlightMask[p] === 255 ? 1 : 0)
    if (softW > 0) {
      highlightPixels++
      // neutralize chroma in highlights if requested
      if (highlightNeutralize) {
        const avg = (r+g+b)/3
        const k = 0.9 * softW + 0.1*(1-softW)
        r = avg*k + r*(1-k)
        g = avg*k + g*(1-k)
        b = avg*k + b*(1-k)
      }
      // blend in some of the original to keep specular sheen
      const or = lin[p*3+0], og = lin[p*3+1], ob = lin[p*3+2]
      const w = highlightPreserveWeight * softW
      r = r*(1 - w) + or*w
      g = g*(1 - w) + og*w
      b = b*(1 - w) + ob*w
    }

    // optional tonemap then sRGB encode
    let outR = r, outG = g, outB = b
    if (useTonemap) [outR, outG, outB] = applyTonemapRGB(r,g,b)

    const sr = Math.round(Math.max(0, Math.min(255, linearToSrgb(outR)*255)))
    const sg = Math.round(Math.max(0, Math.min(255, linearToSrgb(outG)*255)))
    const sb = Math.round(Math.max(0, Math.min(255, linearToSrgb(outB)*255)))

    const i = p*4
    data[i] = sr; data[i+1] = sg; data[i+2] = sb
  }

  ctx.putImageData(img, 0, 0)

  return {
    canvas,
    stats: {
      meanL: sumL / Math.max(1, count),
      meanCBefore: sumCBefore / Math.max(1, count),
      meanCAfter: sumCAfter / Math.max(1, count),
      highlightPixels
    }
  }
}
