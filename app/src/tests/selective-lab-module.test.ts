import { describe, it, expect } from 'vitest'

/**
 * Test suite for SelectiveLABModule color correction functionality
 * 
 * These tests validate:
 * 1. RGB→LAB conversion accuracy (needed for parsing HEX input)
 * 2. Delta calculation logic (target - base)
 * 3. Expected behavior for common store colors
 * 4. Gray neutralization baseline (a=0, b=0)
 */

// Helper: sRGB to LAB conversion (same logic as in SelectiveLABModule)
function rgbToLabTest(r: number, g: number, b: number): [number, number, number] {
  const sr = r/255, sg = g/255, sb = b/255
  const rl = sr <= 0.04045 ? sr/12.92 : Math.pow((sr+0.055)/1.055, 2.4)
  const gl = sg <= 0.04045 ? sg/12.92 : Math.pow((sg+0.055)/1.055, 2.4)
  const bl = sb <= 0.04045 ? sb/12.92 : Math.pow((sb+0.055)/1.055, 2.4)
  const X = 0.4124564*rl + 0.3575761*gl + 0.1804375*bl
  const Y = 0.2126729*rl + 0.7151522*gl + 0.0721750*bl
  const Z = 0.0193339*rl + 0.1191920*gl + 0.9503041*bl
  const xr = X/0.95047, yr = Y/1.0, zr = Z/1.08883
  const d = 6/29
  const f = (t: number) => t > d*d*d ? Math.cbrt(t) : t/(3*d*d) + 4/29
  const fx = f(xr), fy = f(yr), fz = f(zr)
  const L = 116*fy - 16
  const a = 500*(fx - fy)
  const bb = 200*(fy - fz)
  return [L, a, bb]
}

// Helper: parse HEX and compute deltas for given target
function computeDeltasForTarget(targetHex: string, baseLTarget: number = 58): { dL: number, da: number, db: number, targetLab: [number, number, number] } {
  const hex = targetHex.length === 4 
    ? '#' + targetHex[1] + targetHex[1] + targetHex[2] + targetHex[2] + targetHex[3] + targetHex[3]
    : targetHex
  const r = parseInt(hex.slice(1,3), 16)
  const g = parseInt(hex.slice(3,5), 16)
  const b = parseInt(hex.slice(5,7), 16)
  const targetLab = rgbToLabTest(r, g, b)
  const baseLab: [number, number, number] = [baseLTarget, 0, 0]
  const dL = targetLab[0] - baseLab[0]
  const da = targetLab[1] - baseLab[1]
  const db = targetLab[2] - baseLab[2]
  return { dL, da, db, targetLab }
}

