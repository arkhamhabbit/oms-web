import * as React from 'react'

import type { OrderSummary } from '@/api/orders'
import { togglePage, toggleSelected, type Selection } from '@/lib/shipping'

const STORAGE_KEY = 'oms.orders.selection'

function load(): Map<string, OrderSummary> {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY)
    const rows = raw ? (JSON.parse(raw) as OrderSummary[]) : []
    return new Map(rows.filter((r) => r?.id).map((r) => [r.id!, r]))
  } catch {
    return new Map()
  }
}

function save(selection: Selection) {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify([...selection.values()]))
  } catch {
    // Storage may be unavailable (private mode); the selection still lives for the page.
  }
}

/**
 * The orders ticked for shipping: capped at twenty, kept across pages and for the browser session
 * (sessionStorage), cleared after a successful action.
 */
export function useOrderSelection() {
  const [selection, setSelection] = React.useState<Map<string, OrderSummary>>(load)

  const commit = React.useCallback((next: Map<string, OrderSummary>) => {
    save(next)
    setSelection(next)
  }, [])

  return {
    selection: selection as Selection,
    toggle: (row: OrderSummary) => commit(toggleSelected(selection, row)),
    togglePage: (rows: OrderSummary[]) => commit(togglePage(selection, rows)),
    clear: () => commit(new Map()),
  }
}
