import { describe, expect, it } from 'vitest'

import { summarizeIntakePayload } from '../intake-summary'

describe('summarizeIntakePayload', () => {
  it('summarises each kind', () => {
    expect(summarizeIntakePayload('NAME', { name: 'Asha' })).toBe('Asha')
    expect(summarizeIntakePayload('EMAIL', { email: 'a@b.co' })).toBe('a@b.co')
    expect(
      summarizeIntakePayload('ADDRESS_UPSERT', {
        label: 'Home',
        line1: '12 MG Road',
        pincode: '560001',
      })
    ).toBe('Home · 12 MG Road · 560001')
    expect(
      summarizeIntakePayload('ADDRESS_DELETE', {
        addressId: '0190aaaa-bbbb-cccc-dddd-eeeeffff0000',
      })
    ).toBe('An address that is no longer on record')
  })

  it('names a deleted address by its label, never by its id', () => {
    const payload = { addressId: '0190aaaa-bbbb-cccc-dddd-eeeeffff0000' }
    expect(
      summarizeIntakePayload('ADDRESS_DELETE', payload, {
        addressId: payload.addressId,
        label: 'Home',
        line1: '12 MG Road',
        pincode: '560001',
        deleted: true,
      })
    ).toBe('Home · 12 MG Road')
    expect(
      summarizeIntakePayload('ADDRESS_DELETE', payload, {
        addressId: payload.addressId,
        label: null,
        line1: '12 MG Road',
        deleted: true,
      })
    ).toBe('12 MG Road')
  })

  it('tolerates a missing or malformed payload', () => {
    expect(summarizeIntakePayload('NAME', undefined)).toBe('—')
    expect(summarizeIntakePayload('ADDRESS_UPSERT', { line1: 5 })).toBe('—')
  })
})
