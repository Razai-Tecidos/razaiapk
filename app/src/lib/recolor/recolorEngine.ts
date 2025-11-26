import { labToXyz, xyzToRgb, rgbToXyz, xyzToLab, hexToLab, type LAB } from '@/lib/color-utils'

export type RazaiColor = {
  lab: LAB
  hex: string
  name?: string // opcional: usado apenas na UI para exibir nome + HEX
}

export interface RecolorOptions {
  lightnessFactor?: number // default 1
}

function labToRgb8(lab: LAB): [number, number, number] {
  const { r, g, b } = xyzToRgb(labToXyz(lab))
  return [r | 0, g | 0, b | 0]
}

function rgb8ToLab(r: number, g: number, b: number): LAB {
  return xyzToLab(rgbToXyz({ r, g, b }))
}

/**
 * Recolor a neutralized texture with a target LAB color while preserving relative lightness deviations.
 * L_new = L_target + factor * (L_tex - mean(L_tex))
 * a_new = a_target; b_new = b_target
 */
export function recolorTextureWithRazaiColor(textureData: ImageData, targetColor: RazaiColor, options?: RecolorOptions): ImageData {
  const { width: w, height: h, data } = textureData
  const factor = options?.lightnessFactor ?? 1

  // Resolve target LAB from RazaiColor (trust provided lab; fallback to hex if necessary)
  let targetLab: LAB | undefined = targetColor.lab
  if (!targetLab && targetColor.hex) targetLab = hexToLab(targetColor.hex)
  if (!targetLab) throw new Error('Invalid target color: LAB or HEX required')

  // Compute mean L over the texture
  let sumL = 0, count = 0
  for (let i = 0; i < data.length; i += 4) {
    const a = data[i+3]
    if (a === 0) continue
    const lab = rgb8ToLab(data[i], data[i+1], data[i+2])
    sumL += lab.L
    count++
  }
  if (count === 0) count = 1
  const meanL = sumL / count

  const out = (typeof ImageData !== 'undefined')
    ? new ImageData(new Uint8ClampedArray(data.length), w, h)
    : ({ width: w, height: h, data: new Uint8ClampedArray(data.length) } as unknown as ImageData)
  const dst = out.data

  for (let i = 0; i < data.length; i += 4) {
    const r = data[i], g = data[i+1], b = data[i+2], a = data[i+3]
    const lab = rgb8ToLab(r,g,b)
    const dL = lab.L - meanL
    let Lnew = targetLab.L + factor * dL
    if (Lnew < 0) Lnew = 0
    if (Lnew > 100) Lnew = 100
    const [ro, go, bo] = labToRgb8({ L: Lnew, a: targetLab.a, b: targetLab.b })
    dst[i] = ro; dst[i+1] = go; dst[i+2] = bo; dst[i+3] = a
  }

  return out
}
