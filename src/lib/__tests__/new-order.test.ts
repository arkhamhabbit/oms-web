import { describe, expect, it } from 'vitest'

import type { AdminQuote } from '@/api/orders'
import {
  addToBasket,
  buildQuoteRequest,
  deliveryProblems,
  EMPTY_DELIVERY,
  MAX_LINE_QUANTITY,
  setQuantity,
  type BasketLine,
  type DeliveryDraft,
} from '@/lib/new-order'
import { normaliseMobile, placeRefusals } from '@/lib/orders'

const TEE = { variantId: 'v-1', productName: 'Test Public Tee', variantName: 'M', skuCode: 'TEE-M' }
const BOOK: DeliveryDraft = { ...EMPTY_DELIVERY, addressId: 'a-1' }

describe('basket', () => {
  it('adds a variant once and a second add raises its quantity', () => {
    const one = addToBasket([], TEE)
    expect(one).toEqual([{ ...TEE, quantity: 1 }])
    expect(addToBasket(one, TEE)[0].quantity).toBe(2)
  })

  it('removes a line at zero and caps a quantity', () => {
    const lines: BasketLine[] = [{ ...TEE, quantity: 2 }]
    expect(setQuantity(lines, 'v-1', 0)).toEqual([])
    expect(setQuantity(lines, 'v-1', 1000)[0].quantity).toBe(MAX_LINE_QUANTITY)
  })
})

describe('quote request', () => {
  const lines: BasketLine[] = [{ ...TEE, quantity: 2 }]

  it('waits for a member, a basket and a delivery', () => {
    expect(buildQuoteRequest(undefined, lines, BOOK)).toBeUndefined()
    expect(buildQuoteRequest('m-1', [], BOOK)).toBeUndefined()
    expect(buildQuoteRequest('m-1', lines, EMPTY_DELIVERY)).toBeUndefined()
  })

  it('carries ids, quantities and the address, and nothing that is a price', () => {
    const request = buildQuoteRequest('m-1', lines, BOOK)
    expect(request).toEqual({
      memberId: 'm-1',
      lines: [{ variantId: 'v-1', quantity: 2 }],
      addressId: 'a-1',
      deliveryMobile: undefined,
    })
    expect(JSON.stringify(request)).not.toMatch(/price|discount|shipping|amount|total/i)
  })

  it('sends a typed address instead of an address id, and normalises the delivery mobile', () => {
    const typed: DeliveryDraft = {
      mode: 'typed',
      addressId: 'a-1',
      typed: { label: ' Office ', line1: ' 2 Test Street ', landmark: '', pincode: '110009' },
      mobile: '098765 43210',
    }
    expect(buildQuoteRequest('m-1', lines, typed)).toEqual({
      memberId: 'm-1',
      lines: [{ variantId: 'v-1', quantity: 2 }],
      deliveryMobile: '+919876543210',
      address: { label: 'Office', line1: '2 Test Street', landmark: undefined, pincode: '110009' },
    })
  })

  it('names what is wrong with the delivery', () => {
    expect(deliveryProblems(EMPTY_DELIVERY).address).toBeDefined()
    const typed: DeliveryDraft = { ...EMPTY_DELIVERY, mode: 'typed' }
    expect(deliveryProblems(typed)).toMatchObject({
      line1: expect.any(String),
      pincode: 'A pincode is six digits.',
    })
    expect(deliveryProblems({ ...BOOK, mobile: '12345' }).mobile).toBeDefined()
    expect(deliveryProblems({ ...BOOK, mobile: '+91 98765 43210' })).toEqual({})
  })
})

describe('normaliseMobile', () => {
  it('accepts ten digits starting 6-9 with an optional prefix', () => {
    expect(normaliseMobile('9876543210')).toBe('+919876543210')
    expect(normaliseMobile('+91-98765-43210')).toBe('+919876543210')
    expect(normaliseMobile('919876543210')).toBe('+919876543210')
    expect(normaliseMobile('1234567890')).toBeUndefined()
    expect(normaliseMobile('98765')).toBeUndefined()
  })
})

describe('placeRefusals', () => {
  const quote: AdminQuote = {
    lines: [{ variantId: 'v-1', productName: 'Test Public Tee', variantName: 'M', skuCode: 'TEE-M' }],
    refusals: [
      'Test Public Tee is out of stock.',
      'TEE-M is not available to this member’s tier.',
      'The member is on the waitlist.',
    ],
  }

  it('places a sentence that names a line beside that line, and only by whole words', () => {
    const placed = placeRefusals(quote)
    expect(placed.byVariant.get('v-1')).toEqual([
      'Test Public Tee is out of stock.',
      'TEE-M is not available to this member’s tier.',
    ])
    // "M" the variant name is not found inside "member" or "waitlist".
    expect(placed.general).toEqual(['The member is on the waitlist.'])
  })
})
