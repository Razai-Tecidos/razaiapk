export type TecidoCor = {
  id: string
  tissueId: string
  colorId: string
  skuFilho: string
  status: 'Ativo' | 'Inativo'
  createdAt: string
  // Legado (antes do sistema completo): data URL
  image?: string
  // Sistema completo
  imagePath?: string // caminho do arquivo (Tauri) ou pseudo-path (web: idb:<hash>)
  imageMime?: string
  imageHash?: string
  imageThumb?: string // Data URL pequena para UI
}

// View model with derived fields from current Tissue and Color
export type TecidoCorView = TecidoCor & {
  tissueSku: string
  tissueName: string
  width: number
  composition: string
  colorSku: string
  colorName: string
  family: string
  hex?: string
  nomeCompleto: string
}
