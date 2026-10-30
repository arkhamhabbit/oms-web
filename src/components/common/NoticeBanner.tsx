import { AlertTriangleIcon } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { isApiError, isVersionConflict } from '@/lib/api-error'
import { describeFieldError, type FieldLabels } from '@/lib/field-labels'

/** A refusal to show inline: the server's own sentence, plus the traceId a support report needs. */
export interface Notice {
  text: string
  traceId?: string
  /** D2.24 — a `VERSION_CONFLICT`: the only remedy is to reload, so the banner offers it. */
  stale: boolean
}

/**
 * Turns a failed mutation into the sentence to show. A guardrail or business-rule refusal is
 * already worded for an operator on the OMS side, so it is rendered as-is; a stale `version` is
 * branched on by **code** (D2.24), never by message, and gets one standard sentence naming what
 * moved — `subject` is "This user", "This draft", ….
 */
export function noticeFromError(
  error: unknown,
  subject: string,
  labels?: FieldLabels
): Notice {
  if (isVersionConflict(error)) {
    return {
      text: `${subject} was changed by someone else — reload to see the latest, then try again.`,
      traceId: isApiError(error) ? error.traceId : undefined,
      stale: true,
    }
  }
  if (isApiError(error)) {
    // 0.10: a field failure is one fixed line plus a field error each; name the fields by label.
    const fields = error.fieldErrors.map((f) => describeFieldError(f, labels))
    return {
      text: fields.length > 0 ? `${error.message} ${fields.join(' ')}` : error.message,
      traceId: error.traceId,
      stale: false,
    }
  }
  return { text: error instanceof Error ? error.message : 'Something went wrong', stale: false }
}

/** The shared refusal / version-conflict banner. Reload appears only for a stale version. */
function NoticeBanner({
  notice,
  onReload,
  onDismiss,
}: {
  notice: Notice
  onReload: () => void
  onDismiss: () => void
}) {
  return (
    <div
      role="alert"
      className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm"
    >
      <AlertTriangleIcon className="mt-0.5 size-4 shrink-0 text-destructive" />
      <div className="flex-1">
        <p>{notice.text}</p>
        {notice.traceId && (
          <p className="text-xs text-muted-foreground">Trace ID: {notice.traceId}</p>
        )}
      </div>
      {notice.stale && (
        <Button size="sm" variant="outline" onClick={onReload}>
          Reload
        </Button>
      )}
      <Button size="sm" variant="ghost" onClick={onDismiss}>
        Dismiss
      </Button>
    </div>
  )
}

export { NoticeBanner }
