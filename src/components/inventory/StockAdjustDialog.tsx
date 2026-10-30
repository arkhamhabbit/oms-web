import * as React from 'react'
import { toast } from 'sonner'

import { RefusalText } from '@/components/common/RefusalText'
import { LabelledInput } from '@/components/form/LabelledInput'
import { BatchSelect } from '@/components/inventory/BatchSelect'
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  useAdjustStockMutation,
  useBatchesQuery,
  type MovementType,
  type ReasonCode,
} from '@/api/inventory'
import { isApiError } from '@/lib/api-error'
import {
  ADJUSTABLE_TYPES,
  optionalText,
  quantitySignFor,
  reasonsFor,
  REASON_REQUIRED_TYPES,
  signedQuantity,
} from '@/lib/inventory'
import { fieldMessage, toRefusal, type Refusal } from '@/lib/refusal'
import { MOVEMENT_TYPE_LABEL, REASON_CODE_LABEL } from '@/lib/labels'

export interface StockFormSeed {
  variant?: ChosenVariant
  warehouseId?: string
  batchId?: string
}

const SIGN_HINT: Record<ReturnType<typeof quantitySignFor>, string> = {
  positive: 'Units added. Enter a plain count; the type makes it a plus.',
  negative: 'Units removed. Enter a plain count; the type makes it a minus.',
  either: 'Signed: +3 adds three units, −3 removes three.',
}

function StockAdjustDialog({
  open,
  onOpenChange,
  seed,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  seed?: StockFormSeed
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {/* Mounted only while open, so every opening starts clean and mints its own Idempotency-Key. */}
      {open && <AdjustBody seed={seed} onClose={() => onOpenChange(false)} />}
    </Dialog>
  )
}

