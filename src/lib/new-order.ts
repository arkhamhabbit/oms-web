import type { AdminQuoteRequest } from '@/api/orders'
import { isPincode, normaliseMobile } from '@/lib/orders'

/** One line of the basket as the page holds it: which variant and how many. Never a price. */
export interface BasketLine {
  variantId: string
  productName: string
  variantName: string
  skuCode: string
  quantity: number
}

export const MAX_LINE_QUANTITY = 99

export interface TypedAddress {
  label: string
  line1: string
  landmark: string
  pincode: string
}

export interface DeliveryDraft {
  mode: 'book' | 'typed'
  /** The member's own address, when `mode` is `book`. */
  addressId: string | undefined
  typed: TypedAddress
  /** Optional delivery mobile; empty means the address's own (or the member's). */
  mobile: string
}

export const EMPTY_DELIVERY: DeliveryDraft = {
  mode: 'book',
  addressId: undefined,
  typed: { label: '', line1: '', landmark: '', pincode: '' },
  mobile: '',
}

export const TYPED_ADDRESS_NOTE = "Used for this order only; not saved to the member's address book."

/** What is wrong with the delivery draft, in words, by field; empty when it can be quoted. */
export function deliveryProblems(d: DeliveryDraft): { address?: string; line1?: string; pincode?: string; mobile?: string } {
  const out: { address?: string; line1?: string; pincode?: string; mobile?: string } = {}
  if (d.mode === 'book') {
    if (!d.addressId) {
      out.address = 'Choose one of the member’s addresses, or type one.'
    }
  } else {
    if (!d.typed.line1.trim()) {
      out.line1 = 'Enter the first line of the address.'
    }
    if (!isPincode(d.typed.pincode)) {
      out.pincode = 'A pincode is six digits.'
    }
  }
  if (d.mobile.trim() && !normaliseMobile(d.mobile)) {
    out.mobile = 'Enter a 10-digit Indian mobile number (+91).'
  }
  return out
}

/**
 * The quote request for the current draft, or undefined while something is still missing. The
 * request carries ids, quantities and an address, and nothing else: OMS sets every price.
 */
export function buildQuoteRequest(
  memberId: string | undefined,
  lines: BasketLine[],
  delivery: DeliveryDraft
): AdminQuoteRequest | undefined {
  if (!memberId || lines.length === 0 || Object.keys(deliveryProblems(delivery)).length > 0) {
    return undefined
  }
  const deliveryMobile = delivery.mobile.trim() ? normaliseMobile(delivery.mobile) : undefined
  const base = {
    memberId,
    lines: lines.map((l) => ({ variantId: l.variantId, quantity: l.quantity })),
    deliveryMobile,
  }
  return delivery.mode === 'book'
    ? { ...base, addressId: delivery.addressId }
    : {
        ...base,
        address: {
          label: delivery.typed.label.trim() || undefined,
          line1: delivery.typed.line1.trim(),
          landmark: delivery.typed.landmark.trim() || undefined,
          pincode: delivery.typed.pincode.trim(),
        },
      }
}

/** Adds one of a variant, or one more of it when it is already in the basket. */
export function addToBasket(lines: BasketLine[], add: Omit<BasketLine, 'quantity'>): BasketLine[] {
  const existing = lines.find((l) => l.variantId === add.variantId)
  if (!existing) {
    return [...lines, { ...add, quantity: 1 }]
  }
  return setQuantity(lines, add.variantId, existing.quantity + 1)
}

export function setQuantity(lines: BasketLine[], variantId: string, quantity: number): BasketLine[] {
  if (quantity < 1) {
    return lines.filter((l) => l.variantId !== variantId)
  }
  const capped = Math.min(quantity, MAX_LINE_QUANTITY)
  return lines.map((l) => (l.variantId === variantId ? { ...l, quantity: capped } : l))
}
