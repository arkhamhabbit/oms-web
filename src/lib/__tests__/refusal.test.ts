import { describe, expect, it } from 'vitest'

import { ApiClientError } from '@/lib/api-error'
import { fieldMessage, generalMessage, toRefusal, unplacedFieldMessages } from '@/lib/refusal'

const fieldError = new ApiClientError(
  {
    code: 'VALIDATION_FAILED',
    message: 'Invalid request',
    traceId: 't1',
    fieldErrors: [
      { field: 'quantity', message: 'must not be zero' },
      { field: 'lines[0].quantityOrdered', message: 'must be at least 1' },
    ],
  },
  400
)

const rule = new ApiClientError(
  {
    code: 'BUSINESS_RULE_VIOLATION',
    message: 'Cannot remove 10: only 3 on hand.',
    traceId: 't2',
    fieldErrors: [],
  },
  422
)

describe('refusals', () => {
  it('keeps the whole server error so each control can pick its own field', () => {
    const refusal = toRefusal(fieldError)
    expect(fieldMessage(refusal, 'quantity')).toBe('must not be zero')
    expect(fieldMessage(refusal, 'note')).toBeUndefined()
    expect(generalMessage(refusal)).toBeUndefined()
    expect(unplacedFieldMessages(refusal, ['quantity'])).toEqual([
      'lines[0].quantityOrdered: must be at least 1',
    ])
  })

  it('treats a field-less rule as the general sentence', () => {
    expect(generalMessage(toRefusal(rule))).toBe('Cannot remove 10: only 3 on hand.')
  })

  it('words a stale version by code, not by the server message', () => {
    const stale = new ApiClientError(
      { code: 'VERSION_CONFLICT', message: 'whatever', traceId: 't3', fieldErrors: [] },
      409
    )
    expect(toRefusal(stale, 'This warehouse').message).toBe(
      'This warehouse was changed by someone else — reload to see the latest, then try again.'
    )
  })

  it('wraps anything else in a sentence', () => {
    expect(toRefusal(new Error('boom')).message).toBe('boom')
    expect(toRefusal('x').message).toBe('Something went wrong')
  })
})