function AdjustBody({ seed, onClose }: { seed?: StockFormSeed; onClose: () => void }) {
  const mutation = useAdjustStockMutation()
  const [idempotencyKey, setIdempotencyKey] = React.useState(() => crypto.randomUUID())
  const [variant, setVariant] = React.useState<ChosenVariant | null>(seed?.variant ?? null)
  const [warehouseId, setWarehouseId] = React.useState(seed?.warehouseId ?? '')
  const [batchId, setBatchId] = React.useState(seed?.batchId ?? '')
  const [type, setType] = React.useState<MovementType>('ADJUSTMENT')
  const [reason, setReason] = React.useState<ReasonCode | ''>('')
  const [quantity, setQuantity] = React.useState('')
  const [note, setNote] = React.useState('')
  const [refusal, setRefusal] = React.useState<Refusal | undefined>()

  // A refusal describes the form as it was sent. Once any field changes it no longer applies, so it
  // goes (W3.1: the sentence used to outlive the change that answered it).
  function changed<T>(set: (value: T) => void) {
    return (value: T) => {
      setRefusal(undefined)
      set(value)
    }
  }

  const batches = useBatchesQuery({ page: 0, size: 100, variantId: variant?.id }, !!variant)
  const batchList = batches.data?.content ?? []
  // A stock row does not say whether its variant tracks batches; batches exist only for tracked ones.
  const batchTracked = variant?.batchTracked ?? batchList.length > 0

  const needsReason = REASON_REQUIRED_TYPES.includes(type)
  const signed = signedQuantity(type, quantity)
  const ready = !!variant && !!warehouseId && signed !== null && (!needsReason || reason !== '')

  function submit() {
    if (!variant || signed === null) {
      return
    }
    setRefusal(undefined)
    mutation
      .mutateAsync({
        idempotencyKey,
        body: {
          variantId: variant.id,
          warehouseId,
          batchId: batchTracked && batchId ? batchId : undefined,
          movementType: type,
          reasonCode: needsReason && reason ? reason : undefined,
          quantity: signed,
          note: optionalText(note),
        },
      })
      .then(() => {
        toast.success('Stock movement posted')
        onClose()
      })
      .catch((error) => {
        setRefusal(toRefusal(error))
        // A refusal the server answered is final for that key; correcting and resending is a new attempt.
        if (isApiError(error) && error.code !== 'NETWORK_ERROR') {
          setIdempotencyKey(crypto.randomUUID())
        }
      })
  }

  return (
    <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
      <DialogHeader>
        <DialogTitle>Adjust stock</DialogTitle>
        <DialogDescription>
          Posts one movement to the ledger. The server refuses anything that would take a location
          below zero.
        </DialogDescription>
      </DialogHeader>
      <div className="grid gap-4">
        <div className="grid gap-1.5">
          <Label>Variant</Label>
          <VariantChoice
            value={variant}
            onChange={(next) => {
              setRefusal(undefined)
              setVariant(next)
              setBatchId('')
            }}
            locked={!!seed?.variant}
            ariaLabel="Find a product or SKU to adjust"
          />
          {fieldMessage(refusal, 'variantId') && (
            <p role="alert" className="text-sm text-destructive">
              {fieldMessage(refusal, 'variantId')}
            </p>
          )}
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="adjust-warehouse">Warehouse</Label>
          <WarehouseSelect
            id="adjust-warehouse"
            value={warehouseId}
            onChange={changed(setWarehouseId)}
            ariaLabel="Warehouse"
            className="w-full"
          />
          {fieldMessage(refusal, 'warehouseId') && (
            <p role="alert" className="text-sm text-destructive">
              {fieldMessage(refusal, 'warehouseId')}
            </p>
          )}
        </div>
        {variant && batchTracked && (
          <div className="grid gap-1.5">
            <Label htmlFor="adjust-batch">Batch</Label>
            <BatchSelect
              id="adjust-batch"
              batches={batchList}
              value={batchId}
              onChange={changed(setBatchId)}
              ariaLabel="Batch"
              className="w-full"
            />
            {batchList.length === 0 && (
              <p className="text-xs text-muted-foreground">
                No batches on file for this SKU yet — create one on the Batches page first.
              </p>
            )}
            {fieldMessage(refusal, 'batchId') && (
              <p role="alert" className="text-sm text-destructive">
                {fieldMessage(refusal, 'batchId')}
              </p>
            )}
          </div>
        )}
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="grid gap-1.5">
            <Label htmlFor="adjust-type">Movement type</Label>
            <Select
              value={type}
              onValueChange={(next) => {
                setRefusal(undefined)
                setType(next as MovementType)
                setReason('')
              }}
            >
              <SelectTrigger id="adjust-type" className="w-full" aria-label="Movement type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ADJUSTABLE_TYPES.map((t) => (
                  <SelectItem key={t} value={t}>
                    {MOVEMENT_TYPE_LABEL[t]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="adjust-reason">Reason{needsReason ? '' : ' (not used)'}</Label>
            <Select
              value={reason}
              onValueChange={changed((next: string) => setReason(next as ReasonCode))}
              disabled={!needsReason}
            >
              <SelectTrigger id="adjust-reason" className="w-full" aria-label="Reason code">
                <SelectValue placeholder={needsReason ? 'Choose a reason' : '—'} />
              </SelectTrigger>
              <SelectContent>
                {reasonsFor(type).map((code) => (
                  <SelectItem key={code} value={code}>
                    {REASON_CODE_LABEL[code]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {fieldMessage(refusal, 'reasonCode') && (
              <p role="alert" className="text-sm text-destructive">
                {fieldMessage(refusal, 'reasonCode')}
              </p>
            )}
          </div>
        </div>
        <div className="grid gap-1.5">
          <LabelledInput
            id="adjust-quantity"
            label="Quantity"
            inputMode="numeric"
            value={quantity}
            onValueChange={changed(setQuantity)}
            hint={SIGN_HINT[quantitySignFor(type)]}
            error={fieldMessage(refusal, 'quantity')}
          />
          {signed !== null && (
            <p className="text-xs text-muted-foreground">
              Will post {signed > 0 ? `+${signed}` : `−${Math.abs(signed)}`}.
            </p>
          )}
          {/* The server's sentence for a refused movement sits right under the quantity it refused. */}
          <RefusalText
            refusal={refusal}
            knownFields={['variantId', 'warehouseId', 'batchId', 'reasonCode', 'quantity']}
          />
        </div>
        <LabelledInput
          id="adjust-note"
          label="Note (optional)"
          value={note}
          onValueChange={changed(setNote)}
          maxLength={500}
          error={fieldMessage(refusal, 'note')}
        />
      </div>
      <DialogFooter>
        <Button variant="outline" onClick={onClose} disabled={mutation.isPending}>
          Cancel
        </Button>
        <Button onClick={submit} disabled={!ready || mutation.isPending}>
          Post movement
        </Button>
      </DialogFooter>
    </DialogContent>
  )
}

export { StockAdjustDialog }
