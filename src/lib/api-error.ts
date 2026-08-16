import type { FieldValues, Path, UseFormReturn } from 'react-hook-form'
import { toast } from 'sonner'

/** The one error response shape across every API — D3.4. Locked; safe to build against pre-API. */
export interface ApiFieldError {
  field: string
  message: string
}

export interface ApiError {
  code: string
  message: string
  traceId: string
  fieldErrors: ApiFieldError[]
}

export function isApiError(value: unknown): value is ApiError {
  if (typeof value !== 'object' || value === null) {
    return false
  }
  const candidate = value as Record<string, unknown>
  return (
    typeof candidate.code === 'string' &&
    typeof candidate.message === 'string' &&
    typeof candidate.traceId === 'string' &&
    Array.isArray(candidate.fieldErrors)
  )
}

/** Thrown by the generated API client for any non-2xx response — see `unwrap()` in `api/client.ts`. */
export class ApiClientError extends Error implements ApiError {
  readonly code: string
  readonly traceId: string
  readonly fieldErrors: ApiFieldError[]
  readonly status: number

  constructor(apiError: ApiError, status: number) {
    super(apiError.message)
    this.name = 'ApiClientError'
    this.code = apiError.code
    this.traceId = apiError.traceId
    this.fieldErrors = apiError.fieldErrors
    this.status = status
  }
}

/**
 * A response the server never got to answer — the request never reached it, or its answer
 * never reached us (offline, DNS failure, CORS rejection, the dev server not running). There
 * is no `code`/`traceId` from the server to report, so `X-Request-Id` was never assigned;
 * `traceId` is a client-only placeholder for display.
 */
export function networkError(cause: unknown): ApiClientError {
  const detail = cause instanceof Error ? cause.message : String(cause)
  return new ApiClientError(
    {
      code: 'NETWORK_ERROR',
      message: `Could not reach the server (${detail})`,
      traceId: 'client-only — request never reached the server',
      fieldErrors: [],
    },
    0
  )
}

/**
 * Applies an ApiError's fieldErrors to the matching react-hook-form fields. Any field error
 * that doesn't match a known field, plus the top-level message, surfaces as a toast — always
 * carrying the traceId, since that's what turns a support report into something actionable.
 */
export function applyApiErrorToForm<TFieldValues extends FieldValues>(
  error: ApiError,
  form: UseFormReturn<TFieldValues>
): void {
  const knownFields = new Set(Object.keys(form.getValues() as object))
  let unmatchedCount = 0

  for (const fieldError of error.fieldErrors) {
    if (knownFields.has(fieldError.field)) {
      form.setError(fieldError.field as Path<TFieldValues>, {
        type: 'server',
        message: fieldError.message,
      })
    } else {
      unmatchedCount += 1
    }
  }

  const shouldToast = error.fieldErrors.length === 0 || unmatchedCount > 0
  if (shouldToast) {
    toast.error(error.message, {
      description: `Trace ID: ${error.traceId}`,
    })
  }
}

/**
 * For mutations with no form to attach field errors to — transitions, reorder, move. The
 * server's message is already a full sentence built for an operator to act on (see
 * `BusinessRuleException` on the OMS side), so it goes straight to the toast alongside the
 * traceId that makes a support report actionable.
 */
export function toastApiError(error: unknown): void {
  if (isApiError(error)) {
    toast.error(error.message, { description: `Trace ID: ${error.traceId}` })
    return
  }
  toast.error(error instanceof Error ? error.message : 'Something went wrong')
}
