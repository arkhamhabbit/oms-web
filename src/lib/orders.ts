import type { FulfilAction, OrderStatus } from '@/api/orders'

export const ORDER_STATUSES: OrderStatus[] = [
  'PENDING_PAYMENT',
  'CONFIRMED',
  'PACKED',
  'SHIPPED',
  'OUT_FOR_DELIVERY',
  'DELIVERED',
  'PAYMENT_FAILED',
  'EXPIRED',
  'CANCELLED',
  'REFUNDED',
]

export const ORDER_STATUS_LABEL: Record<OrderStatus, string> = {
  PENDING_PAYMENT: 'Awaiting payment',
  CONFIRMED: 'Confirmed',
  PACKED: 'Packed',
  SHIPPED: 'Shipped',
  OUT_FOR_DELIVERY: 'Out for delivery',
  DELIVERED: 'Delivered',
  PAYMENT_FAILED: 'Payment failed',
  EXPIRED: 'Expired',
  CANCELLED: 'Cancelled',
  REFUNDED: 'Refunded',
}

/** Which permission each action needs — `orders.fulfil` for the steps, `write` to cancel, `refund` to refund. */
export const ACTION_PERMISSION: Record<FulfilAction, string> = {
  pack: 'orders.fulfil',
  ship: 'orders.fulfil',
  'out-for-delivery': 'orders.fulfil',
  deliver: 'orders.fulfil',
  cancel: 'orders.write',
  refund: 'orders.refund',
}

export const ACTION_LABEL: Record<FulfilAction, string> = {
  pack: 'Pack',
  ship: 'Ship',
  'out-for-delivery': 'Out for delivery',
  deliver: 'Deliver',
  cancel: 'Cancel order',
  refund: 'Refund',
}

/**
 * The actions worth offering from a status. Whether a cancel is still inside the window is the
 * server's call (the settings the order was placed under) — it refuses with its own sentence,
 * which the dialog shows, so the button is offered for every status a cancel can ever apply to.
 */
export function actionsFor(status: OrderStatus | undefined): FulfilAction[] {
  switch (status) {
    case 'PENDING_PAYMENT':
      return ['cancel']
    case 'CONFIRMED':
      return ['pack', 'cancel']
    case 'PACKED':
      return ['ship', 'cancel']
    case 'SHIPPED':
    case 'OUT_FOR_DELIVERY':
      return [status === 'SHIPPED' ? 'out-for-delivery' : 'deliver', 'refund']
    case 'DELIVERED':
      return ['refund']
    default:
      return []
  }
}

/** Start of an IST calendar day (the operators' day) as an ISO instant. */
export function istDayStart(date: string, addDays = 0): string | undefined {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return undefined
  }
  const start = new Date(`${date}T00:00:00+05:30`)
  if (Number.isNaN(start.getTime())) {
    return undefined
  }
  start.setUTCDate(start.getUTCDate() + addDays)
  return start.toISOString()
}

export function formatDateTime(value: string | undefined): string {
  return value ? new Date(value).toLocaleString() : ''
}

export function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value.trim())
}
