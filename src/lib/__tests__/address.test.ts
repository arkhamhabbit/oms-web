import { describe, expect, it } from 'vitest'

import { addressLine, lacksPlace } from '@/lib/address'

describe('addressLine', () => {
  it('reads line, landmark, city, state and pincode', () => {
    expect(
      addressLine({
        line1: '12 Test Street',
        landmark: 'Near the park',
        city: 'North West Delhi',
        state: 'Delhi',
        pincode: '110009',
      })
    ).toBe('12 Test Street, Near the park, North West Delhi, Delhi 110009')
  })

  it('leaves out what is not served and never guesses', () => {
    expect(addressLine({ line1: '12 Test Street', landmark: null, city: null, state: null, pincode: '110009' })).toBe(
      '12 Test Street 110009'
    )
    expect(addressLine({ line1: '12 Test Street', city: 'Delhi', pincode: '110009' })).toBe(
      '12 Test Street, Delhi 110009'
    )
  })

  it('knows an address with neither city nor state', () => {
    expect(lacksPlace({ city: null, state: undefined })).toBe(true)
    expect(lacksPlace({ city: ' ', state: '' })).toBe(true)
    expect(lacksPlace({ city: 'Delhi', state: null })).toBe(false)
  })
})
