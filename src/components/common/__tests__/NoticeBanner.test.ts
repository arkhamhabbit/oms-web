import { describe, expect, it } from 'vitest'

import { noticeFromError } from '@/components/common/NoticeBanner'
import { ApiClientError } from '@/lib/api-error'

describe('noticeFromError', () => {
  it('keeps the field failure line and names each field by label, not glued to it', () => {
    const error = new ApiClientError(
      {
        code: 'VALIDATION_FAILED',
        message: 'Some fields are not valid. Correct them and retry.',
        traceId: 't1',
        fieldErrors: [{ field: 'paymentTimeoutMinutes', message: 'Must be at most 15.' }],
      },
      400
    )
    const notice = noticeFromError(error, 'These settings', {
      paymentTimeoutMinutes: 'Payment timeout',
    })
    expect(notice.text).toBe(
      'Some fields are not valid. Correct them and retry. Payment timeout: Must be at most 15.'
    )
    expect(notice.traceId).toBe('t1')
  })

  it('shows a refusal that names no field as it is, with its Trace ID', () => {
    const error = new ApiClientError(
      { code: 'BUSINESS_RULE_VIOLATION', message: 'Not now.', traceId: 't2', fieldErrors: [] },
      422
    )
    expect(noticeFromError(error, 'This').text).toBe('Not now.')
  })
})
