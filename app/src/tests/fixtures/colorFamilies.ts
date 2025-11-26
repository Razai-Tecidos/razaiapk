export type FamilyKey =
  | 'Vermelho' | 'Laranja' | 'Amarelo' | 'Verde' | 'Azul' | 'Roxo' | 'Rosa' | 'Bordô' | 'Marrom' | 'Bege'

// Duas cores de referência por família: [clara, escura]
export const FAMILY_TARGETS: Record<FamilyKey, [string, string]> = {
  Vermelho: ['#E15B55', '#750919'],
  Laranja: ['#FFA64D', '#CC5500'],
  Amarelo: ['#F6E05E', '#B8860B'],
  Verde: ['#6EC972', '#0B6E4F'],
  Azul: ['#5AA7FF', '#003F91'],
  Roxo: ['#B287F6', '#4B0082'],
  Rosa: ['#F48FB1', '#AF1E4A'],
  Bordô: ['#812B38', '#4A1526'],
  Marrom: ['#C68642', '#4E342E'],
  Bege: ['#E6D5B8', '#BCAAA4'],
}

export const FAMILY_KEYS = Object.keys(FAMILY_TARGETS) as FamilyKey[]
