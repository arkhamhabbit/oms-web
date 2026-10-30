import { isApiError, isVersionConflict, type ApiError } from '@/lib/api-error'

/** A server refusal as a dialog holds it: the whole error, so each control can pick out its own field. */
export type Refusal = ApiError | { message: string; stale?: boolean; fieldErrors: [] }

const STALE_SENTENCE = 'was changed by someone else — reload to see the latest, then try again.'

/** Turns anything a failed mutation threw into a refusal a form can place. */
export function toRefusal(error: unknown, subject = 'This record'): Refusal {
  if (isVersionConflict(error) && isApiError(error)) {
    return { ...error, message: `${subject} ${STALE_SENTENCE}` }
  }
  if (isApiError(error)) {
    return error
  }
  return {
    message: error instanceof Error ? error.message : 'Something went wrong',
    fieldErrors: [],
  }
}

/** The server's message for one field (the request property name), if it named that field. */
export function fieldMessage(
  refusal: Refusal | undefined,
  ...fields: string[]
): string | undefined {
  return refusal?.fieldErrors.find((e) => fields.includes(e.field))?.message
}

/**
 * The sentence that belongs to no field: shown beside the control that caused it when the server
 * named a field, otherwise under the form. Returns undefined when a field already carries it.
 */
export function generalMessage(refusal: Refusal | undefined): string | undefined {
  if (!refusal) {
    return undefined
  }
  return refusal.fieldErrors.length > 0 ? undefined : refusal.message
}

/** Field errors the dialog has no control for, so they are not silently dropped. */
export function unplacedFieldMessages(
  refusal: Refusal | undefined,
  knownFields: string[]
): string[] {
  return (refusal?.fieldErrors ?? [])
    .filter((e) => !knownFields.includes(e.field))
    .map((e) => (e.field ? `${e.field}: ${e.message}` : e.message))
}