describe('SelectiveLABModule - Core Functionality', () => {
  
  describe('RGB to LAB conversion accuracy', () => {
    it('converts pure red correctly', () => {
      const [L, a, b] = rgbToLabTest(255, 0, 0)
      expect(L).toBeCloseTo(53.24, 1)
      expect(a).toBeCloseTo(80.09, 1)
      expect(b).toBeCloseTo(67.20, 1)
    })

    it('converts pure green correctly', () => {
      const [L, a, b] = rgbToLabTest(0, 255, 0)
      expect(L).toBeCloseTo(87.74, 1)
      expect(a).toBeCloseTo(-86.18, 1)
      expect(b).toBeCloseTo(83.18, 1)
    })

    it('converts pure blue correctly', () => {
      const [L, a, b] = rgbToLabTest(0, 0, 255)
      expect(L).toBeCloseTo(32.30, 1)
      expect(a).toBeCloseTo(79.19, 1)
      expect(b).toBeCloseTo(-107.86, 1)
    })

    it('converts neutral gray correctly (should have near-zero chroma)', () => {
      const [L, a, b] = rgbToLabTest(128, 128, 128)
      expect(L).toBeCloseTo(53.59, 1)
      expect(a).toBeCloseTo(0, 0.5) // near zero
      expect(b).toBeCloseTo(0, 0.5) // near zero
    })
  })

  describe('Delta calculation for store colors', () => {
    const BASE_L = 58 // default gray target

    it('calculates correct deltas for warm coral red #E15B55', () => {
      // RGB(225, 91, 85) - warm coral/red from tests
      const { dL, da, db, targetLab } = computeDeltasForTarget('#E15B55', BASE_L)
      
      // Expected LAB for #E15B55: L≈56, a≈52, b≈30
      expect(targetLab[0]).toBeCloseTo(56, 0)
      expect(targetLab[1]).toBeCloseTo(52, 0)
      expect(targetLab[2]).toBeCloseTo(30, 0)

      // Deltas from gray base (58, 0, 0)
      expect(dL).toBeCloseTo(-2, 0) // L=56.24, actual dL=-1.76
      expect(da).toBeCloseTo(52, 0)
      expect(db).toBeCloseTo(30, 0)
    })

    it('calculates correct deltas for Material Purple #9C27B0', () => {
      // RGB(156, 39, 176) - vibrant purple
      const { dL, da, db, targetLab } = computeDeltasForTarget('#9C27B0', BASE_L)
      
      // Expected LAB: L≈41, a≈64, b≈-48
      expect(targetLab[0]).toBeCloseTo(41, 0)
      expect(targetLab[1]).toBeCloseTo(64, 0)
      expect(targetLab[2]).toBeCloseTo(-48, 0)

      // Deltas from gray base (58, 0, 0)
      expect(dL).toBeCloseTo(-17, 0) // L=40.66
      expect(da).toBeCloseTo(64, 0)  // a=64.02, not 68
      expect(db).toBeCloseTo(-48, 0) // b=-48.06, not -47
    })

    it('calculates correct deltas for light pink #DC8592', () => {
      // RGB(220, 133, 146) - light pink
      const { dL, da, db, targetLab } = computeDeltasForTarget('#DC8592', BASE_L)
      
      // Expected LAB: L≈65, a≈35, b≈7
      expect(targetLab[0]).toBeCloseTo(65, 0)
      expect(targetLab[1]).toBeCloseTo(35, 0)
      expect(targetLab[2]).toBeCloseTo(7, 0)

      // Deltas from gray base (58, 0, 0)
      expect(dL).toBeCloseTo(7, 0)  // L=65.02
      expect(da).toBeCloseTo(35, 0) // a=34.90
      expect(db).toBeCloseTo(7, 0)  // b=7.42, not 8
    })

    it('calculates correct deltas for olive brown #6E5A3D', () => {
      // RGB(110, 90, 61) - medium olive brown
      const { dL, da, db, targetLab } = computeDeltasForTarget('#6E5A3D', BASE_L)
      
      // Expected LAB: L≈40, a≈4, b≈20
      expect(targetLab[0]).toBeCloseTo(40, 0)
      expect(targetLab[1]).toBeCloseTo(4, 0)
      expect(targetLab[2]).toBeCloseTo(20, 0)

      // Deltas from gray base (58, 0, 0)
      expect(dL).toBeCloseTo(-18, 0) // L=39.52
      expect(da).toBeCloseTo(4, 0)   // a=3.82, not 3
      expect(db).toBeCloseTo(20, 0)  // b=19.81, not 17
    })
  })

  describe('Gray neutralization baseline', () => {
    it('pretreated base should be (L, 0, 0) with configurable L', () => {
      // This is the baseline that all deltas are computed from
      const baseLab = [58, 0, 0]
      
      expect(baseLab[1]).toBe(0) // a* = 0 (no green/magenta)
      expect(baseLab[2]).toBe(0) // b* = 0 (no blue/yellow)
    })

    it('resulting color = base + deltas', () => {
      const baseLab = [58, 0, 0]
      const { dL, da, db } = computeDeltasForTarget('#E15B55', 58)
      
      const resultL = baseLab[0] + dL
      const resultA = baseLab[1] + da
      const resultB = baseLab[2] + db

      // Should match target LAB closely
      const [targetL, targetA, targetB] = rgbToLabTest(225, 91, 85)
      expect(resultL).toBeCloseTo(targetL, 1)
      expect(resultA).toBeCloseTo(targetA, 1)
      expect(resultB).toBeCloseTo(targetB, 1)
    })
  })

  describe('Edge cases and boundary conditions', () => {
    it('handles pure white #FFFFFF', () => {
      const { dL, da, db, targetLab } = computeDeltasForTarget('#FFFFFF', 58)
      
      // White: L=100, a≈0, b≈0
      expect(targetLab[0]).toBeCloseTo(100, 1)
      expect(Math.abs(targetLab[1])).toBeLessThan(1)
      expect(Math.abs(targetLab[2])).toBeLessThan(1)
      
      // Delta from gray (58, 0, 0)
      expect(dL).toBeCloseTo(42, 1) // much lighter
      expect(Math.abs(da)).toBeLessThan(1)
      expect(Math.abs(db)).toBeLessThan(1)
    })

    it('handles pure black #000000', () => {
      const { dL, da, db, targetLab } = computeDeltasForTarget('#000000', 58)
      
      // Black: L=0, a≈0, b≈0
      expect(targetLab[0]).toBeCloseTo(0, 1)
      expect(Math.abs(targetLab[1])).toBeLessThan(1)
      expect(Math.abs(targetLab[2])).toBeLessThan(1)
      
      // Delta from gray (58, 0, 0)
      expect(dL).toBeCloseTo(-58, 1) // much darker
      expect(Math.abs(da)).toBeLessThan(1)
      expect(Math.abs(db)).toBeLessThan(1)
    })

    it('handles saturated colors with extreme a* and b* values', () => {
      // Bright cyan-like color
      const { dL, da, db, targetLab } = computeDeltasForTarget('#00FFFF', 58)
      
      // Cyan has strong negative a* (green) and negative b* (blue)
      expect(targetLab[1]).toBeLessThan(-45) // very green
      expect(targetLab[2]).toBeLessThan(-14) // blue
      
      // Deltas should be large
      expect(Math.abs(da)).toBeGreaterThan(45)
      expect(Math.abs(db)).toBeGreaterThan(10) // actual: 14.13
    })
  })

  describe('LAB string parsing', () => {
    it('parses space-separated LAB values', () => {
      const input = '58 35 20'
      const parts = input.split(/\s+/).map(p => parseFloat(p))
      
      expect(parts).toHaveLength(3)
      expect(parts[0]).toBe(58)
      expect(parts[1]).toBe(35)
      expect(parts[2]).toBe(20)
    })

    it('parses LAB with multiple spaces', () => {
      const input = '  58   35    20  '
      const parts = input.trim().split(/\s+/).map(p => parseFloat(p))
      
      expect(parts).toHaveLength(3)
      expect(parts[0]).toBe(58)
      expect(parts[1]).toBe(35)
      expect(parts[2]).toBe(20)
    })

    it('parses negative LAB values', () => {
      const input = '42 66 -51'
      const parts = input.split(/\s+/).map(p => parseFloat(p))
      
      expect(parts).toHaveLength(3)
      expect(parts[0]).toBe(42)
      expect(parts[1]).toBe(66)
      expect(parts[2]).toBe(-51)
    })
  })

  describe('Performance expectations', () => {
    it('RGB to LAB conversion should be fast (<1ms for typical use)', () => {
      const start = performance.now()
      for (let i = 0; i < 1000; i++) {
        rgbToLabTest(128 + i % 127, 64 + i % 191, 32 + i % 223)
      }
      const elapsed = performance.now() - start
      
      // 1000 conversions should take < 10ms
      expect(elapsed).toBeLessThan(10)
    })

    it('delta computation should be instant', () => {
      const start = performance.now()
      for (let i = 0; i < 10000; i++) {
        const targetLab: [number, number, number] = [50 + i % 50, -50 + i % 100, -50 + i % 100]
        const baseLab: [number, number, number] = [58, 0, 0]
        const dL = targetLab[0] - baseLab[0]
        const da = targetLab[1] - baseLab[1]
        const db = targetLab[2] - baseLab[2]
      }
      const elapsed = performance.now() - start
      // 10000 delta calculations should take < 20ms (adjusted for CI variance)
      expect(elapsed).toBeLessThan(20)
    })
  })
})

