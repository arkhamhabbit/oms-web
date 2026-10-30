import * as React from 'react'
import { toast } from 'sonner'

import { RefusalText } from '@/components/common/RefusalText'
import { LabelledInput } from '@/components/form/LabelledInput'
import { VariantChoice, type ChosenVariant } from '@/components/inventory/VariantChoice'
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
import { useCreateBatchMutation, type Batch } from '@/api/inventory'
import { fieldMessage, toRefusal, type Refusal } from '@/lib/refusal'

const FIELDS = ['variantId', 'batchNumber', 'manufacturedOn', 'expiresOn']

function BatchFormDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCreated?: (batch: Batch) => void
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {open && <Body onClose={() => onOpenChange(false)} onCreated={onCreated} />}
    </Dialog>
  )
}

function Body({ onClose, onCreated }: { onClose: () => void; onCreated?: (batch: Batch) => void }) {
  const create = useCreateBatchMutation()
  const [variant, setVariant] = React.useState<ChosenVariant | null>(null)
  const [batchNumber, setBatchNumber] = React.useState('')
  const [manufacturedOn, setManufacturedOn] = React.useState('')
  const [expiresOn, setExpiresOn] = React.useState('')
  const [refusal, setRefusal] = React.useState<Refusal | undefined>()

  const ready = !!variant && batchNumber.trim() !== ''

  function submit() {
    if (!variant) {
      return
    }
    setRefusal(undefined)
    create
      .mutateAsync({
        variantId: variant.id,
        batchNumber: batchNumber.trim(),
        manufacturedOn: manufacturedOn || undefined,
        expiresOn: expiresOn || undefined,
      })
      .then((batch) => {
        toast.success('Batch created')
        onCreated?.(batch)
        onClose()
      })
      .catch((error) => setRefusal(toRefusal(error, 'This batch')))
  }

  return (
    <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
      <DialogHeader>
        <DialogTitle>New batch</DialogTitle>
        <DialogDescription>
          Registers a batch before stock is received into it. Only batch-tracked SKUs take one, and
          a SKU with a shelf life needs an expiry date.
        </DialogDescription>
      </DialogHeader>
      <div className="grid gap-4">
        <div className="grid gap-1.5">
          <Label>Variant</Label>
          <VariantChoice
            value={variant}
            onChange={setVariant}
            ariaLabel="Find a product or SKU for the batch"
          />
          {fieldMessage(refusal, 'variantId') && (
            <p role="alert" className="text-sm text-destructive">
              {fieldMessage(refusal, 'variantId')}
            </p>
          )}
        </div>
        <LabelledInput
          id="batch-number"
          label="Batch number"
          value={batchNumber}
          onValueChange={setBatchNumber}
          error={fieldMessage(refusal, 'batchNumber')}
        />
        <div className="grid gap-4 sm:grid-cols-2">
          <LabelledInput
            id="batch-mfd"
            label="Manufactured on"
            type="date"
            value={manufacturedOn}
            onValueChange={setManufacturedOn}
            error={fieldMessage(refusal, 'manufacturedOn')}
          />
          <LabelledInput
            id="batch-exp"
            label="Expires on"
            type="date"
            value={expiresOn}
            onValueChange={setExpiresOn}
            hint="Good through the end of this day (IST)."
            error={fieldMessage(refusal, 'expiresOn')}
          />
        </div>
        <RefusalText refusal={refusal} knownFields={FIELDS} />
      </div>
      <DialogFooter>
        <Button variant="outline" onClick={onClose} disabled={create.isPending}>
          Cancel
        </Button>
        <Button onClick={submit} disabled={!ready || create.isPending}>
          Create
        </Button>
      </DialogFooter>
    </DialogContent>
  )
}

export { BatchFormDialog }
