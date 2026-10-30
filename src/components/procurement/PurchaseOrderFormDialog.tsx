import * as React from 'react'
import { toast } from 'sonner'
import { Trash2Icon } from 'lucide-react'

import { RefusalText } from '@/components/common/RefusalText'
import { LabelledInput } from '@/components/form/LabelledInput'
import { MoneyInput } from '@/components/form/MoneyInput'
import { VariantChoice, type ChosenVariant } from '@/components/inventory/VariantChoice'
import { WarehouseSelect } from '@/components/inventory/WarehouseSelect'
import { SupplierSelect } from '@/components/procurement/SupplierSelect'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  useCreatePurchaseOrderMutation,
  useUpdatePurchaseOrderMutation,
  type PurchaseOrder,
} from '@/api/procurement'
import { minorToMajorString } from '@/lib/money'
import { optionalText } from '@/lib/inventory'
import {
  draftLineTotals,
  draftTotals,
  isDraftLineComplete,
  toDraftLines,
  toLineRequests,
  type DraftLine,
} from '@/lib/procurement'
import { fieldMessage, toRefusal, type Refusal } from '@/lib/refusal'

const CURRENCY = 'INR'
const rupees = (minor: number) => `₹${minorToMajorString(minor)}`

/** Create a draft, or edit one when `order` is given (an edit replaces the whole line set). */
function PurchaseOrderFormDialog({
  open,
  onOpenChange,
  order,
  initialSupplierId,
  onSaved,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  order?: PurchaseOrder
  initialSupplierId?: string
  onSaved?: (order: PurchaseOrder) => void
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {open && (
        <Body
          order={order}
          initialSupplierId={initialSupplierId}
          onClose={() => onOpenChange(false)}
          onSaved={onSaved}
        />
      )}
    </Dialog>
  )
}