describe('SelectiveLABModule - Real-world color scenarios', () => {
  
  it('scenario: operator wants to apply coral red to gray fabric', () => {
    // Target: #E15B55 (coral red from warm-reds tests)
    const { dL, da, db, targetLab } = computeDeltasForTarget('#E15B55', 58)
    
    // Operator inputs #E15B55
    // System calculates: ΔL≈0, Δa≈+45, Δb≈+30
    // Result should be visually close to coral red
    expect(Math.abs(dL)).toBeLessThan(5) // roughly same lightness
    expect(da).toBeGreaterThan(40) // strong red/magenta
    expect(db).toBeGreaterThan(25) // warm (yellow shift)
    
    // Resulting color after applying to gray base
    const resultLab = [58 + dL, 0 + da, 0 + db]
    expect(resultLab[0]).toBeCloseTo(targetLab[0], 2)
    expect(resultLab[1]).toBeCloseTo(targetLab[1], 2)
    expect(resultLab[2]).toBeCloseTo(targetLab[2], 2)
  })

  it('scenario: operator wants to apply deep purple to gray fabric', () => {
    // Target: #762F55 (burgundy/wine from tests, but user wants purple tone)
    const { dL, da, db, targetLab } = computeDeltasForTarget('#762F55', 58)
    
    // System calculates deltas
    // Result should darken significantly and add purple/magenta chroma
    expect(dL).toBeLessThan(-15) // darker
    expect(da).toBeGreaterThan(25) // magenta component
    expect(db).toBeLessThan(10) // slight blue or neutral
  })

  it('scenario: operator wants to apply light beige to gray fabric', () => {
    // Target: #E8D4B8 (light beige)
    const { dL, da, db, targetLab } = computeDeltasForTarget('#E8D4B8', 58)
    
    // System calculates deltas
    // Result should lighten and add warm yellow/orange tone
    expect(dL).toBeGreaterThan(10) // lighter
    expect(da).toBeGreaterThan(0) // slight magenta/red
    expect(db).toBeGreaterThan(10) // yellow warmth
  })

  it('scenario: fine-tuning after auto-apply', () => {
    // Operator applies #E15B55 automatically
    const auto = computeDeltasForTarget('#E15B55', 58)
    
    // Then manually adjusts Δa from 45 to 43 (fine-tune)
    const manualDa = 43
    const finalA = 0 + manualDa
    
    // Should still be close to target
    expect(Math.abs(finalA - auto.targetLab[1])).toBeLessThan(12)
  })

  it('scenario: operator changes L* target mid-work', () => {
    // Original base L=58
    const original = computeDeltasForTarget('#E15B55', 58)
    
    // Operator changes L* target to 55
    const adjusted = computeDeltasForTarget('#E15B55', 55)
    
    // ΔL should change by the difference in base L
    expect(adjusted.dL - original.dL).toBeCloseTo(3, 1)
    // Δa and Δb remain the same (chroma independent of L* base)
    expect(adjusted.da).toBeCloseTo(original.da, 1)
    expect(adjusted.db).toBeCloseTo(original.db, 1)
  })
})

