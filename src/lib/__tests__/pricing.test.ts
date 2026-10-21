import { describe, expect, it } from 'vitest'

import { formatMoney } from '@/lib/money'
import {
  bitsOptionHint,
  bitsRequest,
  localInputToInstant,
  priceAboveBase,
  pricesRequest,
  pricingActions,
  tierPriceHint,
} from '@/lib/pricing'

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

describe('Bits option helpers', () => {
  it('works out what a tier pays from the draft, falling back to base', () => {
    expect(tierPriceHint('MEMBER', { MEMBER: 74900 }, 79900)).toBe(74900)
    expect(tierPriceHint('MEMBER', {}, 79900)).toBe(79900)
    expect(tierPriceHint('LOWEST', { MEMBER: 74900, LOWEST: 69900 }, 79900)).toBe(69900)
    expect(tierPriceHint('LOWEST', { MEMBER: 64900, LOWEST: 69900 }, 79900)).toBe(64900)
    expect(tierPriceHint('LOWEST', {}, 79900)).toBe(79900)
  })

  it('refuses nothing for an empty option, and names each rule it would break', () => {
    expect(bitsOptionHint({ points: null, priceMinor: null }, 79900)).toBeUndefined()
    expect(bitsOptionHint({ points: 80, priceMinor: 74900 }, 79900)).toBeUndefined()
    expect(bitsOptionHint({ points: 80, priceMinor: null }, 79900)).toMatch(/both/)
    expect(bitsOptionHint({ points: 0, priceMinor: 74900 }, 79900)).toMatch(/more than 0/)
    expect(bitsOptionHint({ points: 80, priceMinor: 99 }, 79900)).toMatch(/at least ₹1/)
    expect(bitsOptionHint({ points: 80, priceMinor: 79900 }, 79900)).toMatch(
      /below what this tier pays/
    )
    expect(bitsOptionHint({ points: 80, priceMinor: 80000 }, 79900)).toMatch(/below/)
  })

  it('omits an empty tier from the replace-all body so the server clears it', () => {
    expect(
      bitsRequest(
        [
          { tierCode: 'SPROUT', option: { points: 80, priceMinor: 74900 } },
          { tierCode: 'ACTIVE', option: { points: null, priceMinor: null } },
        ],
        'INR'
      )
    ).toEqual([
      { tierCode: 'SPROUT', pointsAmount: 80, price: { amountMinor: 74900, currency: 'INR' } },
    ])
    expect(bitsRequest([], 'INR')).toEqual([])
  })

  it('has no body while a tier is half-set', () => {
    expect(
      bitsRequest([{ tierCode: 'SPROUT', option: { points: 80, priceMinor: null } }], 'INR')
    ).toBeNull()
  })
})
