/**
 * What this browser remembers about the admin session, so the console can behave without
 * asking the server. The session itself is an httpOnly cookie JavaScript cannot read; this is
 * only a hint, never proof, and the server stays the authority.
 *
 * - `signedIn`: a login or a profile read succeeded here. Without it the login, reset and
 *   accept-invite pages skip the `/api/admin/profile` probe, so a logged-out visitor does not
 *   get a 401 in the console for a question whose answer is already known.
 * - `expired`: a request returned 401 while `signedIn` was set, so the next login page says
 *   why the admin is there. Cleared by the next login.
 *
 * Storage can be unavailable (private window, blocked site data); every access is wrapped and
 * the console works the same without it, minus the hint.
 */
const SIGNED_IN_KEY = 'oms.session.signedIn'
const EXPIRED_KEY = 'oms.session.expired'

function read(key: string): boolean {
  try {
    return window.localStorage.getItem(key) === '1'
  } catch {
    return false
  }
}

function write(key: string, on: boolean): void {
  try {
    if (on) {
      window.localStorage.setItem(key, '1')
    } else {
      window.localStorage.removeItem(key)
    }
  } catch {
    // Hint only; nothing depends on it being stored.
  }
}

export const SESSION_EXPIRED_NOTICE = 'Your session expired - sign in again'

export function hasSessionHint(): boolean {
  return read(SIGNED_IN_KEY)
}

export function sessionExpiredNoticeShown(): boolean {
  return read(EXPIRED_KEY)
}

export function markSignedIn(): void {
  write(SIGNED_IN_KEY, true)
}

/** The admin signed out on purpose: forget the session, with no expiry notice. */
export function markSignedOut(): void {
  write(SIGNED_IN_KEY, false)
  write(EXPIRED_KEY, false)
}

/** A request came back 401. Only a session this browser knew about "expired"; otherwise nothing to explain. */
export function markSessionEnded(): void {
  if (hasSessionHint()) {
    write(EXPIRED_KEY, true)
  }
  write(SIGNED_IN_KEY, false)
}

/** The next login clears the notice. */
export function clearExpiredNotice(): void {
  write(EXPIRED_KEY, false)
}
