export type TecidoEstampa = {
  id: string
  tissueId: string
  patternId: string
  skuFilho: string
  status: 'Ativo' | 'Inativo'
  createdAt: string
  // imagens (opcional)
  image?: string
  imagePath?: string
  imageMime?: string
  imageHash?: string
  imageThumb?: string
}

export type TecidoEstampaView = TecidoEstampa & {
  tissueSku: string
  tissueName: string
  width: number
  composition: string
  patternSku: string
  patternFamily: string
  patternName: string
  nomeCompleto: string
}
