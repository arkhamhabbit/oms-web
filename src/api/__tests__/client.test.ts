import { describe, expect, it } from 'vitest'

import { unwrap } from '@/api/client'
import { ApiClientError } from '@/lib/api-error'

function jsonResponse(status: number, headers: Record<string, string> = {}) {
  return new Response(null, { status, headers })
}

describe('unwrap', () => {
  it('returns the data when the result carries no error', async () => {
    const data = await unwrap(
      Promise.resolve({ data: { name: 'Habbit' }, error: undefined, response: jsonResponse(200) })
    )
    expect(data).toEqual({ name: 'Habbit' })
  })

  it('resolves to undefined for a 204-style response with no data', async () => {
    const data = await unwrap(
      Promise.resolve({ data: undefined, error: undefined, response: jsonResponse(204) })
    )
    expect(data).toBeUndefined()
  })

  it('throws an ApiClientError built from the shared error shape on a server error', async () => {
    await expect(
      unwrap(
        Promise.resolve({
          data: undefined,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid request',
            traceId: 'trace-abc',
            fieldErrors: [{ field: 'email', message: 'Required' }],
          },
          response: jsonResponse(400),
        })
      )
    ).rejects.toMatchObject({
      status: 400,
      code: 'VALIDATION_ERROR',
      message: 'Invalid request',
      traceId: 'trace-abc',
      fieldErrors: [{ field: 'email', message: 'Required' }],
    })
  })

  it('falls back to the X-Request-Id header when the error body has no traceId', async () => {
    let caught: unknown
    try {
      await unwrap(
        Promise.resolve({
          data: undefined,
          error: { code: 'INTERNAL_ERROR', message: 'Boom' },
          response: jsonResponse(500, { 'X-Request-Id': 'req-xyz' }),
        })
      )
    } catch (error) {
      caught = error
    }
    expect(caught).toBeInstanceOf(ApiClientError)
    expect((caught as ApiClientError).traceId).toBe('req-xyz')
  })

  it('turns a rejected fetch (network failure) into an ApiClientError with status 0', async () => {
    let caught: unknown
    try {
      await unwrap(Promise.reject(new TypeError('Failed to fetch')))
    } catch (error) {
      caught = error
    }
    expect(caught).toBeInstanceOf(ApiClientError)
    expect((caught as ApiClientError).status).toBe(0)
    expect((caught as ApiClientError).code).toBe('NETWORK_ERROR')
  })
})
