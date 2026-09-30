import { describe, expect, it } from 'vitest'

import { formatMoney } from '@/lib/money'
import { localInputToInstant, priceAboveBase, pricesRequest, pricingActions } from '@/lib/pricing'

describe('pricing helpers', () => {
  it('flags a price above base, and only then', () => {
    expect(priceAboveBase(80000, 79900)).toBe(true)
    expect(priceAboveBase(79900, 79900)).toBe(false)
    expect(priceAboveBase(null, 79900)).toBe(false)
    expect(priceAboveBase(100, undefined)).toBe(false)
  })

  it('omits an empty level from the replace-all body so the server clears it', () => {
    expect(
      pricesRequest(
        [
          { level: 'MEMBER', amountMinor: null },
          { level: 'LOWEST', amountMinor: 69900 },
        ],
        'INR'
      )
    ).toEqual([{ level: 'LOWEST', price: { amountMinor: 69900, currency: 'INR' } }])
    expect(pricesRequest([{ level: 'MEMBER', amountMinor: null }], 'INR')).toEqual([])
  })

  it('allows editing/publishing only a draft and withdrawing only a scheduled version', () => {
    expect(pricingActions('DRAFT')).toEqual({
      editable: true,
      publishable: true,
      withdrawable: false,
    })
    expect(pricingActions('SCHEDULED')).toEqual({
      editable: false,
      publishable: false,
      withdrawable: true,
    })
    for (const state of ['EFFECTIVE', 'SUPERSEDED', 'WITHDRAWN'] as const) {
      expect(pricingActions(state)).toEqual({
        editable: false,
        publishable: false,
        withdrawable: false,
      })
    }
  })

  it('reads an empty publish time as "now" (omitted)', () => {
    expect(localInputToInstant('')).toBeUndefined()
    expect(localInputToInstant('not a date')).toBeUndefined()
    // The operator's own clock, whatever its offset (IST is +05:30, not a whole hour).
    expect(localInputToInstant('2026-10-05T09:30')).toBe(new Date(2026, 9, 5, 9, 30).toISOString())
  })

  it('formats wire money without floating point', () => {
    expect(formatMoney({ amountMinor: 79900, currency: 'INR' })).toBe('INR 799.00')
    expect(formatMoney(null)).toBe('—')
  })
})
