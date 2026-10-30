import * as React from 'react'
import { toast } from 'sonner'

import { ConfirmDialog } from '@/components/common/ConfirmDialog'
import { RefusalText } from '@/components/common/RefusalText'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  usePurchaseOrderActionMutation,
  type PurchaseOrder,
  type PurchaseOrderAction,
} from '@/api/procurement'
import { toRefusal, type Refusal } from '@/lib/refusal'

const COPY: Record<
  PurchaseOrderAction,
  { title: string; confirm: string; destructive?: boolean; body: (po: PurchaseOrder) => string }
> = {
  approve: {
    title: 'Approve this purchase order',
    confirm: 'Approve',
    body: (po) =>
      `${po.poNumber} is committed to ${po.supplierName}. Approval happens once and the lines can no longer be edited; to change an approved order you cancel it and raise a new one. The server refuses an empty order or a line with no quantity.`,
  },
  cancel: {
    title: 'Cancel this purchase order',
    confirm: 'Cancel order',
    destructive: true,
    body: (po) =>
      `${po.poNumber} is abandoned. This is refused once anything has been received: the stock is already in a warehouse, so return the goods or post a reversing receipt instead.`,
  },
}

/** Mounted only while an action is chosen. A refusal stays in the dialog in the server's words. */
function PurchaseOrderActionDialog({
  order,
  action,
  onClose,
}: {
  order: PurchaseOrder
  action: PurchaseOrderAction | undefined
  onClose: () => void
}) {
  return <>{action && <Body key={action} order={order} action={action} onClose={onClose} />}</>
}

function Body({
  order,
  action,
  onClose,
}: {
  order: PurchaseOrder
  action: PurchaseOrderAction
  onClose: () => void
}) {
  const mutation = usePurchaseOrderActionMutation(order.id!)
  const [reason, setReason] = React.useState('')
  const [refusal, setRefusal] = React.useState<Refusal | undefined>()
  const copy = COPY[action]

  function confirm() {
    setRefusal(undefined)
    mutation
      .mutateAsync({ action, reason: reason.trim() })
      .then(() => {
        toast.success(action === 'approve' ? 'Purchase order approved' : 'Purchase order cancelled')
        onClose()
      })
      .catch((error) => setRefusal(toRefusal(error, 'This order')))
  }

  return (
    <ConfirmDialog
      open
      onOpenChange={(open) => !open && onClose()}
      title={copy.title}
      confirmLabel={copy.confirm}
      destructive={copy.destructive}
      pending={mutation.isPending}
      onConfirm={confirm}
    >
      <p>{copy.body(order)}</p>
      {action === 'cancel' && (
        <div className="grid gap-1.5 text-foreground">
          <Label htmlFor="po-cancel-reason">Reason (optional)</Label>
          <Input
            id="po-cancel-reason"
            maxLength={500}
            placeholder="Recorded on the audit entry"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
        </div>
      )}
      <RefusalText refusal={refusal} />
    </ConfirmDialog>
  )
}

export { PurchaseOrderActionDialog }
