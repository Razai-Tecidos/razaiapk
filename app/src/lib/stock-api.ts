const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY

/**
 * Calls the Supabase RPC function `register_stock_movement`.
 * This function handles both updating the stock balance and logging the movement history atomically.
 */
export async function registerStockMovement(
  linkId: string,
  type: 'IN' | 'OUT' | 'ADJUST',
  quantity: number,
  userId?: string
): Promise<{ ok: boolean; error?: string }> {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    return { ok: false, error: 'Supabase not configured' }
  }

  try {
    const url = `${SUPABASE_URL}/rest/v1/rpc/register_stock_movement`
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      },
      body: JSON.stringify({
        p_link_id: linkId,
        p_type: type,
        p_quantity: quantity,
        p_user_id: userId || null,
      }),
    })

    if (!res.ok) {
      const text = await res.text()
      return { ok: false, error: `RPC failed: ${res.status} ${text}` }
    }

    return { ok: true }
  } catch (e: any) {
    return { ok: false, error: e.message }
  }
}

/**
 * Fetches the current stock level for a specific link (Fabric+Color).
 */
export async function getStockLevel(linkId: string): Promise<number | null> {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) return null

  try {
    const url = `${SUPABASE_URL}/rest/v1/stock_items?link_id=eq.${linkId}&select=quantity_rolls`
    const res = await fetch(url, {
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      },
    })

    if (!res.ok) return null
    const data = await res.json()
    if (Array.isArray(data) && data.length > 0) {
      return data[0].quantity_rolls
    }
    return 0 // Default if not found
  } catch {
    return null
  }
}

/**
 * Fetches daily consumption history for prediction algorithms.
 */
export async function getDailyConsumption(linkId: string, days = 60): Promise<any[]> {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) return []

  try {
    // Calculate date threshold
    const date = new Date()
    date.setDate(date.getDate() - days)
    const dateStr = date.toISOString().split('T')[0]

    const url = `${SUPABASE_URL}/rest/v1/daily_stock_consumption?link_id=eq.${linkId}&consumption_date=gte.${dateStr}&order=consumption_date.asc`
    const res = await fetch(url, {
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      },
    })

    if (!res.ok) return []
    return await res.json()
  } catch {
    return []
  }
}
