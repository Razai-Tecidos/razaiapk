// Basic OKLab / OKLCh conversions + linearization utilities.
// Reference: Björn Ottosson OKLab (https://bottosson.github.io/posts/oklab/)

export function srgbToLinear(c: number): number {
  c /= 255
  return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)
}
export function linearToSrgb(c: number): number {
  return c <= 0.0031308 ? c * 12.92 : 1.055 * Math.pow(c, 1/2.4) - 0.055
}

export function rgbToOKLab(r: number, g: number, b: number): [number, number, number] {
  // linearize
  const R = srgbToLinear(r), G = srgbToLinear(g), B = srgbToLinear(b)
  // M1 transform
  const l = 0.4122214708*R + 0.5363325363*G + 0.0514459929*B
  const m = 0.2119034982*R + 0.6806995451*G + 0.1073969566*B
  const s = 0.0883024619*R + 0.2817188376*G + 0.6299787005*B

  const l_ = Math.cbrt(l)
  const m_ = Math.cbrt(m)
  const s_ = Math.cbrt(s)

  const L = 0.2104542553*l_ + 0.7936177850*m_ - 0.0040720468*s_
  const a = 1.9779984951*l_ - 2.4285922050*m_ + 0.4505937099*s_
  const b_ = 0.0259040371*l_ + 0.7827717662*m_ - 0.8086757660*s_
  return [L, a, b_]
}

export function oklabToRgb(L: number, a: number, b: number): [number, number, number] {
  const l_ = L + 0.3963377774*a + 0.2158037573*b
  const m_ = L - 0.1055613458*a - 0.0638541728*b
  const s_ = L - 0.0894841775*a - 1.2914855480*b

  const l = l_*l_*l_
  const m = m_*m_*m_
  const s = s_*s_*s_

  const R = +4.0767416621*l -3.1448713730*m + 0.0685888427*s
  const G = -1.2684380046*l +2.6097574011*m - 0.3413193965*s
  const B = -0.0041960863*l -0.7034186147*m + 1.7076147010*s

  const r = Math.round(Math.min(255, Math.max(0, linearToSrgb(R)*255)))
  const g = Math.round(Math.min(255, Math.max(0, linearToSrgb(G)*255)))
  const b2 = Math.round(Math.min(255, Math.max(0, linearToSrgb(B)*255)))
  return [r,g,b2]
}

export function oklabToOklch(L: number, a: number, b: number): [number, number, number] {
  const C = Math.sqrt(a*a + b*b)
  let h = Math.atan2(b,a) * 180/Math.PI
  if (h < 0) h += 360
  return [L, C, h]
}
export function oklchToOklab(L: number, C: number, h: number): [number, number, number] {
  const rad = h * Math.PI/180
  const a = C * Math.cos(rad)
  const b = C * Math.sin(rad)
  return [L,a,b]
}

// Simple gamut compression in OKLCh: reduce C until RGB in gamut
export function clampOklchToSrgb(L: number, C: number, h: number): [number, number, number] {
  let c = C
  for (let i=0;i<32;i++) { // iterative reduction
    const [r,g,b] = oklabToRgb(...oklchToOklab(L,c,h))
    // if all components are between 0 and 255 we consider it ok
    if (r>=0 && r<=255 && g>=0 && g<=255 && b>=0 && b<=255) return [L,c,h]
    c *= 0.9
  }
  return [L, Math.max(0, c), h]
}

export function parseHexColor(hex: string): [number, number, number] | null {
  const h = hex.trim()
  if (!/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(h)) return null
  const full = h.length === 4 ? '#' + h[1]+h[1]+h[2]+h[2]+h[3]+h[3] : h
  const r = parseInt(full.slice(1,3),16)
  const g = parseInt(full.slice(3,5),16)
  const b = parseInt(full.slice(5,7),16)
  return [r,g,b]
}
