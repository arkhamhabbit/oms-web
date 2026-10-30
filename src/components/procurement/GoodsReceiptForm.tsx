import * as React from 'react'
import { Link } from 'react-router-dom'

import { RefusalText } from '@/components/common/RefusalText'
import { LabelledInput } from '@/components/form/LabelledInput'
import { BatchSelect } from '@/components/inventory/BatchSelect'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { useBatchesQuery } from '@/api/inventory'
import {
  usePostGoodsReceiptMutation,
  type GoodsReceipt,
  type PurchaseOrder,
} from '@/api/procurement'
import { isApiError } from '@/lib/api-error'
import { todayIst } from '@/lib/inventory'
import {
  receiptDraftFromPo,
  receiptRowProblem,
  receiptRowsReady,
  toReceiptRequest,
  type ReceiptLineDraft,
} from '@/lib/procurement'
import { toRefusal, type Refusal } from '@/lib/refusal'

function BatchControls({
  row,
  onChange,
}: {
  row: ReceiptLineDraft
  onChange: (change: Partial<ReceiptLineDraft>) => void
}) {
  const batches = useBatchesQuery({ page: 0, size: 100, variantId: row.variantId })
  const list = batches.data?.content ?? []
  return (
    <div className="grid gap-2 text-sm">
      <div className="flex gap-3">
        <label className="flex items-center gap-1.5">
          <input
            type="radio"
            name={`batch-mode-${row.purchaseOrderLineId}`}
            checked={row.batchMode === 'existing'}
            onChange={() => onChange({ batchMode: 'existing' })}
          />
          Existing batch
        </label>
        <label className="flex items-center gap-1.5">
          <input
            type="radio"
            name={`batch-mode-${row.purchaseOrderLineId}`}
            checked={row.batchMode === 'new'}
            onChange={() => onChange({ batchMode: 'new' })}
          />
          New batch
        </label>
      </div>
      {row.batchMode === 'existing' ? (
        <div className="grid gap-1">
          <BatchSelect
            batches={list}
            value={row.batchId}
            onChange={(batchId) => onChange({ batchId })}
            ariaLabel={`Batch for ${row.skuCode}`}
          />
          {list.length === 0 && !batches.isLoading && (
            <span className="text-xs text-muted-foreground">
              No batches yet for this SKU — choose “New batch” to create one with this receipt.
            </span>
          )}
        </div>
      ) : (
        <div className="grid gap-2 sm:grid-cols-3">
          <Input
            aria-label={`Batch number for ${row.skuCode}`}
            placeholder="Batch number"
            value={row.batchNumber}
            onChange={(e) => onChange({ batchNumber: e.target.value })}
          />
          <Input
            type="date"
            aria-label={`Manufactured on for ${row.skuCode}`}
            title="Manufactured on"
            value={row.manufacturedOn}
            onChange={(e) => onChange({ manufacturedOn: e.target.value })}
          />
          <Input
            type="date"
            aria-label={`Expires on for ${row.skuCode}`}
            title="Expires on"
            value={row.expiresOn}
            onChange={(e) => onChange({ expiresOn: e.target.value })}
          />
        </div>
      )}
    </div>
  )
}

/**
 * Post a goods receipt against one approved or partly received order. Accepted quantity defaults
 * to what remains; the over-receipt ceiling is the server's, and its sentence is shown right
 * under the lines it refused. One Idempotency-Key per attempt: a refusal the server answered mints
 * a new one for the next explicit click, a network failure keeps the key (replaying it returns the
 * receipt the first call posted). Nothing is ever resent on its own.
 */
