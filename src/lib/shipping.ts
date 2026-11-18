import type { OrderSummary } from '@/api/orders'
import type { ShipmentStatus, ShippingCallAction } from '@/api/shipping'

export type ShipmentState = NonNullable<OrderSummary['shipmentState']>

/** Where an order's shipping stands (the order's `shipmentState`), as the team reads it. */
export const SHIPMENT_STATE_LABEL: Record<ShipmentState, string> = {
  NONE: 'Not booked',
  BOOKING_FAILED: 'Booking failed',
  BOOKED: 'Booked, awaiting pickup',
  IN_TRANSIT: 'In transit',
  OUT_FOR_DELIVERY: 'Out for delivery',
  DELIVERED: 'Delivered',
  PROBLEM: 'Problem',
  // No longer written by OMS (2.11: a cancelled shipment leaves the order NONE); read the same.
  CANCELLED: 'Not booked',
}

/** A shipment's own status. */
export const SHIPMENT_STATUS_LABEL: Record<ShipmentStatus, string> = {
  BOOKED: 'Booked, awaiting pickup',
  PICKED_UP: 'Picked up',
  IN_TRANSIT: 'In transit',
  OUT_FOR_DELIVERY: 'Out for delivery',
  DELIVERED: 'Delivered',
  DELIVERY_FAILED: 'Delivery failed',
  RETURNING: 'Returning',
  RETURNED: 'Returned',
  LOST: 'Lost',
  DAMAGED: 'Damaged',
  CANCELLED: 'Cancelled',
}

export const CALL_ACTION_LABEL: Record<ShippingCallAction, string> = {
  AUTH: 'Sign-in',
  BOOK: 'Book',
  LOOKUP: 'Look up',
  CANCEL: 'Cancel',
  TRACK: 'Track',
  LABEL: 'Label',
  TEST: 'Test',
}
export const CALL_ACTIONS = Object.keys(CALL_ACTION_LABEL) as ShippingCallAction[]

/** The providers the contract names. Names on screen come from the providers list when it is readable. */
export const PROVIDER_CODES = ['PROSHIP', 'MANUAL'] as const
export function providerLabel(code: string | undefined | null): string {
  if (!code) {
    return '—'
  }
  return code === 'MANUAL' ? 'Manual' : code === 'PROSHIP' ? 'Proship' : code
}

/** Manual shipments are moved by hand; every other provider's are moved by the courier (D13.6). */
export function isCourierProvider(code: string | undefined | null): boolean {
  return !!code && code !== 'MANUAL'
}

/**
 * D13.11: no live Proship booking has passed yet, so the console does not offer it as the default
 * (and so automatic booking, which never uses Manual, stays off). Remove a code from here once its
 * live booking, label, track and cancel have passed.
 */
export const UNPROVEN_PROVIDERS: Readonly<Record<string, string>> = {
  PROSHIP:
    'Not proven live yet: Proship has not passed a live booking, label, tracking and cancel, so it cannot be the default until it does.',
}

// --- selection on the orders list --------------------------------------------------------------

/** D13.5: twenty is what the team prints in one go. */
export const SELECTION_CAP = 20
export const SELECTION_CAP_HINT = '20 at a time — labels print as one file'

export type Selection = ReadonlyMap<string, OrderSummary>

/** Ticks or unticks one row. A 21st tick is refused (the selection comes back unchanged). */
export function toggleSelected(selection: Selection, row: OrderSummary): Map<string, OrderSummary> {
  const next = new Map(selection)
  if (next.has(row.id!)) {
    next.delete(row.id!)
  } else if (next.size < SELECTION_CAP) {
    next.set(row.id!, row)
  }
  return next
}

/** The page's header box: unticks the page when all of it is ticked, otherwise ticks it up to the cap. */
export function togglePage(selection: Selection, rows: OrderSummary[]): Map<string, OrderSummary> {
  const next = new Map(selection)
  const allOn = rows.length > 0 && rows.every((r) => next.has(r.id!))
  if (allOn) {
    rows.forEach((r) => next.delete(r.id!))
    return next
  }
  for (const r of rows) {
    if (next.size >= SELECTION_CAP) {
      break
    }
    next.set(r.id!, r)
  }
  return next
}

/** A row's box is disabled when the cap is reached and it is not one of the twenty. */
export function selectionBlocked(selection: Selection, id: string): boolean {
  return selection.size >= SELECTION_CAP && !selection.has(id)
}

// --- presets on the orders list ----------------------------------------------------------------

