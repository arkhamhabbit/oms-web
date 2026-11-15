import type {
  FulfilAction,
  OrderDetail,
  OrderPayment,
  OrderStatus,
  RefundState,
} from '@/api/orders'
import { minorToMajorString } from '@/lib/money'

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

export function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value.trim())
}

/** The permission both refund actions (via Razorpay, mark as refunded) need. */
export const REFUND_SETTLEMENT_PERMISSION = 'orders.refund'

export const rupees = (minor: number | undefined) => `₹${minorToMajorString(minor ?? 0)}`

/** D9.6: a payment whose refund is owed. */
export function isRefundPending(payment: OrderPayment | undefined): boolean {
  return payment?.status === 'REFUND_PENDING'
}

export type RefundHeadline = 'OWED' | 'INITIATED' | 'REFUNDED' | 'VOIDED'

export interface RefundGate {
  /** The panel is shown at all: the order's refund state is not NONE. */
  visible: boolean
  headline: RefundHeadline | undefined
  /** A REQUESTED row exists: the gateway never answered, so a second press could refund twice. */
  lostAnswer: boolean
  /** Refund via Razorpay and Mark as refunded may be pressed (permission aside). */
  canSettle: boolean
  /** Refund via Razorpay only: the gateway must show the payment as captured. */
  canGateway: boolean
  /** Only Refresh is offered. */
  canRefresh: boolean
  /** Why the two actions are off, in words (undefined when they are on). */
  settleReason: string | undefined
  gatewayReason: string | undefined
  /** The sentence to show when a REQUESTED row exists. */
  lostAnswerSentence: string | undefined
}

const IN_FLIGHT = 'A refund through the payment gateway is already in progress for this order. Refresh it to see where it stands.'
const NOT_CAPTURED = 'The payment was never captured, so there is nothing to refund.'
const LOST_ANSWER =
  'The payment gateway did not answer the refund request, so OMS cannot tell whether it went through. Refresh to find out; pressing again could refund twice.'

/**
 * D9.8 — when each refund action is allowed. Both need a payment that is owed (`REFUND_PENDING`)
 * with no refund row still REQUESTED (the gateway did not answer) or INITIATED (in flight). A
 * VOIDED payment was never charged: nothing is owed and OMS answers 422. Razorpay is asked only
 * when the gateway itself shows the payment as captured.
 */
export function refundGate(order: OrderDetail): RefundGate {
  const state = order.refundState ?? 'NONE'
  const rows = order.refunds ?? []
  const payment = order.payment
  const lostAnswer = rows.some((r) => r.outcome === 'REQUESTED')
  const inFlight =
    rows.some((r) => r.outcome === 'INITIATED') ||
    payment?.status === 'REFUND_INITIATED' ||
    state === 'INITIATED'
  const voided = state === 'VOIDED' || payment?.status === 'VOIDED'
  const owed = payment?.status === 'REFUND_PENDING'

  let settleReason: string | undefined
  if (voided) {
    settleReason = payment?.voidReason ?? NOT_CAPTURED
  } else if (lostAnswer) {
    settleReason = payment?.lastRefundError ?? LOST_ANSWER
  } else if (inFlight) {
    settleReason = IN_FLIGHT
  } else if (!owed) {
    settleReason = 'No refund is owed on this order.'
  }
  const canSettle = settleReason === undefined
  const gatewayReason =
    settleReason ??
    (payment?.gatewayStatus && payment.gatewayStatus !== 'CAPTURED'
      ? `Razorpay does not show this payment as captured (${payment.gatewayStatus.toLowerCase()}).`
      : undefined)

  return {
    visible: state !== 'NONE',
    headline: state === 'NONE' ? undefined : state,
    lostAnswer,
    canSettle,
    canGateway: gatewayReason === undefined,
    canRefresh: (lostAnswer || inFlight) && !voided,
    settleReason,
    gatewayReason,
    lostAnswerSentence: lostAnswer ? (payment?.lastRefundError ?? LOST_ANSWER) : undefined,
  }
}

/** What was paid back: the rows that finished (processed at the gateway, or settled by hand). */
export function refundedMinor(order: OrderDetail): number {
  return (order.refunds ?? [])
    .filter((r) => r.outcome === 'PROCESSED' || r.outcome === 'SETTLED')
    .reduce((sum, r) => sum + (r.amountMinor ?? 0), 0)
}

/** Whether the payment counts as captured, from what the list row carries. */
export function paymentCapturedLabel(order: {
  confirmedAt?: string
  refundState?: RefundState
}): 'Captured' | 'Not captured' {
  return order.refundState !== 'VOIDED' && order.confirmedAt ? 'Captured' : 'Not captured'
}

const CARRIER_TRACKING: { match: RegExp; url: (ref: string) => string }[] = [
  { match: /delhivery/i, url: (r) => `https://www.delhivery.com/track/package/${r}` },
  { match: /blue\s*dart/i, url: (r) => `https://www.bluedart.com/tracking?trackfor=0&trackno=${r}` },
]

/** A tracking page for a carrier whose URL pattern is known; undefined otherwise (shown as plain text). */
export function trackingUrl(carrier?: string, reference?: string): string | undefined {
  if (!carrier || !reference) {
    return undefined
  }
  const known = CARRIER_TRACKING.find((c) => c.match.test(carrier))
  return known ? known.url(encodeURIComponent(reference.trim())) : undefined
}
