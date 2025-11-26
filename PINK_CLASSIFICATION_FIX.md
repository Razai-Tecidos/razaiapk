# Pink/Rose Color Classification Fix - Summary

## Problem
User reported 10 colors with incorrect family classifications:

### Light pinks classified as Vermelho (should be Rosa):
- #DC8592
- #E97989
- #F2CCCE
- #C7999E

### Dark burgundy classified as Rosa (should be Vermelho):
- #762F55

### Terracotta/coral tones classified as Bege (should be Laranja):
- #C29188
- #C58C89
- #DC9F9F

### Already correct (Laranja):
- #E9A79E
- #EF8883

## Root Causes Identified

1. **Light pinks falling through to Vermelho**: Hue-based classification was classifying low-hue colors (0-20°) as Vermelho without considering they were desaturated light pinks
2. **Bege capturing terracotta**: Bege range (20-105° hue, chroma < 20) was too broad and capturing warm terracotta/coral tones
3. **Need to expand Laranja**: Coral and salmon tones (hue 55-65°) needed to be included in Laranja instead of Amarelo

## Solution Implemented

### 1. Added Rosa Classification Rule (Before Bege)
```typescript
// Rosa claro/médio: tons rosados claros que caem na faixa 0-40°
if (a > 12 && b >= 0 && (hue < 40 || hue > 340) && light > 0.45) {
  // Rosa se b* é pequeno em relação a a* E (b* absoluto baixo OU chroma médio-baixo)
  // E não está na zona de terracota/coral (hue 20-40° com chroma > 18)
  if (b < a * 0.5 && (b < 15 || chroma < 30) && !(hue >= 20 && hue < 40 && chroma > 18)) return 'Rosa'
}
```

**Criteria for Rosa:**
- `a > 12`: Requires pink/red component
- `b >= 0`: Non-negative yellow (excludes purples)
- `hue < 40° || hue > 340°`: Low hue angles (red-pink range)
- `light > 0.45`: Medium to high lightness (not dark)
- `b < a * 0.5`: Yellow component less than half of red (prevents orange tones)
- `(b < 15 || chroma < 30)`: Either very low yellow OR low saturation overall
- `!(hue >= 20 && hue < 40 && chroma > 18)`: Excludes terracotta/coral (moderate chroma in orange range)

### 2. Modified Bege Rule
```typescript
// Bege: tons dessaturados de laranja/amarelo com luminosidade alta
if (chroma >= 5 && chroma < 25 && light > 0.55 && hue >= 30 && hue < 105) {
  // Não captura terracotta/coral (hue 30-40°, chroma > 18)
  if (!(hue >= 30 && hue < 40 && chroma > 18)) return 'Bege'
}
```

**Changes:**
- Increased chroma threshold from 20 to 25 (captures more desaturated yellows like #ECE6CC)
- Changed hue start from 20° to 30° (excludes pink tones)
- Added exclusion for terracotta/coral in 30-40° range with chroma > 18

### 3. Expanded Laranja Range
```typescript
DEFAULT_HUE_BOUNDS: {
  amareloStart: 65, // Changed from 55
}
```

**Effect:**
- Laranja now covers 20-65° (instead of 20-55°)
- Captures coral and salmon tones that were falling into Amarelo

## Classification Order (Critical)
1. Acromático (chroma < 5)
2. **Rosa** (NEW - must be before Bege to catch light pinks)
3. Bege (desaturated light orange/yellow)
4. Marrom (dark orange)
5. Dark blue special case
6. Hue-based classification (Vermelho, Laranja, Amarelo, etc.)

## Test Results

### All 10 User-Reported Colors: ✅ 100% Correct
- #DC8592 → Rosa ✅
- #E97989 → Rosa ✅
- #F2CCCE → Rosa ✅
- #C7999E → Rosa ✅
- #762F55 → Vermelho ✅
- #C29188 → Laranja ✅
- #C58C89 → Laranja ✅
- #DC9F9F → Laranja ✅
- #E9A79E → Laranja ✅
- #EF8883 → Laranja ✅

### Test Suite: ✅ 104/104 Passing
- 16 new tests for pink/rose classification
- 7 tests for beige/brown edge cases
- 7 tests for other edge cases
- All 74 existing tests still passing (no regressions)

## Key Insights

1. **Perceptual vs LAB boundaries**: Human perception doesn't always align with hue angles. Light pinks at hue 0-20° are perceptually "pink" not "red"

2. **Chroma matters**: Same hue can be different families based on saturation:
   - Low chroma (< 18) at hue 30° → Bege
   - High chroma (> 18) at hue 30° → Laranja

3. **Classification order is critical**: Rosa must come before Bege because some light pinks have low chroma and would be caught by Bege

4. **Boundary refinement**: The challenge was distinguishing:
   - True pinks (low b*, high a*) → Rosa
   - Coral/salmon (moderate a* and b*) → Laranja  
   - Terracotta (moderate chroma in orange range) → Laranja
   - Beige (low chroma in yellow range) → Bege

## Files Modified
- `app/src/lib/color-utils.ts`: Added Rosa rule, modified Bege rule, expanded Laranja range
- `app/src/tests/color-pink-classification.test.ts`: New test suite (16 tests)
- `app/src/tests/user-reported-colors-verification.test.ts`: Final verification test
- `app/src/tests/color-classification-beige-brown.test.ts`: Updated for new chroma threshold

## Performance Impact
Minimal - added one additional conditional check before Bege classification.
