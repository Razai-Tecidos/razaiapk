import { rgbToXyz, xyzToLab, labToXyz, xyzToRgb, type LAB } from '@/lib/color-utils'

export interface NeutralExtractionOptions {
  // Desired global mean lightness for the neutral texture (0..100)
  targetLightness?: number
  // Percentage of width/height to ignore at each edge when computing global stats
  marginPercent?: number // e.g., 0.02..0.05
}

function clamp01(x: number) { return Math.min(1, Math.max(0, x)) }

// Read a pixel (r,g,b,a) from ImageData into 8-bit integers
function readRGBA(data: Uint8ClampedArray, idx: number) {
  return [data[idx], data[idx+1], data[idx+2], data[idx+3]] as [number, number, number, number]
}

// Write a pixel (r,g,b,a) into ImageData (a preserved from source)
function writeRGBA(data: Uint8ClampedArray, idx: number, r: number, g: number, b: number, a: number) {
  data[idx]   = r | 0
  data[idx+1] = g | 0
  data[idx+2] = b | 0
  data[idx+3] = a | 0
}

// Convert sRGB 8-bit to LAB using color-utils
function rgb8ToLab(r: number, g: number, b: number): LAB {
  return xyzToLab(rgbToXyz({ r, g, b }))
}

// Convert LAB to sRGB 8-bit with clamping
function labToRgb8(lab: LAB): [number, number, number] {
  const { r, g, b } = xyzToRgb(labToXyz(lab))
  // xyzToRgb already clamps to [0..255], ensure integers
  return [r | 0, g | 0, b | 0]
}

/**
 * Create a neutral gray texture preserving texture and shadows.
 * Steps:
 *  - Compute global mean L,a,b ignoring a small border.
 *  - For every pixel: set a=b=0 (strict neutral), and add an offset to L so that mean(L) == targetLightness.
 *  - Convert back to sRGB and preserve alpha.
 */
function createImageDataCompat(width: number, height: number, length: number): ImageData {
  if (typeof ImageData !== 'undefined') return new ImageData(new Uint8ClampedArray(length), width, height)
  // Node/test fallback: minimal ImageData-like object
  return { width, height, data: new Uint8ClampedArray(length) } as unknown as ImageData
}

export function extractNeutralTexture(imageData: ImageData, options?: NeutralExtractionOptions): ImageData {
  const { width: w, height: h, data } = imageData
  const targetL = options?.targetLightness ?? 65
  const marginPct = options?.marginPercent ?? 0.03

  const margin = Math.max(0, Math.floor(Math.min(w, h) * clamp01(marginPct)))
  const x0 = margin, y0 = margin
  const x1 = Math.max(x0, w - margin)
  const y1 = Math.max(y0, h - margin)

  let sumL = 0, sumA = 0, sumB = 0, count = 0
  for (let y = y0; y < y1; y++) {
    for (let x = x0; x < x1; x++) {
      const idx = (y * w + x) * 4
      const [r,g,b,a] = readRGBA(data, idx)
      if (a === 0) continue // ignore fully transparent pixels
      const lab = rgb8ToLab(r,g,b)
      sumL += lab.L
      sumA += lab.a
      sumB += lab.b
      count++
    }
  }
  // Fallback to avoid division by zero
  if (count === 0) count = 1
  const meanL = sumL / count
  // const meanA = sumA / count
  // const meanB = sumB / count

  // Offset to match target mean lightness
  const dL = targetL - meanL

  const out = createImageDataCompat(w, h, data.length)
  const dst = out.data

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const idx = (y * w + x) * 4
      const [r,g,b,a] = readRGBA(data, idx)
      const lab = rgb8ToLab(r,g,b)
      // Neutralize chroma and offset lightness
      const L = Math.min(100, Math.max(0, lab.L + dL))
      const aN = 0
      const bN = 0
      const [ro, go, bo] = labToRgb8({ L, a: aN, b: bN })
      writeRGBA(dst, idx, ro, go, bo, a)
    }
  }

  return out
}
