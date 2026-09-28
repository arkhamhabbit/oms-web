import { describe, expect, it } from 'vitest'

import {
  ALLOWED_UNITS,
  applyKindConstraint,
  hasValues,
  isKindConstraintLocked,
  unitApplies,
} from '@/lib/attribute-rules'

describe('applyKindConstraint', () => {
  it('forces SINGLE_SELECT + VARIANT when kind is OPTION, regardless of current picks', () => {
    expect(applyKindConstraint('OPTION', { dataType: 'TEXT', appliesTo: 'PRODUCT' })).toEqual({
      dataType: 'SINGLE_SELECT',
      appliesTo: 'VARIANT',
    })
  })

  it('leaves the current picks untouched when kind is SPEC', () => {
    expect(applyKindConstraint('SPEC', { dataType: 'NUMBER', appliesTo: 'PRODUCT' })).toEqual({
      dataType: 'NUMBER',
      appliesTo: 'PRODUCT',
    })
  })

  it('is idempotent — reapplying to an already-forced OPTION attribute is a no-op', () => {
    const forced = applyKindConstraint('OPTION', { dataType: 'TEXT', appliesTo: 'PRODUCT' })
    expect(applyKindConstraint('OPTION', forced)).toEqual(forced)
  })
})

describe('isKindConstraintLocked', () => {
  it('locks for OPTION, not for SPEC', () => {
    expect(isKindConstraintLocked('OPTION')).toBe(true)
    expect(isKindConstraintLocked('SPEC')).toBe(false)
  })
})

describe('unitApplies', () => {
  it('is true only for NUMBER', () => {
    expect(unitApplies('NUMBER')).toBe(true)
    for (const dataType of ['TEXT', 'BOOLEAN', 'SINGLE_SELECT', 'MULTI_SELECT'] as const) {
      expect(unitApplies(dataType)).toBe(false)
    }
  })
})

describe('hasValues', () => {
  it('is true only for SINGLE_SELECT and MULTI_SELECT', () => {
    expect(hasValues('SINGLE_SELECT')).toBe(true)
    expect(hasValues('MULTI_SELECT')).toBe(true)
    expect(hasValues('TEXT')).toBe(false)
    expect(hasValues('NUMBER')).toBe(false)
    expect(hasValues('BOOLEAN')).toBe(false)
  })
})

describe('ALLOWED_UNITS', () => {
  it('matches the closed set locked in D4.10', () => {
    expect(ALLOWED_UNITS).toEqual([
      'g',
      'mg',
      'kg',
      'ml',
      'l',
      'kcal',
      'iu',
      'mcg',
      'servings',
      'days',
      'pieces',
    ])
  })
})
