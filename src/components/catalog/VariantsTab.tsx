import * as React from 'react'
import type { ColumnDef } from '@tanstack/react-table'
import { ArrowDownIcon, ArrowUpIcon, PlusIcon, StarIcon } from 'lucide-react'

import { DataTable } from '@/components/data-table/DataTable'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { VariantFieldsForm } from '@/components/catalog/VariantFieldsForm'
import { VariantOptionSummary } from '@/components/catalog/VariantOptionSummary'
import { minorToMajorString } from '@/lib/money'
import { toastApiError } from '@/lib/api-error'
import { moveItem } from '@/lib/reorder'
import { useKeyedState } from '@/lib/use-keyed-state'
import { useAttributesQuery, useAttributeValuesQuery } from '@/api/attributes'
import {
  useCreateVariantMutation,
  useDiscontinueVariantMutation,
  useMakeVariantDefaultMutation,
  useReinstateVariantMutation,
  useReorderVariantsMutation,
  type OptionValuePayload,
  type ProductOption,
  type Variant,
} from '@/api/products'

export interface VariantsTabProps {
  productId: string
  variants: Variant[]
  options: ProductOption[]
  skuCodesEditable: boolean
  canWrite: boolean
}

function NewVariantDialog({
  open,
  onOpenChange,
  productId,
  options,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  productId: string
  options: ProductOption[]
}) {
  const attributesQuery = useAttributesQuery({ page: 0, size: 200, kind: 'OPTION' })
  const attributesById = new Map((attributesQuery.data?.content ?? []).map((a) => [a.id, a]))
  const createVariant = useCreateVariantMutation(productId)

  const [skuCode, setSkuCode] = useKeyedState(open, () => '')
  const [picks, setPicks] = useKeyedState<Record<string, string>>(open, () => ({}))

  const allPicked = options.every((o) => !!picks[o.attributeId!])

  function submit() {
    const optionValues: OptionValuePayload[] = options.map((o) => ({
      attributeId: o.attributeId!,
      attributeValueId: picks[o.attributeId!],
    }))
    createVariant
      .mutateAsync({ skuCode, optionValues })
      .then(() => onOpenChange(false))
      .catch((error) => toastApiError(error))
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>New variant</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <span className="text-sm font-medium">SKU code</span>
            <input
              className="h-9 rounded-md border px-3 font-mono text-sm"
              value={skuCode}
              onChange={(e) => setSkuCode(e.target.value)}
            />
          </div>
          {options.map((option) => (
            <OptionValuePicker
              key={option.id}
              attributeId={option.attributeId!}
              attributeName={attributesById.get(option.attributeId)?.name ?? option.attributeId!}
              value={picks[option.attributeId!] ?? ''}
              onChange={(valueId) =>
                setPicks((prev) => ({ ...prev, [option.attributeId!]: valueId }))
              }
            />
          ))}
          {/* A duplicate combination is a server refusal (D4.15), rendered as a sentence via
              toastApiError on submit — never pre-validated client-side against every existing
              variant's combination, since that would require replicating the server's canonical
              signature logic here. */}
        </div>
        <DialogFooter>
          <Button type="button" disabled={!skuCode || !allPicked || createVariant.isPending} onClick={submit}>
            Create
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function OptionValuePicker({
  attributeId,
  attributeName,
  value,
  onChange,
}: {
  attributeId: string
  attributeName: string
  value: string
  onChange: (valueId: string) => void
}) {
  const valuesQuery = useAttributeValuesQuery(attributeId)
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-sm font-medium">{attributeName}</span>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger>
          <SelectValue placeholder="Choose a value" />
        </SelectTrigger>
        <SelectContent>
          {(valuesQuery.data ?? []).map((v) => (
            <SelectItem key={v.id} value={v.id!}>
              {v.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}

/**
 * The Variants tab for anything past a simple product — `DataTable` with expandable rows (the
 * pattern established for W1.1's values panel). Each row shows the option combination, status,
 * MRP/price, and expands into the full `VariantFieldsForm` for editing.
 */
function VariantsTab({ productId, variants, options, skuCodesEditable, canWrite }: VariantsTabProps) {
  const attributesQuery = useAttributesQuery({ page: 0, size: 200, kind: 'OPTION' })
  const attributesById = new Map((attributesQuery.data?.content ?? []).map((a) => [a.id, a]))
  const reorder = useReorderVariantsMutation(productId)
  const [newVariantOpen, setNewVariantOpen] = React.useState(false)

  function move(index: number, direction: -1 | 1) {
    const reordered = moveItem(variants, index, direction)
    if (reordered === variants) {
      return
    }
    reorder
      .mutateAsync({ orderedIds: reordered.map((v) => v.id!) })
      .catch((error) => toastApiError(error))
  }

  const columns: ColumnDef<Variant, unknown>[] = [
    {
      id: 'sku',
      header: 'SKU',
      cell: ({ row }) => <span className="font-mono text-xs">{row.original.skuCode}</span>,
    },
    {
      id: 'options',
      header: 'Options',
      cell: ({ row }) => (
        <VariantOptionSummary
          optionValues={row.original.optionValues ?? []}
          attributesById={attributesById}
        />
      ),
    },
    {
      id: 'mrp',
      header: 'MRP',
      cell: ({ row }) =>
        row.original.mrp
          ? `${row.original.mrp.currency} ${minorToMajorString(row.original.mrp.amountMinor!)}`
          : '—',
    },
    {
      id: 'price',
      header: 'Base price',
      cell: ({ row }) =>
        row.original.baseSellingPrice
          ? `${row.original.baseSellingPrice.currency} ${minorToMajorString(row.original.baseSellingPrice.amountMinor!)}`
          : '—',
    },
    {
      id: 'status',
      header: 'Status',
      cell: ({ row }) => (
        <div className="flex items-center gap-1">
          <Badge variant={row.original.variantStatus === 'ACTIVE' ? 'default' : 'outline'}>
            {row.original.variantStatus}
          </Badge>
          {row.original.isDefault && (
            <Badge variant="secondary">
              <StarIcon className="mr-1 size-3" /> Default
            </Badge>
          )}
          {row.original.missingForSale && row.original.missingForSale.length > 0 && (
            <Badge variant="outline" className="border-amber-400 text-amber-700">
              Incomplete
            </Badge>
          )}
        </div>
      ),
    },
    {
      id: 'actions',
      header: '',
      cell: ({ row }) => (
        <VariantRowActions productId={productId} variant={row.original} canWrite={canWrite} />
      ),
    },
  ]

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-end">
        <Button disabled={!canWrite || options.length === 0} onClick={() => setNewVariantOpen(true)}>
          <PlusIcon /> New variant
        </Button>
      </div>

      <DataTable
        columns={columns}
        data={variants}
        emptyMessage="No variants yet."
        renderSubRow={(variant) => (
          <div className="p-3">
            <VariantFieldsForm
              productId={productId}
              variant={variant}
              skuCodesEditable={skuCodesEditable}
              canWrite={canWrite}
            />
          </div>
        )}
      />

      <ReorderRow variants={variants} canWrite={canWrite} onMove={move} />

      <NewVariantDialog
        open={newVariantOpen}
        onOpenChange={setNewVariantOpen}
        productId={productId}
        options={options}
      />
    </div>
  )
}

/** A plain reorder strip beneath the table — `DataTable` doesn't expose per-row up/down actions
 * inside a column here since the row-click-driven expand already occupies the leading cell. */
function ReorderRow({
  variants,
  canWrite,
  onMove,
}: {
  variants: Variant[]
  canWrite: boolean
  onMove: (index: number, direction: -1 | 1) => void
}) {
  if (variants.length < 2) {
    return null
  }
  return (
    <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
      <span>Display order:</span>
      {variants.map((variant, index) => (
        <span key={variant.id} className="flex items-center gap-0.5 rounded-md border px-1">
          <span className="px-1 font-mono text-xs">{variant.skuCode}</span>
          <Button
            variant="ghost"
            size="icon"
            className="size-6"
            disabled={!canWrite || index === 0}
            onClick={() => onMove(index, -1)}
          >
            <ArrowUpIcon className="size-3" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="size-6"
            disabled={!canWrite || index === variants.length - 1}
            onClick={() => onMove(index, 1)}
          >
            <ArrowDownIcon className="size-3" />
          </Button>
        </span>
      ))}
    </div>
  )
}

function VariantRowActions({
  productId,
  variant,
  canWrite,
}: {
  productId: string
  variant: Variant
  canWrite: boolean
}) {
  const makeDefault = useMakeVariantDefaultMutation(productId, variant.id!)
  const discontinue = useDiscontinueVariantMutation(productId, variant.id!)
  const reinstate = useReinstateVariantMutation(productId, variant.id!)

  return (
    <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
      {!variant.isDefault && (
        <Button
          variant="ghost"
          size="sm"
          disabled={!canWrite}
          onClick={() => makeDefault.mutateAsync().catch((error) => toastApiError(error))}
        >
          Make default
        </Button>
      )}
      {variant.variantStatus === 'ACTIVE' ? (
        <Button
          variant="ghost"
          size="sm"
          disabled={!canWrite}
          onClick={() => discontinue.mutateAsync().catch((error) => toastApiError(error))}
        >
          Discontinue
        </Button>
      ) : (
        <Button
          variant="ghost"
          size="sm"
          disabled={!canWrite}
          onClick={() => reinstate.mutateAsync().catch((error) => toastApiError(error))}
        >
          Reinstate
        </Button>
      )}
    </div>
  )
}

export { VariantsTab }