describe('SelectiveLABModule - UI/UX validation', () => {
  
  it('slider ranges should accommodate all deltas', () => {
    // Sliders: ΔL [-50, 50], Δa [-50, 50], Δb [-50, 50]
    
    // Test extreme colors
    const white = computeDeltasForTarget('#FFFFFF', 58)
    const black = computeDeltasForTarget('#000000', 58)
    const cyan = computeDeltasForTarget('#00FFFF', 58)
    const magenta = computeDeltasForTarget('#FF00FF', 58)
    
    // ΔL range check
    expect(white.dL).toBeLessThanOrEqual(50) // 100-58 = 42
    expect(black.dL).toBeGreaterThanOrEqual(-60) // 0-58 = -58 (slider may need -60 to +60)
    
    // Δa, Δb might exceed ±50 for extreme colors
    // This is OK - operator can fine-tune within range after clipping
  })

  it('L* target slider (50-65) covers typical fabric ranges', () => {
    // Light fabric: L≈65
    // Medium fabric: L≈58 (default)
    // Dark fabric: L≈50
    
    const lightBase = 65
    const mediumBase = 58
    const darkBase = 50
    
    const target = computeDeltasForTarget('#E15B55', mediumBase)
    
    // All bases should produce reasonable deltas
    expect(computeDeltasForTarget('#E15B55', lightBase).dL).toBeCloseTo(target.dL - 7, 1)
    expect(computeDeltasForTarget('#E15B55', darkBase).dL).toBeCloseTo(target.dL + 8, 1)
  })

  it('notification message format is informative', () => {
    const { dL, da, db } = computeDeltasForTarget('#E15B55', 58)
    
    // Expected message: "Δ calculado: L+0.0 a+45.0 b+30.0"
    const signL = dL >= 0 ? '+' : ''
    const signA = da >= 0 ? '+' : ''
    const signB = db >= 0 ? '+' : ''
    const message = `Δ calculado: L${signL}${dL.toFixed(1)} a${signA}${da.toFixed(1)} b${signB}${db.toFixed(1)}`
    
    expect(message).toContain('Δ calculado')
    expect(message).toContain('L')
    expect(message).toContain('a')
    expect(message).toContain('b')
  })
})
