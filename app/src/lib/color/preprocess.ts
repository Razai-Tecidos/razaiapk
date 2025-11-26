import { rgbToOKLab, oklabToOklch, srgbToLinear, linearToSrgb } from './oklab'

export interface PreprocessMasks {
  highlightBinary: Uint8Array
  highlightSoft: Float32Array
  diffuseBinary: Uint8Array
}

export interface PreprocessResult {
  canvas: HTMLCanvasElement
  wbGains: [number, number, number]
  exposureGain: number
  masks: PreprocessMasks
}

function luminanceLinear(r: number, g: number, b: number) {
  return 0.2126*r + 0.7152*g + 0.0722*b
}

function percentile(values: number[], p: number) {
  if (values.length === 0) return 0
  const idx = Math.max(0, Math.min(values.length - 1, Math.floor(values.length * p)))
  const sorted = values.slice().sort((a,b)=>a-b)
  return sorted[idx]
}

function boxBlurMaskToSoft(mask: Uint8Array, w: number, h: number, radius = 3): Float32Array {
  const out = new Float32Array(w*h)
  const kernel = (radius*2 + 1)
  // horizontal pass
  const tmp = new Float32Array(w*h)
  for (let y=0;y<h;y++) {
    let acc = 0
    for (let x=-radius;x<=radius;x++) {
      const xx = Math.max(0, Math.min(w-1, x))
      acc += mask[y*w + xx]
    }
    for (let x=0;x<w;x++) {
      const i = y*w + x
      tmp[i] = acc / (kernel*255)
      const xOut = x - radius
      const xIn = x + radius + 1
      if (xOut >= 0) acc -= mask[y*w + xOut]
      const xxIn = Math.max(0, Math.min(w-1, xIn))
      acc += mask[y*w + xxIn]
    }
  }
  // vertical pass
  for (let x=0;x<w;x++) {
    let acc = 0
    for (let y=-radius;y<=radius;y++) {
      const yy = Math.max(0, Math.min(h-1, y))
      acc += tmp[yy*w + x]
    }
    for (let y=0;y<h;y++) {
      const i = y*w + x
      out[i] = Math.max(0, Math.min(1, acc / kernel))
      const yOut = y - radius
      const yIn = y + radius + 1
      if (yOut >= 0) acc -= tmp[yOut*w + x]
      const yyIn = Math.max(0, Math.min(h-1, yIn))
      acc += tmp[yyIn*w + x]
    }
  }
  return out
}

