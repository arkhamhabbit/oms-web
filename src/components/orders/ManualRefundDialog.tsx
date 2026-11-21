import * as React from 'react'
import { toast } from 'sonner'

import { useManualRefundMutation, type OrderDetail } from '@/api/orders'
import { ConfirmDialog } from '@/components/common/ConfirmDialog'
import { RefusalText } from '@/components/common/RefusalText'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { isApiError, isVersionConflict } from '@/lib/api-error'
import { MANUAL_REFUND_LABELS } from '@/lib/field-labels'
import { majorStringToMinor, minorToMajorString } from '@/lib/money'
import { manualRefundLeftMinor, rupees } from '@/lib/orders'
import { fieldMessage, toRefusal, type Refusal } from '@/lib/refusal'

/** What the dialog can say is wrong with the amount before asking: not a number, zero, or over what is left. */
export function manualRefundAmountProblem(amount: string, leftMinor: number): string | undefined {
  const minor = majorStringToMinor(amount)
  if (minor === null) {
    return 'Enter the amount paid back in rupees, up to two decimals.'
  }
  if (minor <= 0) {
    return 'The amount must be more than zero.'
  }
  if (minor > leftMinor) {
    return `The most that can be recorded is ${rupees(leftMinor)}, what was paid and not yet paid back.`
  }
  return undefined
}

/**
 * Record refund (D9.8, D9.9): the shopper was paid back outside Razorpay; this records it. No money
 * moves through OMS. The amount is capped at what is left to pay back.
 */
function ManualRefundDialog({
  order,
  onClose,
  onStale,
}: {
  order: OrderDetail
  onClose: () => void
  onStale: () => void
}) {
  const left = manualRefundLeftMinor(order)
  const mutation = useManualRefundMutation(order.id!)
  const [idempotencyKey, setIdempotencyKey] = React.useState(() => crypto.randomUUID())
  const [reference, setReference] = React.useState('')
  const [amount, setAmount] = React.useState(() => minorToMajorString(left))
  const [note, setNote] = React.useState('')
  const [touched, setTouched] = React.useState(false)
  const [refusal, setRefusal] = React.useState<Refusal | undefined>()

  const amountProblem = manualRefundAmountProblem(amount, left)
  const referenceProblem = reference.trim() ? undefined : 'Enter the reference of the payment back.'
  const showAmount = amount !== minorToMajorString(left) || touched ? amountProblem : undefined

  function confirm() {
    setTouched(true)
    const amountMinor = majorStringToMinor(amount)
    if (amountProblem || referenceProblem || amountMinor === null) {
      return
    }
    setRefusal(undefined)
    mutation
      .mutateAsync({
        idempotencyKey,
        version: order.version!,
        reference: reference.trim(),
        amountMinor,
        note: note.trim(),
      })
      .then(() => {
        toast.success('Refund recorded')
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

  const amountMessage = showAmount ?? fieldMessage(refusal, 'amountMinor')
  const referenceMessage = (touched ? referenceProblem : undefined) ?? fieldMessage(refusal, 'reference')
  return (
    <ConfirmDialog
      open
      onOpenChange={(open) => !open && onClose()}
      title="Record refund"
      confirmLabel="Record refund"
      destructive
      pending={mutation.isPending}
      onConfirm={confirm}
    >
      <p>
        Record that {order.number} was paid back to the shopper outside Razorpay. OMS moves no money:
        this only keeps the record. Up to{' '}
        <strong className="text-foreground" data-testid="refund-left">
          {rupees(left)}
        </strong>{' '}
        can be recorded.
      </p>
      <div className="grid gap-3 text-foreground">
        <div className="grid gap-1.5">
          <Label htmlFor="manual-refund-reference">Reference</Label>
          <Input
            id="manual-refund-reference"
            placeholder="Bank transfer id, UPI reference"
            value={reference}
            onChange={(e) => setReference(e.target.value)}
            aria-invalid={referenceMessage ? true : undefined}
          />
          {referenceMessage && <p className="text-sm text-destructive">{referenceMessage}</p>}
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="manual-refund-amount">Amount (₹)</Label>
          <Input
            id="manual-refund-amount"
            inputMode="decimal"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            aria-invalid={amountMessage ? true : undefined}
          />
          {amountMessage && <p className="text-sm text-destructive">{amountMessage}</p>}
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="manual-refund-note">Note (optional)</Label>
          <Input id="manual-refund-note" value={note} onChange={(e) => setNote(e.target.value)} />
        </div>
      </div>
      <RefusalText
        refusal={refusal}
        knownFields={['reference', 'amountMinor']}
        labels={MANUAL_REFUND_LABELS}
      />
    </ConfirmDialog>
  )
}

export { ManualRefundDialog }
