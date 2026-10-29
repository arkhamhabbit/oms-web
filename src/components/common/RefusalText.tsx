import { generalMessage, unplacedFieldMessages, type Refusal } from '@/lib/refusal'

/**
 * The server's own sentence for a refusal, placed beside the control that caused it (D2.25: the
 * message is already worded for an operator). Field errors the dialog has controls for are shown
 * by those controls; anything else — and the field-less sentence — lands here, with the traceId a
 * support report needs.
 */
function RefusalText({
  refusal,
  knownFields = [],
  id,
}: {
  refusal: Refusal | undefined
  knownFields?: string[]
  id?: string
}) {
  const general = generalMessage(refusal)
  const unplaced = unplacedFieldMessages(refusal, knownFields)
  if (!general && unplaced.length === 0) {
    return null
  }
  const traceId = refusal && 'traceId' in refusal ? refusal.traceId : undefined
  return (
    <div id={id} role="alert" className="grid gap-0.5 text-sm text-destructive">
      {general && <p>{general}</p>}
      {unplaced.map((message) => (
        <p key={message}>{message}</p>
      ))}
      {traceId && <p className="text-xs text-muted-foreground">Trace ID: {traceId}</p>}
    </div>
  )
}

export { RefusalText }
