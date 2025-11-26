import { describe, it, expect } from 'vitest'
import { labToXyz, xyzToRgb, xyzToLab, rgbToXyz, hexToLab, type LAB } from '@/lib/color-utils'
import { recolorTextureWithRazaiColor, type RazaiColor } from '@/lib/recolor/recolorEngine'

function labToRgb8(lab: LAB): [number, number, number] {
  const { r, g, b } = xyzToRgb(labToXyz(lab))
  return [r | 0, g | 0, b | 0]
}

function rgb8ToLab(r: number, g: number, b: number): LAB {
  return xyzToLab(rgbToXyz({ r, g, b }))
}

describe('recolorTextureWithRazaiColor', () => {
  it('applies target a/b and preserves L deviations around target L', () => {
    const w = 16, h = 16
    const d = new Uint8ClampedArray(w*h*4)
    const L0 = 65
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const idx = (y * w + x) * 4
        const dx = (x - (w-1)/2) / ((w-1)/2)
        const dy = (y - (h-1)/2) / ((h-1)/2)
        const rad = Math.sqrt(dx*dx + dy*dy) // 0 center .. ~1 corners
        const L = Math.max(0, Math.min(100, L0 + rad * 15 - 7.5)) // roughly symmetric about L0
        const [r,g,b] = labToRgb8({ L, a: 0, b: 0 })
        d[idx] = r; d[idx+1] = g; d[idx+2] = b; d[idx+3] = 255
      }
    }
    const base = new ImageData(d, w, h)

    // Target color (a warm red)
    const hex = '#CC3227'
    const targetLab = hexToLab(hex)!
    const target: RazaiColor = { hex, lab: targetLab }

    const recolored = recolorTextureWithRazaiColor(base, target, { lightnessFactor: 1 })

    // Measure outputs
    let sumL = 0, sumA = 0, sumB = 0, count = 0
    const rd = recolored.data
    for (let i = 0; i < rd.length; i += 4) {
      const lab = rgb8ToLab(rd[i], rd[i+1], rd[i+2])
      sumL += lab.L; sumA += lab.a; sumB += lab.b; count++
    }
    const meanL = sumL / count
    const meanA = sumA / count
    const meanB = sumB / count

    expect(Math.abs(meanL - targetLab.L)).toBeLessThan(1.5)
    expect(Math.abs(meanA - targetLab.a)).toBeLessThan(1.5)
    expect(Math.abs(meanB - targetLab.b)).toBeLessThan(1.5)

    // Spot-check L deviation preservation on a few pixels
    function inputLabAt(x: number, y: number) {
      const idx = (y * w + x) * 4
      return rgb8ToLab(d[idx], d[idx+1], d[idx+2])
    }
    function outputLabAt(x: number, y: number) {
      const idx = (y * w + x) * 4
      return rgb8ToLab(rd[idx], rd[idx+1], rd[idx+2])
    }
    // Compute input mean L as used by engine
    let sumIn = 0
    for (let i = 0; i < d.length; i += 4) sumIn += rgb8ToLab(d[i], d[i+1], d[i+2]).L
    const meanIn = sumIn / (d.length/4)

    const samples: [number, number][] = [ [0,0], [w-1,h-1], [Math.floor(w/2), Math.floor(h/2)], [3, 11] ]
    for (const [sx, sy] of samples) {
      const Lin = inputLabAt(sx, sy).L
      const Lout = outputLabAt(sx, sy).L
      const dLin = Lin - meanIn
      const dLout = Lout - meanL
      expect(Math.abs(dLout - dLin)).toBeLessThan(2.0)
    }
  })
})
