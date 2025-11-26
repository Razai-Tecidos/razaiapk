import { describe, it, expect } from 'vitest'
import { extractNeutralTexture } from '@/lib/recolor/textureExtractionNeutral'
import { rgbToXyz, xyzToLab, type LAB } from '@/lib/color-utils'

function rgb8ToLab(r: number, g: number, b: number): LAB {
  return xyzToLab(rgbToXyz({ r, g, b }))
}

describe('extractNeutralTexture', () => {
  it('produces near-zero a/b and normalizes mean L to target', () => {
    const w = 32, h = 32
    const d = new Uint8ClampedArray(w*h*4)
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const idx = (y * w + x) * 4
        const t = (x + y) / (w + h) // 0..1
        // Start with a reddish tone varying in brightness
        const r = Math.round(128 + 100 * t)
        const g = Math.round(64 + 80 * t)
        const b = Math.round(64 + 60 * t)
        d[idx] = r; d[idx+1] = g; d[idx+2] = b; d[idx+3] = 255
      }
    }
    const imgData = new ImageData(d, w, h)
    const targetL = 65
    const neutral = extractNeutralTexture(imgData, { targetLightness: targetL, marginPercent: 0.03 })

    // Measure mean LAB
    let sumL = 0, sumA = 0, sumB = 0, count = 0
    const nd = neutral.data
    for (let i = 0; i < nd.length; i += 4) {
      const L = rgb8ToLab(nd[i], nd[i+1], nd[i+2])
      sumL += L.L; sumA += L.a; sumB += L.b; count++
    }
    const meanL = sumL / count
    const meanA = sumA / count
    const meanB = sumB / count

    expect(Math.abs(meanL - targetL)).toBeLessThan(1.5)
    expect(Math.abs(meanA)).toBeLessThan(1.5)
    expect(Math.abs(meanB)).toBeLessThan(1.5)
  })
})
