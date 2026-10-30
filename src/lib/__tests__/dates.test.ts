import { describe, expect, it } from 'vitest'

import { formatDate, formatDateTime } from '@/lib/dates'

describe('formatDateTime', () => {
  it('shows an instant in IST, 24-hour, en-IN style', () => {
    // 08:35 UTC is 14:05 in Asia/Kolkata (UTC+5:30)
    expect(formatDateTime('2026-10-29T08:35:00Z')).toBe('29 Oct 2026, 14:05')
  })

  it('rolls over to the next IST day', () => {
    expect(formatDateTime('2026-12-31T20:00:00Z')).toBe('1 Jan 2027, 01:30')
  })

  it('writes midnight as 00, never 24', () => {
    expect(formatDateTime('2026-10-29T18:30:00Z')).toBe('30 Oct 2026, 00:00')
  })

  it('does not depend on the offset the server used', () => {
    expect(formatDateTime('2026-10-29T14:05:00+05:30')).toBe('29 Oct 2026, 14:05')
  })

  it('is empty for nothing and leaves an unreadable value as it came', () => {
    expect(formatDateTime(undefined)).toBe('')
    expect(formatDateTime(null)).toBe('')
    expect(formatDateTime('')).toBe('')
    expect(formatDateTime('not a date')).toBe('not a date')
  })
})

describe('formatDate', () => {
  it('shows a plain calendar date as it is, with no timezone shift', () => {
    expect(formatDate('2027-06-30')).toBe('30 Jun 2027')
    expect(formatDate('2027-01-01')).toBe('1 Jan 2027')
  })

  it('shows an instant as its IST calendar day', () => {
    expect(formatDate('2026-10-29T20:00:00Z')).toBe('30 Oct 2026')
  })

  it('is empty for nothing', () => {
    expect(formatDate(undefined)).toBe('')
  })
})
