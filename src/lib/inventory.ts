import type {
  AvailabilityReconcileResult,
  Batch,
  MovementType,
  StockMovement,
  WarehouseType,
} from '@/api/inventory'
import { formatDate } from '@/lib/dates'

export const WAREHOUSE_TYPES: WarehouseType[] = ['OWN', 'THIRD_PARTY']

export const MOVEMENT_TYPES: MovementType[] = [
  'RECEIPT',
  'ADJUSTMENT',
  'TRANSFER_OUT',
  'TRANSFER_IN',
  'DAMAGE',
  'EXPIRY_WRITE_OFF',
  'RETURN',
  'SALE',
]

/** The types the adjust endpoint takes; the transfer halves exist only as a pair and SALE is the storefront's. */
export const ADJUSTABLE_TYPES: MovementType[] = [
  'RECEIPT',
  'ADJUSTMENT',
  'DAMAGE',
  'EXPIRY_WRITE_OFF',
  'RETURN',
]

/** How the sign of the typed quantity is fixed by the movement type. `either` is an adjustment. */
export type QuantitySign = 'positive' | 'negative' | 'either'

export function quantitySignFor(type: MovementType): QuantitySign {
  switch (type) {
    case 'RECEIPT':
    case 'RETURN':
      return 'positive'
    case 'DAMAGE':
    case 'EXPIRY_WRITE_OFF':
      return 'negative'
    default:
      return 'either'
  }
}

/**
 * The signed quantity to send for what the operator typed. The form asks for a plain count for
 * the fixed-sign types (the type already says which way it goes), and a signed one for an
 * adjustment. Returns null for anything that is not a non-zero whole number.
 */
export function signedQuantity(type: MovementType, typed: string): number | null {
  const trimmed = typed.trim()
  if (!/^[+-]?\d+$/.test(trimmed)) {
    return null
  }
  const value = Number.parseInt(trimmed, 10)
  if (value === 0) {
    return null
  }
  switch (quantitySignFor(type)) {
    case 'positive':
      return Math.abs(value)
    case 'negative':
      return -Math.abs(value)
    default:
      return value
  }
}

/** A positive whole number, or null. */
export function positiveInt(typed: string): number | null {
  return /^\d+$/.test(typed.trim()) && Number.parseInt(typed, 10) > 0
    ? Number.parseInt(typed, 10)
    : null
}

/** Whether a movement is half of a transfer (its reference id opens both halves). */
export function isTransferHalf(movement: StockMovement): boolean {
  return movement.movementType === 'TRANSFER_OUT' || movement.movementType === 'TRANSFER_IN'
}

/** `signed` for the ledger: +4 / −1, with a true minus sign. */
export function formatSigned(quantity: number | undefined): string {
  if (quantity === undefined) {
    return ''
  }
  return quantity > 0 ? `+${quantity}` : quantity < 0 ? `−${Math.abs(quantity)}` : '0'
}

/** Today in the operators' calendar (Asia/Kolkata) as YYYY-MM-DD, for date inputs and receipt dates. */
export function todayIst(now: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now)
  return parts
}

/** Optional text → the string, or undefined so it is left off the wire rather than sent empty. */
export function optionalText(value: string | undefined): string | undefined {
  const trimmed = value?.trim()
  return trimmed ? trimmed : undefined
}

export function batchLabel(batch: Batch): string {
  const expiry = batch.expiresOn ? ` · expires ${formatDate(batch.expiresOn)}` : ''
  return `${batch.batchNumber}${expiry}${batch.expired ? ' (expired)' : ''}`
}

export interface AvailabilitySummary {
  checked: number
  /** Counters written now: lowered, raised, created or removed. */
  applied: number
  /** Raises held back for the grace period, so a shopper's in-flight reservation is not re-sold. */
  deferred: number
  /** Counters that moved under the check itself and were left for the next run. */
  changedDuringCheck: number
  inSync: number
}

/** The reconcile result in the terms an operator reads: applied / deferred, not eight action codes. */
export function summariseAvailability(result: AvailabilityReconcileResult): AvailabilitySummary {
  const changed = result.changed ?? []
  const count = (...actions: string[]) =>
    changed.filter((r) => actions.includes(r.action ?? '')).length
  return {
    checked: result.variantsChecked ?? 0,
    applied: count('CORRECTED_DOWN', 'CORRECTED_UP', 'POPULATED', 'REMOVED'),
    deferred: count('UPWARD_DEFERRED'),
    changedDuringCheck: count('CHANGED_DURING_CHECK'),
    inSync: Math.max(0, (result.variantsChecked ?? 0) - changed.length),
  }
}
