import createClient from 'openapi-fetch'

import type { components, paths } from '@/api/schema.gen'
import { queryClient } from '@/api/query-client'
import { ApiClientError, networkError } from '@/lib/api-error'

type ErrorBody = components['schemas']['ErrorResponse']

/**
 * Endpoints where a 401 is a normal, inline-handleable outcome — "that credential was
 * wrong" — rather than "the session died". Both take a credential as *input* and reject it
 * with `UnauthenticatedException` on the server (generic on purpose, so a bad password
 * can't be distinguished from an unknown email — see `AuthenticationService.login` /
 * `ProfileService.changePassword`), which is indistinguishable from a dead session by
 * status code alone. Without this list, submitting the wrong current password on the
 * change-password form would clear the cache and bounce the member out to `/login` — while
 * their session cookie, untouched by any of this, is still perfectly valid.
 */
const INLINE_401_PATHS = new Set(['/api/admin/auth/login', '/api/admin/profile/change-password'])

/**
 * Called on any 401 that isn't a login attempt gone wrong, so the app can react to "the
 * session died" from one place instead of every screen checking for it. Registered by
 * `router.tsx` right after the router is created — `client.ts` cannot import the router
 * module itself without a circular import (router -> pages -> api hooks -> client), so the
 * dependency runs the other way: the router registers into the client, not the reverse.
 * The handler is expected to no-op if already on `/login` (e.g. `LoginPage` itself probing
 * whether a session already exists) — that's the handler's job, not this module's.
 */
let unauthorizedHandler: (() => void) | undefined
export function onUnauthorized(handler: () => void): void {
  unauthorizedHandler = handler
}

/**
 * The one HTTP client OMS is called through (D2.15) — every request carries the session
 * cookie, every write carries the CSRF header, and every failure comes out the same shape
 * regardless of whether the server ever answered. Nothing else in this codebase is allowed
 * to call fetch()/axios directly (enforced by eslint.config.js).
 */
export const api = createClient<paths>({
  baseUrl: import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8080',
  // The session lives in an httpOnly cookie (D2.16) — this is what makes the browser send
  // it. There is no token to attach; JavaScript never has one to read.
  credentials: 'include',
  // openapi-fetch's default for an object-typed query param (e.g. `pageable`) is
  // `deepObject` style — `pageable[page]=0&pageable[size]=20`. Spring's `Pageable` resolver
  // binds flat `page`/`size`/`sort` params, not a bracketed object, so every list endpoint
  // would 400 without this override. Discovered on contact with a real OMS in W1.0 — every
  // list/search screen depends on it.
  querySerializer: { object: { style: 'form', explode: true } },
})

api.use({
  onRequest({ request }) {
    // D2.18 / the OMS 0.5 notes for the UI: every non-GET carries the CSRF header. GET is
    // exempt because it can already be triggered ambiently by a browser (an <img> tag), so
    // the header would protect nothing there.
    if (request.method !== 'GET') {
      request.headers.set('X-OMS-Csrf', '1')
    }
    return request
  },
  onResponse({ request, response }) {
    const isInline401 = INLINE_401_PATHS.has(new URL(request.url).pathname)
    if (response.status === 401 && !isInline401) {
      queryClient.clear()
      unauthorizedHandler?.()
    }
    return response
  },
})

/**
 * Awaits an openapi-fetch call and unwraps it into its data, or throws an `ApiClientError`
 * built from the shared error shape (D3.4) — the server never got to answer at all (offline,
 * CORS, dev server down) becomes the same exception type as a 4xx/5xx it did answer, so every
 * caller has exactly one error type to handle. `X-Request-Id` is exposed by CORS (see OMS
 * 0.5) and used as a fallback trace id — the server always sets one on the body too, but a
 * client that can't parse the body still has something to show in an error report.
 */
export async function unwrap<T>(
  resultPromise: Promise<{ data?: T; error?: ErrorBody; response: Response }>
): Promise<T> {
  let result: Awaited<typeof resultPromise>
  try {
    result = await resultPromise
  } catch (cause) {
    throw networkError(cause)
  }

  if (result.error !== undefined) {
    const requestId = result.response.headers.get('X-Request-Id') ?? undefined
    throw new ApiClientError(
      {
        code: result.error.code ?? 'UNKNOWN_ERROR',
        message: result.error.message ?? 'An unexpected error occurred',
        traceId: result.error.traceId ?? requestId ?? 'unknown',
        fieldErrors: (result.error.fieldErrors ?? []).map((fieldError) => ({
          field: fieldError.field ?? '',
          message: fieldError.message ?? '',
        })),
      },
      result.response.status
    )
  }
  return result.data as T
}
