import { describe, expect, it } from 'vitest'

import { PRODUCT_AUDIENCES } from '@/api/enums.gen'
import {
  ATTRIBUTE_DATA_TYPE_LABEL,
  CATALOG_STATUS_LABEL,
  domainLabel,
  labelOf,
  MOVEMENT_TYPE_LABEL,
  ORDER_STATUS_LABEL,
  PAYMENT_STATUS_LABEL,
  PO_STATUS_LABEL,
  PRODUCT_AUDIENCE_LABEL,
  REASON_CODE_LABEL,
  titleCaseCode,
  USER_STATUS_LABEL,
} from '@/lib/labels'

describe('labels', () => {
  it('title-cases a code that has no entry, so nothing reads as raw', () => {
    expect(titleCaseCode('IN_REVIEW')).toBe('In review')
    expect(titleCaseCode('stock_movement')).toBe('Stock movement')
    expect(labelOf(CATALOG_STATUS_LABEL, 'SOMETHING_NEW')).toBe('Something new')
    expect(labelOf(CATALOG_STATUS_LABEL, undefined)).toBe('')
  })

  it('labels the statuses the filters offered raw', () => {
    expect(USER_STATUS_LABEL.SUSPENDED).toBe('Suspended')
    expect(CATALOG_STATUS_LABEL.IN_REVIEW).toBe('In review')
    expect(ATTRIBUTE_DATA_TYPE_LABEL.SINGLE_SELECT).toBe('Single select')
    expect(PAYMENT_STATUS_LABEL.REFUND_PENDING).toBe('Refund pending')
    expect(PO_STATUS_LABEL.PARTIALLY_RECEIVED).toBe('Partially received')
    expect(ORDER_STATUS_LABEL.OUT_FOR_DELIVERY).toBe('Out for delivery')
    expect(MOVEMENT_TYPE_LABEL.EXPIRY_WRITE_OFF).toBe('Expiry write-off')
    expect(REASON_CODE_LABEL.DAMAGED_IN_TRANSIT).toBe('Damaged in transit')
  })

  it('has a human label for every audience the contract publishes', () => {
    for (const audience of PRODUCT_AUDIENCES) {
      expect(PRODUCT_AUDIENCE_LABEL[audience]).toBeTruthy()
      expect(PRODUCT_AUDIENCE_LABEL[audience]).not.toMatch(/_/)
    }
  })

  it('names the domain of an audit action', () => {
    expect(domainLabel('catalog.brand.created')).toBe('Catalog')
    expect(domainLabel('identity.user.suspended')).toBe('Users')
    expect(domainLabel('weird.thing')).toBe('Weird')
  })
})
