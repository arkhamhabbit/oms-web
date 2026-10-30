import { describe, expect, it } from 'vitest'

import {
  CHANGE_PASSWORD_LABELS,
  describeFieldError,
  fieldLabel,
  humanizeField,
  MEMBERSHIP_VERSION_LABELS,
  ORDER_SETTINGS_LABELS,
} from '@/lib/field-labels'

describe('field labels', () => {
  it('spells out a camelCase name when no map names it', () => {
    expect(humanizeField('orderPointsPer100Rupees')).toBe('Order points per 100 rupees')
    expect(humanizeField('lines[0].quantityOrdered')).toBe('Lines 1 quantity ordered')
    expect(humanizeField('name')).toBe('Name')
  })

  it('prefers the form map', () => {
    expect(fieldLabel('paymentTimeoutMinutes', ORDER_SETTINGS_LABELS)).toBe('Payment timeout')
    expect(fieldLabel('newPassword', CHANGE_PASSWORD_LABELS)).toBe('New password')
  })

  it('finds the label for a row of a list and says which row', () => {
    expect(fieldLabel('tiers[1].name', MEMBERSHIP_VERSION_LABELS)).toBe('Tier name, row 2')
  })

  it('writes a field error as "Label: sentence"', () => {
    expect(
      describeFieldError(
        { field: 'newPassword', message: 'Must be at least 12 characters.' },
        CHANGE_PASSWORD_LABELS
      )
    ).toBe('New password: Must be at least 12 characters.')
    expect(describeFieldError({ field: '', message: 'Nothing named.' })).toBe('Nothing named.')
  })
})
