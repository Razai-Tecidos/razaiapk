// Helper to load images in Node-based tests using @napi-rs/canvas
async function loadFileAsImage(filePath: string): Promise<any> {
  const { loadImage } = await import('@napi-rs/canvas')
  return loadImage(filePath)
}
import path from 'node:path'
import fs from 'node:fs'
import { rgbToOKLab, oklabToOklch, parseHexColor } from '../../lib/color/oklab'
import { recolorFabric } from '../../lib/color/recolor'

export type FabricKind = 'light' | 'dark'

export interface Metrics {
  meanAbsDeltaL: number
  hueErrorMean: number | null
  hueErrorMedian: number | null
  highlightSuppressionRatio: number | null
  sampleCountHue: number
}

export async function loadFabric(kind: FabricKind) {
  const root = path.resolve(process.cwd(), '..')
  const localPath = path.resolve(root, 'test-images', kind === 'light' ? 'fabric_light.png' : 'fabric_dark.png')
  if (fs.existsSync(localPath)) {
    return await loadFileAsImage(localPath)
  }
  // Fallback: procedural satin-like image using gradients
  const { createCanvas } = await import('@napi-rs/canvas')
  const w = 768, h = 768
  const cnv = createCanvas(w, h)
  const ctx = cnv.getContext('2d')
  // base color
  ctx.fillStyle = kind === 'light' ? '#D8CDE5' : '#0C1E3E'
  ctx.fillRect(0,0,w,h)
  // highlights bands
  for (let i=0;i<12;i++){
    const y = (i/12)*h
    const g = ctx.createLinearGradient(0,y, w,y+h/8)
    const a = kind==='light'?0.55:0.35
    g.addColorStop(0, `rgba(255,255,255,0)`)
    g.addColorStop(0.5, `rgba(255,255,255,${a})`)
    g.addColorStop(1, `rgba(255,255,255,0)`)
    ctx.fillStyle = g
    ctx.fillRect(0, y-10, w, h/8+20)
  }
  // shadows swirls
  for (let i=0;i<9;i++){
    const y = (i/9)*h
    const g = ctx.createLinearGradient(0,y, w,y+h/6)
    const a = kind==='light'?0.25:0.45
    g.addColorStop(0, `rgba(0,0,0,0)`)
    g.addColorStop(0.5, `rgba(0,0,0,${a})`)
    g.addColorStop(1, `rgba(0,0,0,0)`)
    ctx.fillStyle = g
    ctx.fillRect(0, y-20, w, h/6+40)
  }
  return cnv as any
}

function luminance(r: number,g: number,b: number){
  return 0.2126*r + 0.7152*g + 0.0722*b
}

function buildHighlightMask(data: Uint8ClampedArray, w: number, h: number, perc: number): Uint8Array {
  const lum: number[] = []
  for (let i=0;i<data.length;i+=4) lum.push(luminance(data[i], data[i+1], data[i+2]))
  const sorted = lum.slice().sort((a,b)=>a-b)
  const idx = Math.floor(sorted.length * perc)
  const thr = sorted[idx]
  const mask = new Uint8Array(w*h)
  for (let i=0,p=0;i<data.length;i+=4,p++) {
    const L=luminance(data[i],data[i+1],data[i+2])
    if (L >= thr) mask[p]=255
  }
  return mask
}

