import type {
  AdminQuote,
  AdminQuoteLine,
  FulfilAction,
  OrderDetail,
  OrderPayment,
  OrderStatus,
  PaymentLink,
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
  ship: 'orders.fulfil',
  'out-for-delivery': 'orders.fulfil',
  deliver: 'orders.fulfil',
  cancel: 'orders.write',
  refund: 'orders.refund',
}

export const ACTION_LABEL: Record<FulfilAction, string> = {
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
 *
 * 2.8: booking replaces packing (a confirmed order is booked from the Shipment panel; `pack` is a
 * deprecated alias and is not called). The hand steps remain only for a Manual shipment, or an
 * order with none: a courier's own events move the order (D13.6), so `courier` hides them.
 */
export function actionsFor(status: OrderStatus | undefined, courier = false): FulfilAction[] {
  switch (status) {
    case 'PENDING_PAYMENT':
    case 'CONFIRMED':
      return ['cancel']
    case 'PACKED':
      return courier ? ['cancel'] : ['ship', 'cancel']
    case 'SHIPPED':
    case 'OUT_FOR_DELIVERY':
      if (courier) {
        return ['refund']
      }
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
  /** The refund owed is only an excess payment, refunded from its own row. */
  excessOnly: boolean
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
const EXCESS_ONLY =
  'The refund owed is an excess payment: refund it from its row in the Payment panel.'
const MANUAL_NO_GATEWAY =
  'This order was paid outside Razorpay, so it cannot be refunded through Razorpay. Record the refund instead.'
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
  } else if (!owed && excessOwed(order).length > 0) {
    settleReason = EXCESS_ONLY
  } else if (!owed) {
    settleReason = 'No refund is owed on this order.'
  }
  const canSettle = settleReason === undefined
  const gatewayReason =
    settleReason ??
    (isManualPayment(payment)
      ? MANUAL_NO_GATEWAY
      : payment?.gatewayStatus && payment.gatewayStatus !== 'CAPTURED'
        ? `Razorpay does not show this payment as captured (${payment.gatewayStatus.toLowerCase()}).`
        : undefined)

  return {
    visible: state !== 'NONE',
    headline: state === 'NONE' ? undefined : state,
    lostAnswer,
    canSettle,
    canGateway: gatewayReason === undefined,
    excessOnly: settleReason === EXCESS_ONLY,
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

// ---- W3.10: orders the team places ------------------------------------------------------------

export const CREATE_ORDER_PERMISSION = 'orders.create'
export const MARK_PAID_PERMISSION = 'orders.mark_paid'

export const isTeamOrder = (order: OrderDetail): boolean => order.source === 'ADMIN'

/** The live link: the one still ISSUED (OMS allows at most one). */
export function liveLink(order: OrderDetail): PaymentLink | undefined {
  return (order.paymentLinks ?? []).find((l) => l.status === 'ISSUED')
}

/** Links other than the live one, newest first as served. */
export function earlierLinks(order: OrderDetail): PaymentLink[] {
  const live = liveLink(order)
  return (order.paymentLinks ?? []).filter((l) => l !== live)
}

/** A new link can be issued: a team order still waiting for payment with no live link. */
export function canIssueLink(order: OrderDetail): boolean {
  return isTeamOrder(order) && order.status === 'PENDING_PAYMENT' && !liveLink(order)
}

/** Mark as paid is for a team order that is still waiting for payment. */
export function canMarkPaid(order: OrderDetail): boolean {
  return isTeamOrder(order) && order.status === 'PENDING_PAYMENT'
}

/** Time left to a link's expiry, as words: `23 h 41 min`, `12 min`, or `Expired`. */
export function countdown(expiresAt: string | undefined, now: number): string {
  if (!expiresAt) {
    return '—'
  }
  const ms = new Date(expiresAt).getTime() - now
  if (Number.isNaN(ms)) {
    return '—'
  }
  if (ms <= 0) {
    return 'Expired'
  }
  const minutes = Math.ceil(ms / 60_000)
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return h > 0 ? `${h} h ${m} min` : `${m} min`
}

export const isManualPayment = (payment: OrderPayment | undefined): boolean =>
  payment?.gateway === 'MANUAL'

/** What a manual refund can still take: what was paid, less manual refunds already recorded. */
export function manualRefundLeftMinor(order: OrderDetail): number {
  const paid = order.payment?.amountMinor ?? 0
  const done = (order.refunds ?? [])
    .filter((r) => r.method === 'MANUAL' && r.outcome === 'SETTLED')
    .reduce((sum, r) => sum + (r.amountMinor ?? 0), 0)
  return Math.max(0, paid - done)
}

/** Record refund is offered on a manually paid order that was paid and not yet paid back in full. */
export function canRecordRefund(order: OrderDetail): boolean {
  const status = order.payment?.status
  return (
    isManualPayment(order.payment) &&
    (status === 'CAPTURED' || status === 'REFUND_PENDING') &&
    manualRefundLeftMinor(order) > 0
  )
}

/** An excess payment (a link paid after the order was already paid) that is owed back. */
export function excessOwed(order: OrderDetail): OrderPayment[] {
  return (order.excessPayments ?? []).filter((p) => p.status === 'REFUND_PENDING')
}

/** A manual payment shows its reference where a gateway payment id would be. */
export function paymentReference(payment: OrderPayment | undefined): string | undefined {
  return isManualPayment(payment)
    ? (payment?.manualReference ?? undefined)
    : payment?.gatewayPaymentId
}

/** An Indian mobile typed as ten digits, with or without +91 / 91 / 0; undefined when it is not one. */
export function normaliseMobile(input: string): string | undefined {
  const digits = input.replace(/[\s-]/g, '')
  const m = /^(?:\+91|91|0)?([6-9]\d{9})$/.exec(digits)
  return m ? `+91${m[1]}` : undefined
}

export const isPincode = (value: string): boolean => /^\d{6}$/.test(value.trim())

/** A name appears in a sentence as a whole word (so a variant called "M" is not found inside "member"). */
function namesIn(sentence: string, name: string | null | undefined): boolean {
  const trimmed = name?.trim()
  if (!trimmed) {
    return false
  }
  const escaped = trimmed.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return new RegExp(`(^|[^\\p{L}\\p{N}])${escaped}($|[^\\p{L}\\p{N}])`, 'iu').test(sentence)
}

export interface PlacedRefusals {
  /** Refusals that name a line (its SKU, variant or product), keyed by `variantId`. */
  byVariant: Map<string, string[]>
  /** The rest: about the member, the address or the basket as a whole. */
  general: string[]
}

/**
 * The server states each refusal as one sentence. Where it names a line's SKU, variant or
 * product the sentence is placed beside that line; the rest are shown on their own.
 */
export function placeRefusals(quote: AdminQuote | undefined): PlacedRefusals {
  const byVariant = new Map<string, string[]>()
  const general: string[] = []
  const lines: AdminQuoteLine[] = quote?.lines ?? []
  for (const sentence of quote?.refusals ?? []) {
    const hit = lines.find((l) =>
      [l.skuCode, l.variantName, l.productName].some((name) => namesIn(sentence, name))
    )
    if (hit?.variantId) {
      byVariant.set(hit.variantId, [...(byVariant.get(hit.variantId) ?? []), sentence])
    } else {
      general.push(sentence)
    }
  }
  return { byVariant, general }
}

/** Mark as paid: what the dialog can check before it asks. The server's sentence still decides. */
export function markPaidProblems(input: {
  reference: string
  amount: string
  receivedAt: string
  now: number
}): { reference?: string; amount?: string; receivedAt?: string } {
  const out: { reference?: string; amount?: string; receivedAt?: string } = {}
  if (!input.reference.trim()) {
    out.reference = 'Enter the reference of the payment.'
  }
  if (!/^\d+(\.\d{1,2})?$/.test(input.amount.trim().replace(/,/g, ''))) {
    out.amount = 'Enter the amount received in rupees, up to two decimals.'
  }
  const at = new Date(input.receivedAt).getTime()
  if (!input.receivedAt || Number.isNaN(at)) {
    out.receivedAt = 'Enter when the payment was received.'
  } else if (at > input.now) {
    out.receivedAt = 'The payment cannot have been received in the future.'
  }
  return out
}
