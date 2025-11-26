// Text utilities for accent-insensitive search and comparisons
// Normalize strings by:
// - NFC->NFD to expose diacritics, then strip combining marks
// - Lowercase
// - Trim and collapse internal whitespace
export function normalizeForSearch(input: string | null | undefined): string {
  try {
    const s = (input ?? '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .trim()
      .replace(/\s+/g, ' ')
    return s
  } catch {
    // Fallback safe path if normalize not supported
    return String(input ?? '').toLowerCase().trim().replace(/\s+/g, ' ')
  }
}

export function includesSearch(haystack: string | null | undefined, needle: string | null | undefined): boolean {
  const h = normalizeForSearch(haystack)
  const n = normalizeForSearch(needle)
  if (!n) return true
  return h.includes(n)
}
