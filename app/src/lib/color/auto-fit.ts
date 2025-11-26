import { autoTuneRecolor } from './auto-tune'
import type { IntrinsicsOptions } from './intrinsics'

// Stub auto-fit for Intrinsics-lite: reuse heuristics from classic auto-tune for now.
// Can be upgraded later with substrate-aware intrinsics sampling.
export function autoFitIntrinsics(source: HTMLImageElement | HTMLCanvasElement | ImageBitmap, targetHex: string): Partial<IntrinsicsOptions> {
  const p = autoTuneRecolor(source, targetHex)
  return {
    targetHex,
    strength: p.strength,
    hueStrength: p.hueStrength,
    preserveHighlights: p.protectHighlights,
    highlightPreserveWeight: p.highlightBlend,
    highlightHueBlend: p.highlightHueBlend,
    highlightNeutralize: p.highlightNeutralize,
  }
}