export type ShippingPreset = 'TO_SHIP' | 'BOOKING_FAILED' | 'NOT_PRINTED' | 'IN_TRANSIT' | 'PROBLEMS'

export interface PresetFilter {
  shipmentState?: ShipmentState[]
  bookable?: boolean
  labelPrinted?: boolean
}

/**
 * The packing presets, and what each one sends to `GET /api/admin/orders`:
 * - **To ship**: `bookable=true` — CONFIRMED, paid, and no shipment that is neither cancelled nor
 *   failed (OMS 2.11). An order whose booking was refused can be booked again, so it is in this list
 *   as well as under Booking failed; the two counts overlap on purpose.
 * - **Booking failed**: `shipmentState=BOOKING_FAILED`.
 * - **Booked, label not printed**: `shipmentState=BOOKED` and `labelPrinted=false`.
 * - **In transit**: `shipmentState=IN_TRANSIT`. **Problems**: `shipmentState=PROBLEM`.
 */
export const SHIPPING_PRESETS: { key: ShippingPreset; label: string; filter: PresetFilter }[] = [
  { key: 'TO_SHIP', label: 'To ship', filter: { bookable: true } },
  { key: 'BOOKING_FAILED', label: 'Booking failed', filter: { shipmentState: ['BOOKING_FAILED'] } },
  {
    key: 'NOT_PRINTED',
    label: 'Booked, label not printed',
    filter: { shipmentState: ['BOOKED'], labelPrinted: false },
  },
  { key: 'IN_TRANSIT', label: 'In transit', filter: { shipmentState: ['IN_TRANSIT'] } },
  { key: 'PROBLEMS', label: 'Problems', filter: { shipmentState: ['PROBLEM'] } },
]

// --- what a row can be selected for ------------------------------------------------------------

/** Booking is offered on `bookable` rows only. */
export function canBookRow(row: OrderSummary): boolean {
  return row.bookable === true
}

/** Printing is offered on rows with a live shipment: the row carries its current shipment's id. */
export function canPrintRow(row: OrderSummary): boolean {
  return !!row.shipmentId
}

export function canSelectRow(row: OrderSummary): boolean {
  return canBookRow(row) || canPrintRow(row)
}

/** Why an action in the selection bar is off, or undefined when it fits at least one selected order. */
export function actionBlockedReason(
  selection: Selection,
  action: 'book' | 'print'
): string | undefined {
  const rows = [...selection.values()]
  if (action === 'book') {
    return rows.some(canBookRow) ? undefined : 'None of the selected orders can be booked now.'
  }
  return rows.some(canPrintRow) ? undefined : 'None of the selected orders has a booked shipment.'
}

// --- warehouses --------------------------------------------------------------------------------

/** What `pickupWarehouse.missingContact` names, in words. */
export const MISSING_CONTACT_LABEL = {
  NAME: 'contact name',
  PHONE: 'contact phone',
  EMAIL: 'contact email',
} as const

export function listInWords(items: string[]): string {
  if (items.length <= 1) {
    return items.join('')
  }
  return `${items.slice(0, -1).join(', ')} and ${items.at(-1)}`
}

/** A light format check; the server is the authority. */
export function isEmailLike(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim())
}

// --- files and bodies --------------------------------------------------------------------------

export function base64ToBlob(base64: string, contentType = 'application/pdf'): Blob {
  const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0))
  return new Blob([bytes], { type: contentType })
}

/**
 * A tab opened while the click is still a user gesture (so no popup blocker stops it), filled once
 * the PDF has arrived, or closed if there is nothing to print. `blocked` is true when the browser
 * refused even that; the caller then offers a link instead.
 */
export function openPrintTab() {
  const tab = window.open('', '_blank')
  return {
    blocked: !tab,
    show(blob: Blob): string {
      const url = URL.createObjectURL(blob)
      if (tab) {
        tab.location.href = url
      }
      return url
    },
    close() {
      tab?.close()
    },
  }
}

/** A body as sent, formatted when it is JSON and left as it came when it is not. */
export function prettyBody(body: string | null | undefined): string {
  if (body == null || body === '') {
    return ''
  }
  try {
    return JSON.stringify(JSON.parse(body), null, 2)
  } catch {
    return body
  }
}

export function grams(value: number | undefined | null): string {
  return value == null ? '—' : `${value.toLocaleString('en-IN')} g`
}

export function box(l?: number | null, w?: number | null, h?: number | null): string {
  return l == null || w == null || h == null ? '—' : `${l} × ${w} × ${h} mm`
}
