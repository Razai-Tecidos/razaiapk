export type Pattern = {
  id: string
  family: string // nome da família (ex: Jardim, Geométrica)
  name: string   // nome da estampa dentro da família (ex: Pink)
  sku: string    // código por família (ex: JA001)
  image_path?: string // caminho da imagem no storage
  image?: string // URL pública (view only)
  imageThumb?: string // Thumbnail base64 (local only)
  createdAt: string
}

export type PatternInput = {
  family: string
  name: string
  image_path?: string
}
