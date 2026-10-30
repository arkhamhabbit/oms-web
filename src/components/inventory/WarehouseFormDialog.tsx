import * as React from 'react'
import { toast } from 'sonner'

import { RefusalText } from '@/components/common/RefusalText'
import { LabelledInput } from '@/components/form/LabelledInput'
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
  useCreateWarehouseMutation,
  useUpdateWarehouseMutation,
  type Warehouse,
  type WarehouseType,
} from '@/api/inventory'
import { optionalText, WAREHOUSE_TYPES } from '@/lib/inventory'
import { fieldMessage, toRefusal, type Refusal } from '@/lib/refusal'
import { WAREHOUSE_TYPE_LABEL } from '@/lib/labels'

const FIELDS = [
  'code',
  'name',
  'type',
  'addressLine1',
  'addressLine2',
  'city',
  'state',
  'pincode',
  'gstin',
]

/** Create, or edit when `warehouse` is given (carries its `version`; the code cannot change). */
function WarehouseFormDialog({
  open,
  onOpenChange,
  warehouse,
  onSaved,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  warehouse?: Warehouse
  onSaved?: (warehouse: Warehouse) => void
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {open && <Body warehouse={warehouse} onClose={() => onOpenChange(false)} onSaved={onSaved} />}
    </Dialog>
  )
}

function Body({
  warehouse,
  onClose,
  onSaved,
}: {
  warehouse?: Warehouse
  onClose: () => void
  onSaved?: (warehouse: Warehouse) => void
}) {
  const isEdit = !!warehouse
  const create = useCreateWarehouseMutation()
  const update = useUpdateWarehouseMutation(warehouse?.id ?? '')
  const pending = create.isPending || update.isPending

  const [code, setCode] = React.useState(warehouse?.code ?? '')
  const [name, setName] = React.useState(warehouse?.name ?? '')
  const [type, setType] = React.useState<WarehouseType>(warehouse?.type ?? 'OWN')
  const [line1, setLine1] = React.useState(warehouse?.addressLine1 ?? '')
  const [line2, setLine2] = React.useState(warehouse?.addressLine2 ?? '')
  const [city, setCity] = React.useState(warehouse?.city ?? '')
  const [state, setState] = React.useState(warehouse?.state ?? '')
  const [pincode, setPincode] = React.useState(warehouse?.pincode ?? '')
  const [gstin, setGstin] = React.useState(warehouse?.gstin ?? '')
  const [refusal, setRefusal] = React.useState<Refusal | undefined>()

  const ready = [code, name, line1, city, state, pincode].every((v) => v.trim() !== '')

  function submit() {
    setRefusal(undefined)
    const common = {
      code: code.trim(),
      name: name.trim(),
      type,
      addressLine1: line1.trim(),
      addressLine2: optionalText(line2),
      city: city.trim(),
      state: state.trim(),
      pincode: pincode.trim(),
      gstin: optionalText(gstin),
    }
    const saved = isEdit
      ? update.mutateAsync({ ...common, version: warehouse!.version! })
      : create.mutateAsync(common)
    saved
      .then((result) => {
        toast.success(isEdit ? 'Warehouse updated' : 'Warehouse created')
        onSaved?.(result)
        onClose()
      })
      .catch((error) => setRefusal(toRefusal(error, 'This warehouse')))
  }

  return (
    <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
      <DialogHeader>
        <DialogTitle>{isEdit ? 'Edit warehouse' : 'New warehouse'}</DialogTitle>
        <DialogDescription>
          The code is printed on labels and paperwork, so it cannot be changed once created. State
          is required: an inter-state transfer is a GST event.
        </DialogDescription>
      </DialogHeader>
      <div className="grid gap-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <LabelledInput
            id="wh-code"
            label="Code"
            value={code}
            onValueChange={setCode}
            disabled={isEdit}
            error={fieldMessage(refusal, 'code')}
          />
          <div className="grid gap-1.5">
            <Label htmlFor="wh-type">Type</Label>
            <Select value={type} onValueChange={(next) => setType(next as WarehouseType)}>
              <SelectTrigger id="wh-type" className="w-full" aria-label="Type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {WAREHOUSE_TYPES.map((t) => (
                  <SelectItem key={t} value={t}>
                    {WAREHOUSE_TYPE_LABEL[t]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <LabelledInput
          id="wh-name"
          label="Name"
          value={name}
          onValueChange={setName}
          error={fieldMessage(refusal, 'name')}
        />
        <LabelledInput
          id="wh-line1"
          label="Address line 1"
          value={line1}
          onValueChange={setLine1}
          error={fieldMessage(refusal, 'addressLine1')}
        />
        <LabelledInput
          id="wh-line2"
          label="Address line 2 (optional)"
          value={line2}
          onValueChange={setLine2}
          error={fieldMessage(refusal, 'addressLine2')}
        />
        <div className="grid gap-4 sm:grid-cols-3">
          <LabelledInput
            id="wh-city"
            label="City"
            value={city}
            onValueChange={setCity}
            error={fieldMessage(refusal, 'city')}
          />
          <LabelledInput
            id="wh-state"
            label="State"
            value={state}
            onValueChange={setState}
            error={fieldMessage(refusal, 'state')}
          />
          <LabelledInput
            id="wh-pincode"
            label="Pincode"
            inputMode="numeric"
            value={pincode}
            onValueChange={setPincode}
            error={fieldMessage(refusal, 'pincode')}
          />
        </div>
        <LabelledInput
          id="wh-gstin"
          label="GSTIN (optional)"
          value={gstin}
          onValueChange={setGstin}
          error={fieldMessage(refusal, 'gstin')}
        />
        <RefusalText refusal={refusal} knownFields={FIELDS} />
      </div>
      <DialogFooter>
        <Button variant="outline" onClick={onClose} disabled={pending}>
          Cancel
        </Button>
        <Button onClick={submit} disabled={!ready || pending}>
          {isEdit ? 'Save' : 'Create'}
        </Button>
      </DialogFooter>
    </DialogContent>
  )
}

export { WarehouseFormDialog }
