import { Link } from 'react-router-dom'

import { ApiClientError } from '@/lib/api-error'

/**
 * An invite the server refused, as its own sentence: "already an Insider" (with `existingId`
 * naming the account) or "already invited" (the message says when it was issued and expires).
 * Both are 409 `CONFLICT`; nothing here parses the message — it is shown as written.
 */
function InviteRefusal({ error, onNavigate }: { error: unknown; onNavigate?: () => void }) {
  const apiError = error instanceof ApiClientError ? error : undefined
  return (
    <div
      role="alert"
      className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm"
    >
      <p>
        {apiError?.message ?? (error instanceof Error ? error.message : 'Something went wrong')}
        {apiError?.existingId && (
          <>
            {' '}
            <Link
              to={`/users/${apiError.existingId}`}
              className="font-medium underline underline-offset-2"
              onClick={onNavigate}
            >
              Open the existing account
            </Link>
            .
          </>
        )}
      </p>
      {apiError && <p className="text-xs text-muted-foreground">Trace ID: {apiError.traceId}</p>}
    </div>
  )
}

export { InviteRefusal }