export function preprocessImage(source: HTMLImageElement | HTMLCanvasElement | ImageBitmap, options?: { maxDim?: number, highlightPercentile?: number }): PreprocessResult {
  const maxDim = options?.maxDim ?? 640
  const w0 = (source as any).naturalWidth ?? (source as any).width
  const h0 = (source as any).naturalHeight ?? (source as any).height
  const scale = Math.min(1, maxDim / Math.max(w0,h0))
  const w = Math.max(1, Math.round(w0 * scale))
  const h = Math.max(1, Math.round(h0 * scale))

  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!
  ctx.drawImage(source as any, 0, 0, w, h)
  const img = ctx.getImageData(0,0,w,h)
  const data = img.data

  // Build linear buffer and collect gray candidates (low chroma) + luminance stats
  const lin = new Float32Array(w*h*3)
  const lum: number[] = []
  const grayIdx: number[] = []
  for (let p=0, i=0; i<data.length; i+=4, p++) {
    const r8 = data[i], g8 = data[i+1], b8 = data[i+2]
    const r = srgbToLinear(r8)
    const g = srgbToLinear(g8)
    const b = srgbToLinear(b8)
    lin[p*3+0] = r; lin[p*3+1] = g; lin[p*3+2] = b
    const [L,a,b_] = rgbToOKLab(r8, g8, b8)
    const [__, C] = oklabToOklch(L,a,b_)
    lum.push(luminanceLinear(r,g,b))
    if (C < 0.03) grayIdx.push(p)
  }

  // Exclude top luminance from gray set (avoid highlights)
  const thrHigh = percentile(lum, 0.99)
  const grayIdxFilt = grayIdx.filter(p => lum[p] < thrHigh)

  // Estimate WB gains from gray set (gray-world on linear)
  let sumR=0, sumG=0, sumB=0
  let count=0
  for (const p of grayIdxFilt) {
    sumR += lin[p*3+0]; sumG += lin[p*3+1]; sumB += lin[p*3+2]
    count++
  }
  const meanR = count>0 ? sumR/count : 1
  const meanG = count>0 ? sumG/count : 1
  const meanB = count>0 ? sumB/count : 1
  const meanAvg = (meanR + meanG + meanB) / 3
  let gR = meanAvg / (meanR || 1)
  let gG = meanAvg / (meanG || 1)
  let gB = meanAvg / (meanB || 1)
  // Normalize gains to keep luminance approximately stable
  const lumGain = 0.2126*gR + 0.7152*gG + 0.0722*gB
  gR /= lumGain; gG /= lumGain; gB /= lumGain

  // Apply WB gains
  for (let p=0; p<w*h; p++) {
    lin[p*3+0] *= gR
    lin[p*3+1] *= gG
    lin[p*3+2] *= gB
  }

  // Exposure normalization: match diffuse median L to ~0.60 using 2 iterations
  // Build provisional highlight mask and diffuse mask
  const lum2: number[] = new Array(w*h)
  for (let p=0; p<w*h; p++) lum2[p] = luminanceLinear(lin[p*3+0], lin[p*3+1], lin[p*3+2])
  const highPerc = Math.max(0.97, Math.min(0.999, options?.highlightPercentile ?? 0.985))
  const thrH = percentile(lum2, highPerc)
  const highlightBinary = new Uint8Array(w*h)
  for (let p=0; p<w*h; p++) if (lum2[p] >= thrH) highlightBinary[p] = 255
  const highlightSoft = boxBlurMaskToSoft(highlightBinary, w, h, 3)
  const lowThr = percentile(lum2, 0.05)
  const diffuseBinary = new Uint8Array(w*h)
  for (let p=0; p<w*h; p++) if (highlightBinary[p] === 0 && lum2[p] > lowThr) diffuseBinary[p] = 255

  function medianDiffuseL(scaleExp: number) {
    const vals: number[] = []
    for (let p=0; p<w*h; p++) {
      if (!diffuseBinary[p]) continue
      const r = lin[p*3+0] * scaleExp
      const g = lin[p*3+1] * scaleExp
      const b = lin[p*3+2] * scaleExp
      const R8 = Math.max(0, Math.min(255, Math.round(linearToSrgb(r)*255)))
      const G8 = Math.max(0, Math.min(255, Math.round(linearToSrgb(g)*255)))
      const B8 = Math.max(0, Math.min(255, Math.round(linearToSrgb(b)*255)))
      const [L] = rgbToOKLab(R8,G8,B8)
      vals.push(L)
    }
    if (vals.length === 0) return 0.6
    vals.sort((a,b)=>a-b)
    return vals[Math.floor(vals.length/2)]
  }

  const targetL = 0.60
  let s = 1.0
  for (let it=0; it<2; it++) {
    const medL = medianDiffuseL(s)
    if (medL <= 1e-6) break
    const ratio = targetL / medL
    // damped update to avoid overshoot
    s *= Math.max(0.7, Math.min(1.3, Math.pow(ratio, 1.2)))
  }

  // Apply exposure gain and write back to canvas
  for (let p=0, i=0; p<w*h; p++, i+=4) {
    const r = lin[p*3+0] * s
    const g = lin[p*3+1] * s
    const b = lin[p*3+2] * s
    data[i]   = Math.max(0, Math.min(255, Math.round(linearToSrgb(r)*255)))
    data[i+1] = Math.max(0, Math.min(255, Math.round(linearToSrgb(g)*255)))
    data[i+2] = Math.max(0, Math.min(255, Math.round(linearToSrgb(b)*255)))
  }
  ctx.putImageData(img, 0, 0)

  return {
    canvas,
    wbGains: [gR, gG, gB],
    exposureGain: s,
    masks: { highlightBinary, highlightSoft, diffuseBinary }
  }
}