export function computeMetrics(originalCanvas: HTMLCanvasElement, recoloredCanvas: HTMLCanvasElement, targetHex: string): Metrics {
  const w = recoloredCanvas.width, h = recoloredCanvas.height
  const octx = (originalCanvas as any).getContext('2d')
  const rctx = (recoloredCanvas as any).getContext('2d')
  const oimg = octx.getImageData(0,0,w,h)
  const rimg = rctx.getImageData(0,0,w,h)
  const dataO = oimg.data, dataR = rimg.data

  let sumAbsDL = 0
  const hueErrors: number[] = []
  let total = 0

  const rgbT = parseHexColor(targetHex)
  if (!rgbT) throw new Error('invalid target')
  const [tL, ta, tb] = rgbToOKLab(rgbT[0], rgbT[1], rgbT[2])
  const [_, __, tHue] = oklabToOklch(tL, ta, tb)

  const hlMask = buildHighlightMask(dataO, w, h, 0.97)
  let deltaCInside=0, cntInside=0, deltaCOutside=0, cntOutside=0

  for (let i=0;i<dataO.length;i+=4){
    const r1=dataO[i], g1=dataO[i+1], b1=dataO[i+2]
    const r2=dataR[i], g2=dataR[i+1], b2=dataR[i+2]
    const [L1,a1,b1_] = rgbToOKLab(r1,g1,b1)
    const [L2,a2,b2_] = rgbToOKLab(r2,g2,b2)
    const dL = Math.abs(L2 - L1)
    sumAbsDL += dL
    total++

    const [__, C2, h2] = oklabToOklch(L2,a2,b2_)
    if (C2 > 0.02) {
      let d = Math.abs(h2 - tHue)
      if (d > 180) d = 360 - d
      hueErrors.push(d)
    }

    const [___, C1] = oklabToOklch(L1,a1,b1_)
    const dC = Math.abs(C2 - C1)
    const pixelIndex = i/4
    if (hlMask[pixelIndex] === 255) { deltaCInside += dC; cntInside++ } else { deltaCOutside += dC; cntOutside++ }
  }

  hueErrors.sort((a,b)=>a-b)
  const meanAbsDeltaL = sumAbsDL / total
  const hueErrorMean = hueErrors.length? (hueErrors.reduce((a,b)=>a+b,0)/hueErrors.length) : null
  const hueErrorMedian = hueErrors.length? hueErrors[Math.floor(hueErrors.length/2)] : null
  const highlightSuppressionRatio = (cntInside>0 && cntOutside>0) ? (deltaCOutside/cntOutside) / (deltaCInside/cntInside) : null

  return { meanAbsDeltaL, hueErrorMean, hueErrorMedian, highlightSuppressionRatio, sampleCountHue: hueErrors.length }
}

export async function runRecolorAndMetrics(kind: FabricKind, targetHex: string, opts?: Partial<{ strength: number; hueStrength: number; protectHighlights: boolean }>) {
  const img = await loadFabric(kind)
  // Keep a copy of original draw for L comparison
  const w = (img as any).width
  const h = (img as any).height
  const { createCanvas } = await import('@napi-rs/canvas')
  const base = createCanvas(w,h) as any
  base.getContext('2d').drawImage(img as any, 0, 0, w, h)

  const res = recolorFabric(img as any, {
    targetHex,
    strength: opts?.strength ?? 0.85,
    hueStrength: opts?.hueStrength ?? 0.9,
    protectHighlights: opts?.protectHighlights ?? true,
  })
  const metrics = computeMetrics(base as any, res.canvas as any, targetHex)
  return { canvas: res.canvas, metrics }
}

// Extended helper for tests that need access to per-zone lightness deltas and full options
export async function loadFabricAndRecolor(params: {
  kind?: FabricKind
  targetHex: string
  options?: any
}) {
  const kind = params.kind ?? 'light'
  const targetHex = params.targetHex
  const opts = params.options ?? {}
  const img = await loadFabric(kind)
  const w = (img as any).width
  const h = (img as any).height
  const { createCanvas } = await import('@napi-rs/canvas')
  const base = createCanvas(w,h) as any
  base.getContext('2d').drawImage(img as any, 0, 0, w, h)

  const res = recolorFabric(img as any, {
    targetHex,
    strength: 0.9,
    hueStrength: 1,
    protectHighlights: true,
    ...opts,
  })

  // Compute extended zone metrics
  const octx = (base as any).getContext('2d')
  const rctx = (res.canvas as any).getContext('2d')
  const oimg = octx.getImageData(0,0,w,h)
  const rimg = rctx.getImageData(0,0,w,h)
  const hlMask = buildHighlightMask(oimg.data, w, h, 0.97)

  const dLHighlight: number[] = []
  const dLNonHighlight: number[] = []

  for (let i=0;i<oimg.data.length;i+=4){
    const r1=oimg.data[i], g1=oimg.data[i+1], b1=oimg.data[i+2]
    const r2=rimg.data[i], g2=rimg.data[i+1], b2=rimg.data[i+2]
    const [L1] = rgbToOKLab(r1,g1,b1)
    const [L2] = rgbToOKLab(r2,g2,b2)
    const arr = (hlMask[i/4]===255) ? dLHighlight : dLNonHighlight
    arr.push(L2 - L1)
  }

  const median = (arr: number[]) => {
    if (!arr.length) return 0
    const s = arr.slice().sort((a,b)=>a-b)
    return s[Math.floor(s.length/2)]
  }

  const metricsBasic = computeMetrics(base as any, res.canvas as any, targetHex)
  const metrics = {
    ...metricsBasic,
    highlight: { medianDeltaL: median(dLHighlight) },
    nonHighlight: { medianDeltaL: median(dLNonHighlight) },
  }

  return { canvas: res.canvas, metrics }
}
