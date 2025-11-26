// Simple ACES-like filmic tonemapping for linear RGB channels in [0, +inf)
// Source adapted from common ACES approximation curves. Input and output are linear [0,1].
export function acesTonemap(x: number): number {
  // Clamp negative
  const a = 2.51, b = 0.03, c = 2.43, d = 0.59, e = 0.14
  const y = ((x * (a * x + b)) / (x * (c * x + d) + e))
  return Math.max(0, Math.min(1, y))
}

export function applyTonemapRGB(r: number, g: number, b: number): [number, number, number] {
  return [acesTonemap(r), acesTonemap(g), acesTonemap(b)]
}
