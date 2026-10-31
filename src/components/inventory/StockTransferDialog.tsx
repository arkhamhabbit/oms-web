import * as React from 'react'
import { toast } from 'sonner'

import { RefusalText } from '@/components/common/RefusalText'
import { LabelledInput } from '@/components/form/LabelledInput'
import { BatchSelect } from '@/components/inventory/BatchSelect'
import type { StockFormSeed } from '@/components/inventory/StockAdjustDialog'
import { VariantChoice, type ChosenVariant } from '@/components/inventory/VariantChoice'
import { WarehouseSelect } from '@/components/inventory/WarehouseSelect'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { useBatchesQuery, useTransferStockMutation } from '@/api/inventory'
import { isApiError } from '@/lib/api-error'
import { optionalText, positiveInt } from '@/lib/inventory'
import { fieldMessage, toRefusal, type Refusal } from '@/lib/refusal'

function StockTransferDialog({
  open,
  onOpenChange,
  seed,
  onDone,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  seed?: StockFormSeed
  /** Called with the transfer's reference id once it is posted, so the page can offer its two halves. */
  onDone?: (referenceId: string | undefined) => void
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {open && <TransferBody seed={seed} onClose={() => onOpenChange(false)} onDone={onDone} />}
    </Dialog>
  )
}

function TransferBody({
  seed,
  onClose,
  onDone,
}: {
  seed?: StockFormSeed
  onClose: () => void
  onDone?: (referenceId: string | undefined) => void
}) {
  const mutation = useTransferStockMutation()
  const [idempotencyKey, setIdempotencyKey] = React.useState(() => crypto.randomUUID())
  const [variant, setVariant] = React.useState<ChosenVariant | null>(seed?.variant ?? null)
  const [fromId, setFromId] = React.useState(seed?.warehouseId ?? '')
  const [toId, setToId] = React.useState('')
  const [batchId, setBatchId] = React.useState(seed?.batchId ?? '')
  const [quantity, setQuantity] = React.useState('')
  const [note, setNote] = React.useState('')
  const [refusal, setRefusal] = React.useState<Refusal | undefined>()

  const batches = useBatchesQuery({ page: 0, size: 100, variantId: variant?.id }, !!variant)
  const batchList = batches.data?.content ?? []
  const batchTracked = !!variant?.batchTracked

  const amount = positiveInt(quantity)
  const ready = !!variant && !!fromId && !!toId && fromId !== toId && amount !== null

  function submit() {
    if (!variant || amount === null) {
      return
    }
    setRefusal(undefined)
    mutation
      .mutateAsync({
        idempotencyKey,
        body: {
          variantId: variant.id,
          fromWarehouseId: fromId,
          toWarehouseId: toId,
          batchId: batchTracked && batchId ? batchId : undefined,
          quantity: amount,
          note: optionalText(note),
        },
      })
      .then((transfer) => {
        toast.success('Transfer posted')
        onDone?.(transfer.referenceId)
        onClose()
      })
      .catch((error) => {
        setRefusal(toRefusal(error))
        if (isApiError(error) && error.code !== 'NETWORK_ERROR') {
          setIdempotencyKey(crypto.randomUUID())
        }
      })
  }

  return (
    <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
      <DialogHeader>
        <DialogTitle>Transfer stock</DialogTitle>
        <DialogDescription>
          Moves units between warehouses as two movements in one transaction: both happen or neither
          does.
        </DialogDescription>
      </DialogHeader>
      <div className="grid gap-4">
        <div className="grid gap-1.5">
          <Label>Variant</Label>
          <VariantChoice
            value={variant}
            onChange={(next) => {
              setVariant(next)
              setBatchId('')
            }}
            locked={!!seed?.variant}
            ariaLabel="Find a product or SKU to transfer"
          />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="grid gap-1.5">
            <Label htmlFor="transfer-from">From</Label>
            <WarehouseSelect
              id="transfer-from"
              value={fromId}
              onChange={setFromId}
              ariaLabel="From warehouse"
              exclude={toId || undefined}
              className="w-full"
            />
            {fieldMessage(refusal, 'fromWarehouseId') && (
              <p role="alert" className="text-sm text-destructive">
                {fieldMessage(refusal, 'fromWarehouseId')}
              </p>
            )}
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="transfer-to">To</Label>
            <WarehouseSelect
              id="transfer-to"
              value={toId}
              onChange={setToId}
              ariaLabel="To warehouse"
              exclude={fromId || undefined}
              className="w-full"
            />
            {fieldMessage(refusal, 'toWarehouseId') && (
              <p role="alert" className="text-sm text-destructive">
                {fieldMessage(refusal, 'toWarehouseId')}
              </p>
            )}
          </div>
        </div>
        {variant && batchTracked && (
          <div className="grid gap-1.5">
            <Label htmlFor="transfer-batch">Batch</Label>
            <BatchSelect
              id="transfer-batch"
              batches={batchList}
              value={batchId}
              onChange={setBatchId}
              ariaLabel="Batch"
              className="w-full"
            />
            {fieldMessage(refusal, 'batchId') && (
              <p role="alert" className="text-sm text-destructive">
                {fieldMessage(refusal, 'batchId')}
              </p>
            )}
          </div>
        )}
        <div className="grid gap-1.5">
          <LabelledInput
            id="transfer-quantity"
            label="Quantity"
            inputMode="numeric"
            value={quantity}
            onValueChange={setQuantity}
            hint="A positive count: the direction is the pair of warehouses."
            error={fieldMessage(refusal, 'quantity')}
          />
          <RefusalText
            refusal={refusal}
            knownFields={['fromWarehouseId', 'toWarehouseId', 'batchId', 'quantity']}
          />
        </div>
        <LabelledInput
          id="transfer-note"
          label="Note (optional)"
          value={note}
          onValueChange={setNote}
          maxLength={500}
          error={fieldMessage(refusal, 'note')}
        />
      </div>
      <DialogFooter>
        <Button variant="outline" onClick={onClose} disabled={mutation.isPending}>
          Cancel
        </Button>
        <Button onClick={submit} disabled={!ready || mutation.isPending}>
          Transfer
        </Button>
      </DialogFooter>
    </DialogContent>
  )
}

export { StockTransferDialog }
