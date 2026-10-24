import { describe, expect, it } from 'vitest'

import { draftToRequest, earnActions, parseWholeNumber, rulesToDraft } from '../earn'

describe('earn lib', () => {
  it('parses whole numbers and keeps a minus so the server can refuse it', () => {
    expect(parseWholeNumber('500')).toBe(500)
    expect(parseWholeNumber('1,000')).toBe(1000)
    expect(parseWholeNumber('-5')).toBe(-5)
    expect(parseWholeNumber('')).toBeNull()
    expect(parseWholeNumber('1.5')).toBeNull()
    expect(parseWholeNumber('abc')).toBeNull()
  })

  it('builds a request only when every amount is present', () => {
    const draft = rulesToDraft({ welcomePoints: 500, welcomeCarrotsMinor: 10000 })
    expect(draftToRequest(draft)).toMatchObject({ welcomePoints: 500, welcomeCarrotsMinor: 10000 })
    expect(draftToRequest({ ...draft, firstOrderPoints: null })).toBeNull()
    expect(draftToRequest({ ...draft, orderPointsPer100Rupees: null })).toBeNull()
    expect(draftToRequest({ ...draft, orderCarrotsPer100RupeesMinor: null })).toBeNull()
  })

  it('carries the own-order rates into the request', () => {
    const draft = rulesToDraft({ orderPointsPer100Rupees: 10, orderCarrotsPer100RupeesMinor: 100 })
    expect(draftToRequest(draft)).toMatchObject({
      orderPointsPer100Rupees: 10,
      orderCarrotsPer100RupeesMinor: 100,
    })
  })

  it('allows edit and publish on a draft and withdraw on a scheduled version', () => {
    expect(earnActions('DRAFT')).toEqual({ editable: true, publishable: true, withdrawable: false })
    expect(earnActions('SCHEDULED').withdrawable).toBe(true)
    expect(earnActions('EFFECTIVE').editable).toBe(false)
  })
})
