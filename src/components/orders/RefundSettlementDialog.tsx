import * as React from 'react'
import { toast } from 'sonner'

import { ConfirmDialog } from '@/components/common/ConfirmDialog'
import { RefusalText } from '@/components/common/RefusalText'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useRefundSettlementMutation, type OrderDetail } from '@/api/orders'
import { isApiError, isVersionConflict } from '@/lib/api-error'
import { REFUND_LABELS } from '@/lib/field-labels'
import { fieldMessage, toRefusal, type Refusal } from '@/lib/refusal'

export type RefundSettlementKind = 'retry' | 'mark-refunded'

const COPY: Record<RefundSettlementKind, { title: string; confirm: string }> = {
  retry: { title: 'Retry the refund', confirm: 'Retry refund' },
  'mark-refunded': { title: 'Mark as refunded', confirm: 'Mark as refunded' },
}

/**
 * The two ways an admin closes out a refund the gateway keeps refusing (D9.6). Mounted only while
 * one is chosen, so the idempotency key is minted once per opening. A refusal stays in the dialog,
 * the reference's beside its box.
 */
function RefundSettlementDialog({
  order,
  kind,
  onClose,
  onStale,
}: {
  order: OrderDetail
  kind: RefundSettlementKind | undefined
  onClose: () => void
  onStale: () => void
}) {
  return (
    <>
      {kind && (
        <Body key={kind} order={order} kind={kind} onClose={onClose} onStale={onStale} />
      )}
    </>
  )
}

function Body({
  order,
  kind,
  onClose,
  onStale,
}: {
  order: OrderDetail
  kind: RefundSettlementKind
  onClose: () => void
  onStale: () => void
}) {
  const mutation = useRefundSettlementMutation(order.id!)
  const [idempotencyKey, setIdempotencyKey] = React.useState(() => crypto.randomUUID())
  const [reference, setReference] = React.useState('')
  const [reason, setReason] = React.useState('')
  const [refusal, setRefusal] = React.useState<Refusal | undefined>()
  const copy = COPY[kind]
  const manual = kind === 'mark-refunded'
  const referenceMessage = fieldMessage(refusal, 'reference')

  function confirm() {
    setRefusal(undefined)
    mutation
      .mutateAsync({
        action: kind,
        version: order.version!,
        idempotencyKey,
        reference: reference.trim(),
        reason: reason.trim(),
      })
      .then(() => {
        toast.success(manual ? 'Marked as refunded' : 'Refund retried')
        onClose()
      })
      .catch((error) => {
        setRefusal(toRefusal(error, 'This order'))
        if (isApiError(error) && error.code !== 'NETWORK_ERROR') {
          setIdempotencyKey(crypto.randomUUID())
        }
        if (isVersionConflict(error)) {
          onStale()
        }
      })
  }

  return (
    <ConfirmDialog
      open
      onOpenChange={(open) => !open && onClose()}
      title={copy.title}
      confirmLabel={copy.confirm}
      destructive={manual}
      pending={mutation.isPending}
      confirmDisabled={manual && !reference.trim()}
      onConfirm={confirm}
    >
      {manual ? (
        <p>
          Record that {order.number} was paid back to the shopper outside the gateway. The payment
          becomes Refunded (manual) with the reference below, and the order becomes Refunded. The
          gateway is not asked again.
        </p>
      ) : (
        <p>
          Start a fresh round of refund attempts for {order.number}: the attempt count goes back to
          zero and one attempt runs now. If the gateway refuses again, the refund stays pending.
        </p>
      )}
      {manual && (
        <div className="grid gap-3 text-foreground">
          <div className="grid gap-1.5">
            <Label htmlFor="refund-reference">Reference</Label>
            <Input
              id="refund-reference"
              placeholder="Bank transfer id, UPI reference, note"
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              aria-invalid={referenceMessage ? true : undefined}
            />
            {referenceMessage && <p className="text-sm text-destructive">{referenceMessage}</p>}
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="refund-reason">Reason (optional)</Label>
            <Input
              id="refund-reason"
              placeholder="Shown on the order’s history"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </div>
        </div>
      )}
      <RefusalText refusal={refusal} knownFields={['reference']} labels={REFUND_LABELS} />
    </ConfirmDialog>
  )
}

export { RefundSettlementDialog }
