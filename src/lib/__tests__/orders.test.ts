import { describe, expect, it } from 'vitest'

import { actionsFor, istDayStart, isUuid } from '../orders'

describe('orders lib', () => {
  it('offers the next step and the way out for each status', () => {
    expect(actionsFor('CONFIRMED')).toEqual(['pack', 'cancel'])
    expect(actionsFor('PACKED')).toEqual(['ship', 'cancel'])
    expect(actionsFor('SHIPPED')).toEqual(['out-for-delivery', 'refund'])
    expect(actionsFor('OUT_FOR_DELIVERY')).toEqual(['deliver', 'refund'])
    expect(actionsFor('DELIVERED')).toEqual(['refund'])
    expect(actionsFor('PENDING_PAYMENT')).toEqual(['cancel'])
  })

  it('offers nothing on a finished order', () => {
    for (const status of ['CANCELLED', 'REFUNDED', 'EXPIRED', 'PAYMENT_FAILED'] as const) {
      expect(actionsFor(status)).toEqual([])
    }
    expect(actionsFor(undefined)).toEqual([])
  })

  it('turns a typed date into the IST day boundary', () => {
    expect(istDayStart('2026-10-24')).toBe('2026-10-23T18:30:00.000Z')
    expect(istDayStart('2026-10-24', 1)).toBe('2026-10-24T18:30:00.000Z')
    expect(istDayStart('24/10/2026')).toBeUndefined()
    expect(istDayStart('')).toBeUndefined()
  })

  it('recognises a uuid', () => {
    expect(isUuid('3f2b8c1e-5d4a-4e6f-9a1b-0c2d3e4f5a6b')).toBe(true)
    expect(isUuid('HBT_10000001')).toBe(false)
  })
})
