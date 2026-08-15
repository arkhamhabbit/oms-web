import { renderHook } from '@testing-library/react'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { ApiClientError, applyApiErrorToForm, networkError, type ApiError } from '@/lib/api-error'

vi.mock('sonner', () => ({
  toast: { error: vi.fn() },
}))

beforeEach(() => {
  vi.mocked(toast.error).mockClear()
})

interface TestFormValues {
  name: string
  sku: string
}

function setupForm() {
  const { result } = renderHook(() =>
    useForm<TestFormValues>({ defaultValues: { name: '', sku: '' } })
  )
  return result.current
}

describe('applyApiErrorToForm', () => {
  it('places a fieldErrors entry on the matching form field', () => {
    const form = setupForm()
    const error: ApiError = {
      code: 'VALIDATION_ERROR',
      message: 'Invalid request',
      traceId: 'trace-abc',
      fieldErrors: [{ field: 'sku', message: 'SKU already exists' }],
    }

    applyApiErrorToForm(error, form)

    expect(form.getFieldState('sku').error?.message).toBe('SKU already exists')
    expect(form.getFieldState('name').error).toBeUndefined()
  })

  it('falls back to a toast carrying the traceId when there are no field errors', () => {
    const form = setupForm()
    const error: ApiError = {
      code: 'INTERNAL_ERROR',
      message: 'Something went wrong',
      traceId: 'trace-xyz',
      fieldErrors: [],
    }

    applyApiErrorToForm(error, form)

    expect(toast.error).toHaveBeenCalledWith('Something went wrong', {
      description: 'Trace ID: trace-xyz',
    })
  })

  it('toasts with the traceId when a fieldError does not match any known field', () => {
    const form = setupForm()
    const error: ApiError = {
      code: 'VALIDATION_ERROR',
      message: 'Invalid request',
      traceId: 'trace-def',
      fieldErrors: [{ field: 'unknownField', message: 'Unexpected field' }],
    }

    applyApiErrorToForm(error, form)

    expect(toast.error).toHaveBeenCalledWith('Invalid request', {
      description: 'Trace ID: trace-def',
    })
  })

  it('does not toast when every fieldError matches a known field', () => {
    const form = setupForm()
    const error: ApiError = {
      code: 'VALIDATION_ERROR',
      message: 'Invalid request',
      traceId: 'trace-ghi',
      fieldErrors: [{ field: 'name', message: 'Required' }],
    }

    applyApiErrorToForm(error, form)

    expect(toast.error).not.toHaveBeenCalled()
  })
})

describe('ApiClientError', () => {
  it('carries the status code alongside the shared error shape', () => {
    const error = new ApiClientError(
      { code: 'ACCESS_DENIED', message: 'Nope', traceId: 'trace-1', fieldErrors: [] },
      403
    )

    expect(error.status).toBe(403)
    expect(error.code).toBe('ACCESS_DENIED')
    expect(error.message).toBe('Nope')
    expect(error.traceId).toBe('trace-1')
  })

  it('is itself a valid ApiError, so applyApiErrorToForm accepts it directly', () => {
    const form = setupForm()
    const error = new ApiClientError(
      {
        code: 'VALIDATION_ERROR',
        message: 'Invalid request',
        traceId: 'trace-2',
        fieldErrors: [{ field: 'sku', message: 'Required' }],
      },
      400
    )

    applyApiErrorToForm(error, form)

    expect(form.getFieldState('sku').error?.message).toBe('Required')
  })
})

describe('networkError', () => {
  it('builds a client-only ApiClientError with status 0 for a request that never reached the server', () => {
    const error = networkError(new TypeError('Failed to fetch'))

    expect(error.status).toBe(0)
    expect(error.code).toBe('NETWORK_ERROR')
    expect(error.message).toContain('Failed to fetch')
    expect(error.fieldErrors).toEqual([])
  })

  it('stringifies a non-Error cause', () => {
    const error = networkError('offline')
    expect(error.message).toContain('offline')
  })
})
