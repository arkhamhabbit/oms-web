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
import {
  useCreateSupplierMutation,
  useUpdateSupplierMutation,
  type Supplier,
} from '@/api/procurement'
import { optionalText } from '@/lib/inventory'
import { fieldMessage, toRefusal, type Refusal } from '@/lib/refusal'

const FIELDS = [
  'code',
  'name',
  'addressLine1',
  'addressLine2',
  'city',
  'state',
  'pincode',
  'gstin',
  'contactName',
  'contactPhone',
  'contactEmail',
  'paymentTermsDays',
]

/** Create, or edit when `supplier` is given (carries its `version`; the code cannot change). */
function SupplierFormDialog({
  open,
  onOpenChange,
  supplier,
  onSaved,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  supplier?: Supplier
  onSaved?: (supplier: Supplier) => void
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {open && <Body supplier={supplier} onClose={() => onOpenChange(false)} onSaved={onSaved} />}
    </Dialog>
  )
}

function Body({
  supplier,
  onClose,
  onSaved,
}: {
  supplier?: Supplier
  onClose: () => void
  onSaved?: (supplier: Supplier) => void
}) {
  const isEdit = !!supplier
  const create = useCreateSupplierMutation()
  const update = useUpdateSupplierMutation(supplier?.id ?? '')
  const pending = create.isPending || update.isPending

  const [code, setCode] = React.useState(supplier?.code ?? '')
  const [name, setName] = React.useState(supplier?.name ?? '')
  const [line1, setLine1] = React.useState(supplier?.addressLine1 ?? '')
  const [line2, setLine2] = React.useState(supplier?.addressLine2 ?? '')
  const [city, setCity] = React.useState(supplier?.city ?? '')
  const [state, setState] = React.useState(supplier?.state ?? '')
  const [pincode, setPincode] = React.useState(supplier?.pincode ?? '')
  const [gstin, setGstin] = React.useState(supplier?.gstin ?? '')
  const [contactName, setContactName] = React.useState(supplier?.contactName ?? '')
  const [contactPhone, setContactPhone] = React.useState(supplier?.contactPhone ?? '')
  const [contactEmail, setContactEmail] = React.useState(supplier?.contactEmail ?? '')
  const [terms, setTerms] = React.useState(String(supplier?.paymentTermsDays ?? 30))
  const [refusal, setRefusal] = React.useState<Refusal | undefined>()

  const termsDays = /^\d+$/.test(terms.trim()) ? Number.parseInt(terms, 10) : null
  const ready =
    [code, name, line1, city, state, pincode].every((v) => v.trim() !== '') && termsDays !== null

  function submit() {
    if (termsDays === null) {
      return
    }
    setRefusal(undefined)
    const common = {
      code: code.trim(),
      name: name.trim(),
      addressLine1: line1.trim(),
      addressLine2: optionalText(line2),
      city: city.trim(),
      state: state.trim(),
      pincode: pincode.trim(),
      gstin: optionalText(gstin),
      contactName: optionalText(contactName),
      contactPhone: optionalText(contactPhone),
      contactEmail: optionalText(contactEmail),
      paymentTermsDays: termsDays,
    }
    const saved = isEdit
      ? update.mutateAsync({ ...common, version: supplier!.version! })
      : create.mutateAsync(common)
    saved
      .then((result) => {
        toast.success(isEdit ? 'Supplier updated' : 'Supplier created')
        onSaved?.(result)
        onClose()
      })
      .catch((error) => setRefusal(toRefusal(error, 'This supplier')))
  }

  return (
    <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
      <DialogHeader>
        <DialogTitle>{isEdit ? 'Edit supplier' : 'New supplier'}</DialogTitle>
        <DialogDescription>
          The code appears on purchase orders that outlive the relationship, so it cannot be changed
          once created. State is required: an inter-state purchase is a GST event.
        </DialogDescription>
      </DialogHeader>
      <div className="grid gap-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <LabelledInput
            id="sup-code"
            label="Code"
            value={code}
            onValueChange={setCode}
            disabled={isEdit}
            error={fieldMessage(refusal, 'code')}
          />
          <LabelledInput
            id="sup-terms"
            label="Payment terms (days)"
            inputMode="numeric"
            value={terms}
            onValueChange={setTerms}
            error={fieldMessage(refusal, 'paymentTermsDays')}
          />
        </div>
        <LabelledInput
          id="sup-name"
          label="Name"
          value={name}
          onValueChange={setName}
          error={fieldMessage(refusal, 'name')}
        />
        <LabelledInput
          id="sup-line1"
          label="Address line 1"
          value={line1}
          onValueChange={setLine1}
          error={fieldMessage(refusal, 'addressLine1')}
        />
        <LabelledInput
          id="sup-line2"
          label="Address line 2 (optional)"
          value={line2}
          onValueChange={setLine2}
          error={fieldMessage(refusal, 'addressLine2')}
        />
        <div className="grid gap-4 sm:grid-cols-3">
          <LabelledInput
            id="sup-city"
            label="City"
            value={city}
            onValueChange={setCity}
            error={fieldMessage(refusal, 'city')}
          />
          <LabelledInput
            id="sup-state"
            label="State"
            value={state}
            onValueChange={setState}
            error={fieldMessage(refusal, 'state')}
          />
          <LabelledInput
            id="sup-pincode"
            label="Pincode"
            inputMode="numeric"
            value={pincode}
            onValueChange={setPincode}
            error={fieldMessage(refusal, 'pincode')}
          />
        </div>
        <LabelledInput
          id="sup-gstin"
          label="GSTIN (optional)"
          value={gstin}
          onValueChange={setGstin}
          error={fieldMessage(refusal, 'gstin')}
        />
        <div className="grid gap-4 sm:grid-cols-3">
          <LabelledInput
            id="sup-contact-name"
            label="Contact name"
            value={contactName}
            onValueChange={setContactName}
            error={fieldMessage(refusal, 'contactName')}
          />
          <LabelledInput
            id="sup-contact-phone"
            label="Contact phone"
            value={contactPhone}
            onValueChange={setContactPhone}
            error={fieldMessage(refusal, 'contactPhone')}
          />
          <LabelledInput
            id="sup-contact-email"
            label="Contact email"
            type="email"
            value={contactEmail}
            onValueChange={setContactEmail}
            error={fieldMessage(refusal, 'contactEmail')}
          />
        </div>
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

export { SupplierFormDialog }