function GoodsReceiptForm({
  order,
  onPosted,
}: {
  order: PurchaseOrder
  onPosted: (receipt: GoodsReceipt) => void
}) {
  const mutation = usePostGoodsReceiptMutation()
  const [rows, setRows] = React.useState<ReceiptLineDraft[]>(() => receiptDraftFromPo(order))
  const [receivedOn, setReceivedOn] = React.useState(() => todayIst())
  const [invoice, setInvoice] = React.useState('')
  const [notes, setNotes] = React.useState('')
  const [idempotencyKey, setIdempotencyKey] = React.useState(() => crypto.randomUUID())
  const [refusal, setRefusal] = React.useState<Refusal | undefined>()
  const [failedOnce, setFailedOnce] = React.useState(false)

  function patch(lineId: string, change: Partial<ReceiptLineDraft>) {
    setRows((current) =>
      current.map((r) => (r.purchaseOrderLineId === lineId ? { ...r, ...change } : r))
    )
  }

  function submit() {
    setRefusal(undefined)
    mutation
      .mutateAsync({
        idempotencyKey,
        purchaseOrderId: order.id!,
        body: toReceiptRequest(rows, { receivedOn, supplierInvoiceNumber: invoice, notes }),
      })
      .then(onPosted)
      .catch((error) => {
        setRefusal(toRefusal(error, 'This order'))
        setFailedOnce(true)
        if (isApiError(error) && error.code !== 'NETWORK_ERROR') {
          setIdempotencyKey(crypto.randomUUID())
        }
      })
  }

  if (rows.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">{order.poNumber} has nothing left to receive.</p>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader>
          <CardTitle>Lines</CardTitle>
          <CardDescription>
            Accepted units become stock in {order.warehouseCode}. Rejected units are recorded but
            never enter inventory. A line with both left at 0 is not sent.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          {rows.map((row) => {
            const problem = receiptRowProblem(row)
            return (
              <div key={row.purchaseOrderLineId} className="grid gap-3 rounded-md border p-3">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <div>
                    <span className="font-mono">{row.skuCode}</span>{' '}
                    <span className="text-sm text-muted-foreground">{row.name}</span>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Ordered {row.ordered} · received {row.received} · remaining{' '}
                    <b className="text-foreground">{row.remaining}</b>
                  </div>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <LabelledInput
                    id={`accepted-${row.purchaseOrderLineId}`}
                    label="Accepted"
                    inputMode="numeric"
                    value={row.accepted}
                    onValueChange={(accepted) => patch(row.purchaseOrderLineId, { accepted })}
                  />
                  <LabelledInput
                    id={`rejected-${row.purchaseOrderLineId}`}
                    label="Rejected at the door"
                    inputMode="numeric"
                    value={row.rejected}
                    onValueChange={(rejected) => patch(row.purchaseOrderLineId, { rejected })}
                  />
                </div>
                {row.batchTracked && (
                  <BatchControls
                    row={row}
                    onChange={(change) => patch(row.purchaseOrderLineId, change)}
                  />
                )}
                {problem && (
                  <p role="alert" className="text-sm text-destructive">
                    {problem}
                  </p>
                )}
              </div>
            )
          })}
          {/* The server's sentence (the over-receipt ceiling names ordered, received and attempted) sits under the lines. */}
          <RefusalText refusal={refusal} knownFields={[]} />
          {failedOnce && refusal && (
            <p role="status" className="text-sm text-muted-foreground">
              Nothing was resent. Lines are written one after another, so before posting again{' '}
              <Link className="underline" to={`/procurement/purchase-orders/${order.id}`}>
                open {order.poNumber}
              </Link>{' '}
              and check what it shows as received.
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Receipt</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <LabelledInput
            id="grn-received-on"
            label="Received on"
            type="date"
            value={receivedOn}
            max={todayIst()}
            onValueChange={setReceivedOn}
            hint="Backdating is fine; a future date is refused."
          />
          <LabelledInput
            id="grn-invoice"
            label="Supplier's invoice number"
            maxLength={64}
            value={invoice}
            onValueChange={setInvoice}
          />
          <LabelledInput
            id="grn-notes"
            label="Notes"
            className="sm:col-span-2"
            maxLength={1000}
            value={notes}
            onValueChange={setNotes}
          />
        </CardContent>
      </Card>

      <div>
        <Button onClick={submit} disabled={!receiptRowsReady(rows) || mutation.isPending}>
          {mutation.isPending ? 'Posting…' : failedOnce ? 'Post again' : 'Post receipt'}
        </Button>
      </div>
    </div>
  )
}

export { GoodsReceiptForm }
