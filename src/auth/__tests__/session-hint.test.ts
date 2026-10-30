import { beforeEach, describe, expect, it } from 'vitest'

import {
  clearExpiredNotice,
  hasSessionHint,
  markSessionEnded,
  markSignedIn,
  markSignedOut,
  sessionExpiredNoticeShown,
  SESSION_EXPIRED_NOTICE,
} from '@/auth/session-hint'

beforeEach(() => {
  window.localStorage.clear()
})

describe('session hint', () => {
  it('words the expiry notice as the spec asks', () => {
    expect(SESSION_EXPIRED_NOTICE).toBe('Your session expired - sign in again')
  })

  it('knows nothing about a visitor who never signed in, so no probe and no notice', () => {
    expect(hasSessionHint()).toBe(false)
    markSessionEnded() // a 401 for a browser that had no session explains nothing
    expect(sessionExpiredNoticeShown()).toBe(false)
  })

  it('turns a session that ends into an expiry notice, cleared by the next login', () => {
    markSignedIn()
    expect(hasSessionHint()).toBe(true)

    markSessionEnded()
    expect(hasSessionHint()).toBe(false)
    expect(sessionExpiredNoticeShown()).toBe(true)

    clearExpiredNotice()
    expect(sessionExpiredNoticeShown()).toBe(false)
  })

  it('says nothing after a deliberate sign-out', () => {
    markSignedIn()
    markSessionEnded()
    markSignedOut()
    expect(hasSessionHint()).toBe(false)
    expect(sessionExpiredNoticeShown()).toBe(false)
  })
})
