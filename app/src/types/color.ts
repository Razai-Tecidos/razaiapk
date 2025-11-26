export type Color = {
  id: string
  name: string
  hex?: string
  labL?: number
  labA?: number
  labB?: number
  sku: string // SKU_Cor sequencial imutável (C001, C002, ...)
  createdAt: string
}

export type ColorInput = {
  name: string
  hex?: string
  labL?: number
  labA?: number
  labB?: number
}
