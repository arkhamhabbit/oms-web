import * as React from 'react'
import { toast } from 'sonner'

import { useMarkPaidMutation, type ManualPaymentMethod, type OrderDetail } from '@/api/orders'
import { ConfirmDialog } from '@/components/common/ConfirmDialog'
import { RefusalText } from '@/components/common/RefusalText'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { isApiError, isVersionConflict } from '@/lib/api-error'
import { MARK_PAID_LABELS } from '@/lib/field-labels'
import { PAYMENT_METHOD_LABEL } from '@/lib/labels'
import { majorStringToMinor, minorToMajorString } from '@/lib/money'
import { markPaidProblems } from '@/lib/orders'
import { fieldMessage, toRefusal, type Refusal } from '@/lib/refusal'

export const MARK_PAID_METHODS: ManualPaymentMethod[] = ['UPI', 'BANK_TRANSFER', 'CARD_OFFLINE', 'OTHER']

export const MARK_PAID_WARNING =
  'This confirms the order without a gateway payment. It will be refunded outside Razorpay.'

/** The local date-time a `datetime-local` box takes, for an instant (IST is the operators' clock, the box is the browser's). */
function localInput(ms: number): string {
  const d = new Date(ms - new Date(ms).getTimezoneOffset() * 60_000)
  return d.toISOString().slice(0, 16)
}

/**
 * Mark as paid (D9.9): how it was paid, the reference, the exact amount, when it was received, a
 * note. The amount starts at the payable and must match it; OMS answers with its own sentence when
 * it does not. Mounted only while open, so the idempotency key is minted once per opening.
 */
function MarkPaidDialog({
  order,
  onClose,
  onStale,
}: {
  order: OrderDetail
  onClose: () => void
  onStale: () => void
}) {
  const mutation = useMarkPaidMutation(order.id!)
  const [idempotencyKey, setIdempotencyKey] = React.useState(() => crypto.randomUUID())
  const [method, setMethod] = React.useState<ManualPaymentMethod>('UPI')
  const [reference, setReference] = React.useState('')
  const [amount, setAmount] = React.useState(() => minorToMajorString(order.payableMinor ?? 0))
  const [openedAt] = React.useState(() => Date.now())
  const [receivedAt, setReceivedAt] = React.useState(() => localInput(openedAt))
  const [note, setNote] = React.useState('')
  const [touched, setTouched] = React.useState(false)
  const [refusal, setRefusal] = React.useState<Refusal | undefined>()

  const problems = markPaidProblems({ reference, amount, receivedAt, now: openedAt })
  const invalid = Object.keys(problems).length > 0
  const shown = touched ? problems : {}
  const message = (field: 'reference' | 'amount' | 'receivedAt', serverField: string) =>
    shown[field] ?? fieldMessage(refusal, serverField)

  function confirm() {
    setTouched(true)
    const amountMinor = majorStringToMinor(amount)
    const stillInvalid =
      Object.keys(markPaidProblems({ reference, amount, receivedAt, now: Date.now() })).length > 0
    if (invalid || stillInvalid || amountMinor === null) {
      return
    }
    setRefusal(undefined)
    mutation
      .mutateAsync({
        idempotencyKey,
        body: {
          version: order.version!,
          method,
          reference: reference.trim(),
          amountMinor,
          receivedAt: new Date(receivedAt).toISOString(),
          note: note.trim() || undefined,
        },
      })
      .then(() => {
        toast.success('Marked as paid: the order is confirmed')
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

  const known = ['reference', 'amountMinor', 'receivedAt', 'method', 'note']
  return (
    <ConfirmDialog
      open
      onOpenChange={(open) => !open && onClose()}
      title="Mark as paid"
      confirmLabel="Mark as paid"
      pending={mutation.isPending}
      onConfirm={confirm}
    >
      <p>
        Record the payment received for {order.number}. The amount must equal the payable,{' '}
        <strong className="text-foreground">₹{minorToMajorString(order.payableMinor ?? 0)}</strong>.
      </p>
      <div className="grid gap-3 text-foreground">
        <div className="grid gap-1.5">
          <Label htmlFor="paid-method">How it was paid</Label>
          <Select value={method} onValueChange={(v) => setMethod(v as ManualPaymentMethod)}>
            <SelectTrigger id="paid-method" aria-label="How it was paid" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {MARK_PAID_METHODS.map((m) => (
                <SelectItem key={m} value={m}>
                  {PAYMENT_METHOD_LABEL[m]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="paid-reference">Reference</Label>
          <Input
            id="paid-reference"
            placeholder="UPI reference, bank transaction id"
            value={reference}
            onChange={(e) => setReference(e.target.value)}
            aria-invalid={message('reference', 'reference') ? true : undefined}
          />
          {message('reference', 'reference') && (
            <p className="text-sm text-destructive">{message('reference', 'reference')}</p>
          )}
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="paid-amount">Amount received (₹)</Label>
          <Input
            id="paid-amount"
            inputMode="decimal"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            aria-invalid={message('amount', 'amountMinor') ? true : undefined}
          />
          {message('amount', 'amountMinor') && (
            <p className="text-sm text-destructive">{message('amount', 'amountMinor')}</p>
          )}
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="paid-received">Received at</Label>
          <Input
            id="paid-received"
            type="datetime-local"
            value={receivedAt}
            max={localInput(openedAt)}
            onChange={(e) => setReceivedAt(e.target.value)}
            aria-invalid={message('receivedAt', 'receivedAt') ? true : undefined}
          />
          {message('receivedAt', 'receivedAt') && (
            <p className="text-sm text-destructive">{message('receivedAt', 'receivedAt')}</p>
          )}
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="paid-note">Note (optional)</Label>
          <Input id="paid-note" value={note} onChange={(e) => setNote(e.target.value)} />
        </div>
      </div>
      <p role="note" className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-foreground">
        {MARK_PAID_WARNING}
      </p>
      <RefusalText refusal={refusal} knownFields={known} labels={MARK_PAID_LABELS} />
    </ConfirmDialog>
  )
}

export { MarkPaidDialog }
