import { isApiError } from '@/lib/api-error'

/**
 * The server's message for a refused operation, as the sentence to show — a guardrail
 * (system role, name taken, role still held) is already worded for an operator, so it is
 * rendered as-is rather than as "Request failed with 422".
 */
export function errorSentence(error: unknown): string {
  if (isApiError(error)) {
    return error.message
  }
  return error instanceof Error ? error.message : 'Something went wrong'
}
