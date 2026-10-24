import * as React from 'react'
import { toast } from 'sonner'

import { ConfirmDialog } from '@/components/common/ConfirmDialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useOrderActionMutation, type FulfilAction, type OrderDetail } from '@/api/orders'
import { isApiError, isVersionConflict } from '@/lib/api-error'
import { noticeFromError } from '@/components/common/NoticeBanner'

const COPY: Record<
  FulfilAction,
  { title: string; confirm: string; destructive?: boolean; body: (o: OrderDetail) => string }
> = {
  pack: {
    title: 'Pack this order',
    confirm: 'Pack',
    body: (o) => `${o.number} moves from Confirmed to Packed.`,
  },
  ship: {
    title: 'Ship this order',
    confirm: 'Ship',
    body: (o) =>
      `${o.number} moves to Shipped. The carrier and tracking reference are what the shopper sees.`,
  },
  'out-for-delivery': {
    title: 'Mark out for delivery',
    confirm: 'Out for delivery',
    body: (o) => `${o.number} moves from Shipped to Out for delivery.`,
  },
  deliver: {
    title: 'Mark delivered',
    confirm: 'Deliver',
    body: (o) => `${o.number} moves from Out for delivery to Delivered.`,
  },
  cancel: {
    title: 'Cancel this order',
    confirm: 'Cancel order',
    destructive: true,
    body: (o) =>
      o.status === 'PENDING_PAYMENT'
        ? `${o.number} has not been paid: its stock holds are released.`
        : `${o.number} is cancelled: its stock goes back on the shelf, the Bits and Carrots it spent are returned, the payment is refunded in full and what it earned is reversed.`,
  },
  refund: {
    title: 'Refund this order',
    confirm: 'Refund',
    destructive: true,
    body: (o) =>
      `${o.number} is refunded in full: the Bits and Carrots it spent are returned, the payment is refunded at the gateway and what it earned is reversed. No stock moves — the goods are with the shopper.`,
  },
}

/**
 * One confirm dialog for every order action. Mounted only while an action is chosen, so the
 * idempotency key is minted once per opening: a resend of the same confirm is not a second action.
 * A refusal stays in the dialog in the server's own words.
 */
function OrderActionDialog({
  order,
  action,
  onClose,
  onStale,
}: {
  order: OrderDetail
  action: FulfilAction | undefined
  onClose: () => void
  onStale: () => void
}) {
  return (
    <>
      {action && (
        <ActionBody
          key={action}
          order={order}
          action={action}
          onClose={onClose}
          onStale={onStale}
        />
      )}
    </>
  )
}

function ActionBody({
  order,
  action,
  onClose,
  onStale,
}: {
  order: OrderDetail
  action: FulfilAction
  onClose: () => void
  onStale: () => void
}) {
  const mutation = useOrderActionMutation(order.id!)
  const [idempotencyKey, setIdempotencyKey] = React.useState(() => crypto.randomUUID())
  const [carrier, setCarrier] = React.useState('')
  const [tracking, setTracking] = React.useState('')
  const [reason, setReason] = React.useState('')
  const [refusal, setRefusal] = React.useState<string | undefined>()
  const copy = COPY[action]

  const missing = action === 'ship' && (!carrier.trim() || !tracking.trim())

  function confirm() {
    setRefusal(undefined)
    mutation
      .mutateAsync({
        action,
        version: order.version!,
        idempotencyKey,
        carrier: carrier.trim(),
        trackingReference: tracking.trim(),
        reason: reason.trim(),
      })
      .then(() => {
        toast.success(`${copy.confirm}: done`)
        onClose()
      })
      .catch((error) => {
        setRefusal(noticeFromError(error, 'This order').text)
        // A refusal the server answered is final for that key; a retry after correcting is a new attempt.
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
      destructive={copy.destructive}
      pending={mutation.isPending}
      confirmDisabled={missing}
      onConfirm={confirm}
    >
      <p>{copy.body(order)}</p>
      {action === 'ship' && (
        <div className="grid gap-3 text-foreground">
          <div className="grid gap-1.5">
            <Label htmlFor="ship-carrier">Carrier</Label>
            <Input
              id="ship-carrier"
              placeholder="Delhivery"
              value={carrier}
              onChange={(e) => setCarrier(e.target.value)}
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="ship-tracking">Tracking reference</Label>
            <Input
              id="ship-tracking"
              value={tracking}
              onChange={(e) => setTracking(e.target.value)}
            />
          </div>
        </div>
      )}
      {(action === 'cancel' || action === 'refund') && (
        <div className="grid gap-1.5 text-foreground">
          <Label htmlFor="order-reason">Reason (optional)</Label>
          <Input
            id="order-reason"
            placeholder="Shown on the order’s history"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
        </div>
      )}
      {refusal && (
        <p role="alert" className="text-sm text-destructive">
          {refusal}
        </p>
      )}
    </ConfirmDialog>
  )
}

export { OrderActionDialog }
