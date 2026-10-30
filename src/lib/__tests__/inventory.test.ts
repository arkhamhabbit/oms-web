import { describe, expect, it } from 'vitest'

import {
  batchLabel,
  formatSigned,
  optionalText,
  positiveInt,
  quantitySignFor,
  signedQuantity,
  summariseAvailability,
  todayIst,
} from '@/lib/inventory'
import { formatDate } from '@/lib/dates'

describe('signedQuantity', () => {
  it('makes the type fix the sign for receipts, returns, damage and write-offs', () => {
    expect(signedQuantity('RECEIPT', '4')).toBe(4)
    expect(signedQuantity('RECEIPT', '-4')).toBe(4)
    expect(signedQuantity('RETURN', '2')).toBe(2)
    expect(signedQuantity('DAMAGE', '1')).toBe(-1)
    expect(signedQuantity('DAMAGE', '-1')).toBe(-1)
    expect(signedQuantity('EXPIRY_WRITE_OFF', '3')).toBe(-3)
  })

  it('takes an adjustment as typed, either way', () => {
    expect(signedQuantity('ADJUSTMENT', '-10')).toBe(-10)
    expect(signedQuantity('ADJUSTMENT', '+3')).toBe(3)
    expect(signedQuantity('ADJUSTMENT', '3')).toBe(3)
  })

  it('refuses zero, blanks and anything that is not a whole number', () => {
    for (const bad of ['', ' ', '0', '-0', '1.5', 'abc', '1e3', '--1']) {
      expect(signedQuantity('ADJUSTMENT', bad)).toBeNull()
    }
  })

  it('says which sign a type allows', () => {
    expect(quantitySignFor('RECEIPT')).toBe('positive')
    expect(quantitySignFor('DAMAGE')).toBe('negative')
    expect(quantitySignFor('ADJUSTMENT')).toBe('either')
  })
})

describe('positiveInt', () => {
  it('accepts whole numbers above zero only', () => {
    expect(positiveInt('2')).toBe(2)
    expect(positiveInt(' 7 ')).toBe(7)
    expect(positiveInt('0')).toBeNull()
    expect(positiveInt('-2')).toBeNull()
    expect(positiveInt('')).toBeNull()
  })
})

describe('formatting', () => {
  it('shows a true minus sign in the ledger', () => {
    expect(formatSigned(4)).toBe('+4')
    expect(formatSigned(-1)).toBe('−1')
    expect(formatSigned(0)).toBe('0')
    expect(formatSigned(undefined)).toBe('')
  })

  it('shows a calendar date without a timezone shift', () => {
    expect(formatDate('2027-06-30')).toBe('30 Jun 2027')
    expect(formatDate(undefined)).toBe('')
  })

  it('names a batch with its expiry and flags an expired one', () => {
    expect(batchLabel({ batchNumber: 'B1' })).toBe('B1')
    expect(batchLabel({ batchNumber: 'B1', expiresOn: '2027-06-30' })).toBe(
      'B1 · expires 30 Jun 2027'
    )
    expect(batchLabel({ batchNumber: 'B1', expired: true })).toBe('B1 (expired)')
  })

  it('reads today in the operators’ calendar, not UTC', () => {
    // 20:00 UTC on the 29th is already 01:30 IST on the 30th.
    expect(todayIst(new Date('2026-10-29T20:00:00Z'))).toBe('2026-10-30')
    expect(todayIst(new Date('2026-10-29T10:00:00Z'))).toBe('2026-10-29')
  })

  it('drops blank optional text so it is left off the wire', () => {
    expect(optionalText('  ')).toBeUndefined()
    expect(optionalText(undefined)).toBeUndefined()
    expect(optionalText(' x ')).toBe('x')
  })
})

describe('summariseAvailability', () => {
  it('reads the eight action codes as applied / deferred / in sync', () => {
    const summary = summariseAvailability({
      variantsChecked: 6,
      changed: [
        { action: 'CORRECTED_DOWN' },
        { action: 'POPULATED' },
        { action: 'UPWARD_DEFERRED' },
        { action: 'CHANGED_DURING_CHECK' },
      ],
    })
    expect(summary).toEqual({
      checked: 6,
      applied: 2,
      deferred: 1,
      changedDuringCheck: 1,
      inSync: 2,
    })
  })

  it('handles a run that found nothing to do', () => {
    expect(summariseAvailability({ variantsChecked: 0, changed: [] })).toMatchObject({
      checked: 0,
      applied: 0,
      deferred: 0,
      inSync: 0,
    })
  })
})
