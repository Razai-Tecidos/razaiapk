export type Pattern = {
  id: string
  family: string // nome da família (ex: Jardim, Geométrica)
  name: string   // nome da estampa dentro da família (ex: Pink)
  sku: string    // código por família (ex: JA001)
  createdAt: string
}

export type PatternInput = {
  family: string
  name: string
}