function Body({
  order,
  initialSupplierId,
  onClose,
  onSaved,
}: {
  order?: PurchaseOrder
  initialSupplierId?: string
  onClose: () => void
  onSaved?: (order: PurchaseOrder) => void
}) {
  const isEdit = !!order
  const currency = order?.currency ?? CURRENCY
  const create = useCreatePurchaseOrderMutation()
  const update = useUpdatePurchaseOrderMutation(order?.id ?? '')
  const pending = create.isPending || update.isPending

  const [supplierId, setSupplierId] = React.useState(order?.supplierId ?? initialSupplierId ?? '')
  const [warehouseId, setWarehouseId] = React.useState(order?.warehouseId ?? '')
  const [expectedOn, setExpectedOn] = React.useState(order?.expectedOn ?? '')
  const [notes, setNotes] = React.useState(order?.notes ?? '')
  const [lines, setLines] = React.useState<DraftLine[]>(() => toDraftLines(order?.lines))
  const [picked, setPicked] = React.useState<ChosenVariant | null>(null)
  const [refusal, setRefusal] = React.useState<Refusal | undefined>()

  const totals = draftTotals(lines)
  const ready =
    !!supplierId &&
    !!warehouseId &&
    lines.every(isDraftLineComplete) &&
    (isEdit ? lines.length > 0 : true)

  function addPicked(variant: ChosenVariant | null) {
    if (!variant) {
      setPicked(null)
      return
    }
    setPicked(null)
    setLines((current) =>
      current.some((l) => l.variantId === variant.id)
        ? current
        : [
            ...current,
            {
              key: crypto.randomUUID(),
              variantId: variant.id,
              skuCode: variant.skuCode,
              name: variant.name,
              quantity: '1',
              unitCostMinor: null,
              taxRate: '0',
            },
          ]
    )
  }

  function patch(key: string, change: Partial<DraftLine>) {
    setLines((current) => current.map((l) => (l.key === key ? { ...l, ...change } : l)))
  }

  function submit() {
    setRefusal(undefined)
    const wireLines = toLineRequests(lines, currency)
    const saved = isEdit
      ? update.mutateAsync({
          poNumber: order!.poNumber!,
          version: order!.version!,
          warehouseId,
          expectedOn: expectedOn || undefined,
          notes: optionalText(notes),
          lines: wireLines,
        })
      : create.mutateAsync({
          supplierId,
          warehouseId,
          currency,
          expectedOn: expectedOn || undefined,
          notes: optionalText(notes),
          lines: wireLines,
        })
    saved
      .then((result) => {
        toast.success(isEdit ? 'Draft updated' : 'Draft created')
        onSaved?.(result)
        onClose()
      })
      .catch((error) => setRefusal(toRefusal(error, 'This order')))
  }

  return (
    <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-3xl">
      <DialogHeader>
        <DialogTitle>{isEdit ? `Edit ${order!.poNumber}` : 'New purchase order'}</DialogTitle>
        <DialogDescription>
          {isEdit
            ? 'Saving replaces the whole set of lines with the ones below, not just the rows you changed. The order stays a draft until it is approved.'
            : 'Raised as a draft: it commits nothing until it is approved. Totals below are for your reference; the server works out the real ones and they are shown after saving.'}
        </DialogDescription>
      </DialogHeader>
      <div className="grid gap-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="grid gap-1.5">
            <Label htmlFor="po-supplier">Supplier</Label>
            <SupplierSelect
              id="po-supplier"
              value={supplierId}
              onChange={setSupplierId}
              ariaLabel="Supplier"
              activeOnly={!isEdit}
              disabled={isEdit}
              className="w-full"
            />
            {fieldMessage(refusal, 'supplierId') && (
              <p role="alert" className="text-sm text-destructive">
                {fieldMessage(refusal, 'supplierId')}
              </p>
            )}
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="po-warehouse">Destination warehouse</Label>
            <WarehouseSelect
              id="po-warehouse"
              value={warehouseId}
              onChange={setWarehouseId}
              ariaLabel="Destination warehouse"
              activeOnly
              className="w-full"
            />
            {fieldMessage(refusal, 'warehouseId') && (
              <p role="alert" className="text-sm text-destructive">
                {fieldMessage(refusal, 'warehouseId')}
              </p>
            )}
          </div>
          <LabelledInput
            id="po-expected"
            label="Expected on (optional)"
            type="date"
            value={expectedOn}
            onValueChange={setExpectedOn}
            error={fieldMessage(refusal, 'expectedOn')}
          />
          <LabelledInput
            id="po-notes"
            label="Notes (optional)"
            value={notes}
            onValueChange={setNotes}
            maxLength={1000}
            error={fieldMessage(refusal, 'notes')}
          />
        </div>

        <div className="grid gap-2">
          <Label>Lines</Label>
          {lines.length > 0 && (
            <div className="overflow-x-auto rounded-md border">
              <table className="w-full text-sm">
                <thead className="text-left text-xs text-muted-foreground">
                  <tr>
                    <th className="px-2 py-1.5">SKU</th>
                    <th className="px-2 py-1.5">Qty</th>
                    <th className="px-2 py-1.5">Unit cost</th>
                    <th className="px-2 py-1.5">GST %</th>
                    <th className="px-2 py-1.5 text-right">Line total</th>
                    <th className="px-2 py-1.5" />
                  </tr>
                </thead>
                <tbody>
                  {lines.map((line) => {
                    const lineTotals = draftLineTotals(line)
                    return (
                      <tr key={line.key} className="border-t align-top">
                        <td className="px-2 py-1.5">
                          <div className="font-mono">{line.skuCode}</div>
                          <div className="max-w-48 truncate text-xs text-muted-foreground">
                            {line.name}
                          </div>
                        </td>
                        <td className="px-2 py-1.5">
                          <Input
                            inputMode="numeric"
                            aria-label={`Quantity for ${line.skuCode}`}
                            value={line.quantity}
                            onChange={(e) => patch(line.key, { quantity: e.target.value })}
                            className="w-20"
                          />
                        </td>
                        <td className="px-2 py-1.5">
                          <MoneyInput
                            aria-label={`Unit cost for ${line.skuCode}`}
                            valueMinor={line.unitCostMinor}
                            onValueMinorChange={(minor) =>
                              patch(line.key, { unitCostMinor: minor })
                            }
                            className="w-32"
                          />
                        </td>
                        <td className="px-2 py-1.5">
                          <Input
                            inputMode="decimal"
                            aria-label={`GST rate for ${line.skuCode}`}
                            value={line.taxRate}
                            onChange={(e) => patch(line.key, { taxRate: e.target.value })}
                            className="w-20"
                          />
                        </td>
                        <td className="px-2 py-1.5 text-right">
                          {lineTotals ? (
                            <>
                              <div>{rupees(lineTotals.costMinor)}</div>
                              <div className="text-xs text-muted-foreground">
                                + {rupees(lineTotals.taxMinor)} GST
                              </div>
                            </>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </td>
                        <td className="px-2 py-1.5">
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            aria-label={`Remove ${line.skuCode}`}
                            onClick={() =>
                              setLines((current) => current.filter((l) => l.key !== line.key))
                            }
                          >
                            <Trash2Icon />
                          </Button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
          <div className="grid gap-1">
            <span className="text-xs text-muted-foreground">Add a line</span>
            <VariantChoice
              value={picked}
              onChange={addPicked}
              actionLabel="Add line"
              ariaLabel="Find a product or SKU to order"
            />
          </div>
          {lines.length > 0 && (
            <p className="text-sm" aria-label="Order totals">
              Order: {rupees(totals.costMinor)} + {rupees(totals.taxMinor)} GST ={' '}
              <b>{rupees(totals.costMinor + totals.taxMinor)}</b>{' '}
              <span className="text-xs text-muted-foreground">
                (for display; the server is the authority)
              </span>
            </p>
          )}
          {fieldMessage(refusal, 'lines') && (
            <p role="alert" className="text-sm text-destructive">
              {fieldMessage(refusal, 'lines')}
            </p>
          )}
        </div>
        <RefusalText
          refusal={refusal}
          knownFields={['supplierId', 'warehouseId', 'expectedOn', 'notes', 'lines']}
        />
      </div>
      <DialogFooter>
        <Button variant="outline" onClick={onClose} disabled={pending}>
          Cancel
        </Button>
        <Button onClick={submit} disabled={!ready || pending}>
          {isEdit ? 'Save draft' : 'Create draft'}
        </Button>
      </DialogFooter>
    </DialogContent>
  )
}

export { PurchaseOrderFormDialog }
