import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { useTransferQuery, type StockMovement } from '@/api/inventory'
import { isApiError } from '@/lib/api-error'
import { formatDateTime } from '@/lib/orders'
import { formatSigned, MOVEMENT_TYPE_LABEL } from '@/lib/inventory'

function Half({ title, movement }: { title: string; movement: StockMovement | undefined }) {
  return (
    <section aria-label={title} className="rounded-md border p-3 text-sm">
      <h3 className="font-medium">{title}</h3>
      {movement ? (
        <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1">
          <dt className="text-muted-foreground">Type</dt>
          <dd>{movement.movementType ? MOVEMENT_TYPE_LABEL[movement.movementType] : ''}</dd>
          <dt className="text-muted-foreground">Warehouse</dt>
          <dd className="font-mono">{movement.warehouseCode}</dd>
          <dt className="text-muted-foreground">SKU</dt>
          <dd className="font-mono">{movement.skuCode}</dd>
          <dt className="text-muted-foreground">Quantity</dt>
          <dd className="font-medium">{formatSigned(movement.quantity)}</dd>
          {movement.batchNumber && (
            <>
              <dt className="text-muted-foreground">Batch</dt>
              <dd className="font-mono">{movement.batchNumber}</dd>
            </>
          )}
          <dt className="text-muted-foreground">When</dt>
          <dd>{formatDateTime(movement.occurredAt)}</dd>
          {movement.note && (
            <>
              <dt className="text-muted-foreground">Note</dt>
              <dd>{movement.note}</dd>
            </>
          )}
        </dl>
      ) : (
        <p className="mt-1 text-muted-foreground">Not found.</p>
      )}
    </section>
  )
}

/**
 * Both halves of one transfer, opened from a movement's reference id. A side panel rather than a
 * page: the operator is in the middle of reading the ledger and wants to stay there.
 */
function TransferDrawer({
  referenceId,
  onClose,
}: {
  referenceId: string | undefined
  onClose: () => void
}) {
  const transfer = useTransferQuery(referenceId)
  return (
    <Dialog open={!!referenceId} onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        className="fixed top-0 right-0 left-auto h-svh max-h-svh w-full translate-x-0 translate-y-0 content-start gap-4 overflow-y-auto rounded-none sm:max-w-md"
        aria-describedby="transfer-drawer-description"
      >
        <DialogHeader>
          <DialogTitle>Transfer</DialogTitle>
          <DialogDescription
            id="transfer-drawer-description"
            className="font-mono text-xs break-all"
          >
            {referenceId}
          </DialogDescription>
        </DialogHeader>
        {transfer.isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}
        {transfer.isError && (
          <p role="alert" className="text-sm text-destructive">
            {isApiError(transfer.error)
              ? transfer.error.message
              : 'The transfer could not be loaded.'}
          </p>
        )}
        {transfer.data && (
          <div className="grid gap-3">
            <Half title="Out" movement={transfer.data.out} />
            <Half title="In" movement={transfer.data.in} />
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

export { TransferDrawer }
