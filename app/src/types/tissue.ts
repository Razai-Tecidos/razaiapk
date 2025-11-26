export type Tissue = {
  id: string
  name: string
  width: number
  composition: string
  sku: string
  color?: string
  createdAt: string
}

export type TissueInput = {
  name: string
  width: number
  composition: string
  color?: string
}
