export interface StockItem {
  id: string
  link_id: string
  quantity_rolls: number
  updated_at: string
}

export interface StockMovement {
  id: string
  link_id: string
  type: 'IN' | 'OUT' | 'ADJUST'
  quantity: number
  created_at: string
  user_id?: string
}

export interface DailyConsumption {
  link_id: string
  consumption_date: string
  total_consumed: number
}

export interface StockPrediction {
  link_id: string
  days_until_stockout: number
  status: 'CRITICAL' | 'WARNING' | 'SAFE'
  suggested_restock: number
}
