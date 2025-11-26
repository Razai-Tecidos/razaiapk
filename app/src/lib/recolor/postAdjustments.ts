import { rgbToXyz, xyzToLab, labToXyz, xyzToRgb, type LAB } from '@/lib/color-utils'

function createImageDataCompat(width: number, height: number, length: number): ImageData {
  if (typeof ImageData !== 'undefined') return new ImageData(new Uint8ClampedArray(length), width, height)
  return { width, height, data: new Uint8ClampedArray(length) } as unknown as ImageData
}

function rgb8ToLab(r: number, g: number, b: number): LAB {
  return xyzToLab(rgbToXyz({ r, g, b }))
}

function labToRgb8(lab: LAB): [number, number, number] {
  const { r, g, b } = xyzToRgb(labToXyz(lab))
  return [r | 0, g | 0, b | 0]
}

function clampL(L: number): number {
  if (L < 0) return 0
  if (L > 100) return 100
  return L
}

function atan2Deg(y: number, x: number): number { return Math.atan2(y, x) * 180 / Math.PI }
function cosDeg(a: number): number { return Math.cos(a * Math.PI / 180) }
function sinDeg(a: number): number { return Math.sin(a * Math.PI / 180) }
function wrapDeg(a: number): number { let v = a % 360; if (v < 0) v += 360; return v }

// 1) Adjust brightness in LAB (delta L)
export function adjustBrightness(image: ImageData, deltaL: number): ImageData {
  const { width: w, height: h, data } = image
  const out = createImageDataCompat(w, h, data.length)
  const dst = out.data
  console.log('[postAdjust] adjustBrightness start', { deltaL })
  let minLBefore =  1e9, maxLBefore = -1e9
  let minLAfter  =  1e9, maxLAfter  = -1e9
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i], g = data[i+1], b = data[i+2], a = data[i+3]
    const lab = rgb8ToLab(r, g, b)
    const Lbefore = lab.L
    const L = clampL(Lbefore + (deltaL || 0))
    const [ro, go, bo] = labToRgb8({ L, a: lab.a, b: lab.b })
    dst[i] = ro; dst[i+1] = go; dst[i+2] = bo; dst[i+3] = a
    if (Lbefore < minLBefore) minLBefore = Lbefore
    if (Lbefore > maxLBefore) maxLBefore = Lbefore
    if (L < minLAfter) minLAfter = L
    if (L > maxLAfter) maxLAfter = L
    if (i === 0) {
      console.log('[postAdjust] adjustBrightness samplePixel0', { Lbefore, Lafter: L, deltaL })
    }
  }
  console.log('[postAdjust] adjustBrightness summary', { minLBefore, maxLBefore, minLAfter, maxLAfter })
  return out
}

// 2) Adjust saturation via C scaling in LAB (scale a,b vector)
export function adjustSaturation(image: ImageData, saturationFactor: number): ImageData {
  const s = (typeof saturationFactor === 'number' && isFinite(saturationFactor)) ? saturationFactor : 1
  if (s === 1) {
    // Return a copy to adhere to immutability requirement
    const { width: w, height: h, data } = image
    const out = createImageDataCompat(w, h, data.length)
    out.data.set(new Uint8ClampedArray(data))
    return out
  }
  const { width: w, height: h, data } = image
  const out = createImageDataCompat(w, h, data.length)
  const dst = out.data
  console.log('[postAdjust] adjustSaturation start', { saturationFactor: s })
  let minCBefore = 1e9, maxCBefore = -1e9
  let minCAfter  = 1e9, maxCAfter  = -1e9
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i], g = data[i+1], b = data[i+2], a = data[i+3]
    const lab = rgb8ToLab(r, g, b)
    const Cbefore = Math.hypot(lab.a, lab.b)
    const a2 = lab.a * s
    const b2 = lab.b * s
    const Cafter = Math.hypot(a2, b2)
    const [ro, go, bo] = labToRgb8({ L: lab.L, a: a2, b: b2 })
    dst[i] = ro; dst[i+1] = go; dst[i+2] = bo; dst[i+3] = a
    if (Cbefore < minCBefore) minCBefore = Cbefore
    if (Cbefore > maxCBefore) maxCBefore = Cbefore
    if (Cafter < minCAfter) minCAfter = Cafter
    if (Cafter > maxCAfter) maxCAfter = Cafter
    if (i === 0) {
      console.log('[postAdjust] adjustSaturation samplePixel0', { aBefore: lab.a, bBefore: lab.b, aAfter: a2, bAfter: b2, Cbefore, Cafter, factor: s })
    }
  }
  console.log('[postAdjust] adjustSaturation summary', { minCBefore, maxCBefore, minCAfter, maxCAfter, factor: s })
  return out
}

// 3) Adjust hue via LCh rotation (preserve C)
export function adjustHue(image: ImageData, hueShiftDegrees: number): ImageData {
  const shift = (typeof hueShiftDegrees === 'number' && isFinite(hueShiftDegrees)) ? hueShiftDegrees : 0
  if (shift === 0) {
    // Return a copy
    const { width: w, height: h, data } = image
    const out = createImageDataCompat(w, h, data.length)
    out.data.set(new Uint8ClampedArray(data))
    return out
  }
  const { width: w, height: h, data } = image
  const out = createImageDataCompat(w, h, data.length)
  const dst = out.data
  console.log('[postAdjust] adjustHue start', { hueShiftDegrees: shift })
  let minHueBefore =  1e9, maxHueBefore = -1e9
  let minHueAfter  =  1e9, maxHueAfter  = -1e9
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i], g = data[i+1], b = data[i+2], a = data[i+3]
    const lab = rgb8ToLab(r, g, b)
    const C = Math.hypot(lab.a, lab.b)
    const hueBefore = atan2Deg(lab.b, lab.a)
    const hueAfter = wrapDeg(hueBefore + shift)
    const a2 = C * cosDeg(hueAfter)
    const b2 = C * sinDeg(hueAfter)
    const [ro, go, bo] = labToRgb8({ L: lab.L, a: a2, b: b2 })
    dst[i] = ro; dst[i+1] = go; dst[i+2] = bo; dst[i+3] = a
    if (hueBefore < minHueBefore) minHueBefore = hueBefore
    if (hueBefore > maxHueBefore) maxHueBefore = hueBefore
    if (hueAfter < minHueAfter) minHueAfter = hueAfter
    if (hueAfter > maxHueAfter) maxHueAfter = hueAfter
    if (i === 0) {
      console.log('[postAdjust] adjustHue samplePixel0', { hueBefore, hueAfter, shift, C, aBefore: lab.a, bBefore: lab.b, aAfter: a2, bAfter: b2 })
    }
  }
  console.log('[postAdjust] adjustHue summary', { minHueBefore, maxHueBefore, minHueAfter, maxHueAfter, shift })
  return out
}
