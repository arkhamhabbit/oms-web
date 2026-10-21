import { describe, expect, it } from 'vitest'

import {
  blankTierDraft,
  draftsToRequest,
  maintainHint,
  membershipActions,
  parseWholeNumber,
  tierToDraft,
} from '@/lib/membership'

describe('membership helpers', () => {
  it('allows editing/publishing only a draft and withdrawing only a scheduled version', () => {
    expect(membershipActions('DRAFT')).toEqual({
      editable: true,
      publishable: true,
      withdrawable: false,
    })
    expect(membershipActions('SCHEDULED')).toEqual({
      editable: false,
      publishable: false,
      withdrawable: true,
    })
    expect(membershipActions('EFFECTIVE').editable).toBe(false)
    expect(membershipActions(undefined).publishable).toBe(false)
  })

  describe('maintainHint', () => {
    it('wants the first tier at 0', () => {
      expect(maintainHint(0, 0, 0)).toBeUndefined()
      expect(maintainHint(0, 5, 0)).toMatch(/nothing to drop to/)
    })

    it('wants every other tier strictly between 0 and its reach', () => {
      expect(maintainHint(1, 9000, 18000)).toBeUndefined()
      expect(maintainHint(1, 0, 18000)).toMatch(/more than 0/)
      expect(maintainHint(1, 18000, 18000)).toMatch(/below the reach threshold \(18,000\)/)
      expect(maintainHint(1, 20000, 18000)).toMatch(/below the reach/)
    })

    it('says nothing while the field is empty, and does not judge against an empty reach', () => {
      expect(maintainHint(1, null, 18000)).toBeUndefined()
      expect(maintainHint(1, 5, null)).toBeUndefined()
    })
  })

  describe('parseWholeNumber', () => {
    it('accepts plain digits, with or without grouping commas', () => {
      expect(parseWholeNumber('0')).toBe(0)
      expect(parseWholeNumber(' 18,000 ')).toBe(18000)
    })

    it('rejects empty, negative, fractional and exponent input', () => {
      for (const bad of ['', '-1', '12.5', '1e3', 'abc']) {
        expect(parseWholeNumber(bad)).toBeNull()
      }
    })
  })

  describe('draftsToRequest', () => {
    const tier = (over = {}) => ({
      ...tierToDraft({
        code: 'ACTIVE',
        name: 'Active',
        thresholdPoints12mo: 18000,
        maintainThresholdPoints: 9000,
        carrotsPerFriendOrderMinor: 2500,
        pricingLevel: 'MEMBER',
        freeShipping: false,
        activeInviteLimit: 3,
      }),
      ...over,
    })

    it('carries both new fields through, Carrots in paise', () => {
      expect(draftsToRequest([tier()])).toEqual([
        {
          code: 'ACTIVE',
          name: 'Active',
          thresholdPoints12mo: 18000,
          maintainThresholdPoints: 9000,
          carrotsPerFriendOrderMinor: 2500,
          pricingLevel: 'MEMBER',
          freeShipping: false,
          activeInviteLimit: 3,
        },
      ])
    })

    it('is null while any numeric field is empty', () => {
      expect(draftsToRequest([tier({ maintainThresholdPoints: null })])).toBeNull()
      expect(draftsToRequest([tier({ carrotsPerFriendOrderMinor: null })])).toBeNull()
      expect(draftsToRequest([blankTierDraft()])).toBeNull()
    })
  })
})
