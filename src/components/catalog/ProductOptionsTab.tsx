import * as React from 'react'
import { ArrowDownIcon, ArrowUpIcon, PlusIcon, XIcon } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { toastApiError } from '@/lib/api-error'
import { moveItem } from '@/lib/reorder'
import { useAttributesQuery, useAttributeValuesQuery } from '@/api/attributes'
import {
  useAddOptionMutation,
  useRemoveOptionMutation,
  useReorderOptionsMutation,
  type ProductOption,
  type Variant,
} from '@/api/products'

export interface ProductOptionsTabProps {
  productId: string
  options: ProductOption[]
  defaultVariant: Variant | undefined
  variantCount: number
  canWrite: boolean
}

/**
 * D4.9/§3+§4 — the trickiest tab in the task. Adding the **first** axis to a simple product is a
 * conversion moment and is called out explicitly, naming the SKU that survives it. Adding a
 * further axis (while the product still has exactly one variant — the server allows several axes
 * to accumulate before the first extra variant is created) is unremarkable. Adding an axis once
 * more than one variant exists, and a duplicate combination, are both server refusals rendered as
 * plain sentences (`toastApiError`) rather than hidden or pre-validated away (D2.17).
 */
function ProductOptionsTab({
  productId,
  options,
  defaultVariant,
  variantCount,
  canWrite,
}: ProductOptionsTabProps) {
  const attributesQuery = useAttributesQuery({ page: 0, size: 200, kind: 'OPTION' })
  const addOption = useAddOptionMutation(productId)
  const removeOption = useRemoveOptionMutation(productId)
  const reorder = useReorderOptionsMutation(productId)

  const attributesById = new Map((attributesQuery.data?.content ?? []).map((a) => [a.id, a]))
  const usedAttributeIds = new Set(options.map((o) => o.attributeId))
  const availableAttributes = (attributesQuery.data?.content ?? []).filter(
    (a) => !usedAttributeIds.has(a.id)
  )

  const [pickedAttributeId, setPickedAttributeId] = React.useState<string>('')
  const [pickedValueId, setPickedValueId] = React.useState<string>('')
  const valuesQuery = useAttributeValuesQuery(pickedAttributeId || undefined, !!pickedAttributeId)

  const isFirstAxis = options.length === 0

  function submitAddOption() {
    if (!pickedAttributeId || !pickedValueId) {
      return
    }
    addOption
      .mutateAsync({ attributeId: pickedAttributeId, valueForExistingVariant: pickedValueId })
      .then(() => {
        setPickedAttributeId('')
        setPickedValueId('')
      })
      .catch((error) => toastApiError(error))
  }

  function move(index: number, direction: -1 | 1) {
    const reordered = moveItem(options, index, direction)
    if (reordered === options) {
      return
    }
    reorder
      .mutateAsync({ orderedIds: reordered.map((o) => o.attributeId!) })
      .catch((error) => toastApiError(error))
  }

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader>
          <CardTitle>Option axes</CardTitle>
          <CardDescription>
            The attributes this product's variants are defined by — Weight, Flavour, Size, and so
            on. A product with none is a single item; add an axis to start giving it variants.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          {options.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No axes yet — this is a single item, edited on the Pricing & codes tab.
            </p>
          ) : (
            <div className="flex flex-col divide-y rounded-md border bg-background">
              {options.map((option, index) => (
                <div
                  key={option.id}
                  className="flex items-center justify-between gap-2 px-3 py-2"
                >
                  <span className="font-medium">
                    {attributesById.get(option.attributeId)?.name ?? option.attributeId}
                  </span>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      disabled={!canWrite || index === 0}
                      title="Move up"
                      onClick={() => move(index, -1)}
                    >
                      <ArrowUpIcon />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      disabled={!canWrite || index === options.length - 1}
                      title="Move down"
                      onClick={() => move(index, 1)}
                    >
                      <ArrowDownIcon />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      disabled={!canWrite}
                      title="Remove axis"
                      onClick={() =>
                        removeOption
                          .mutateAsync(option.attributeId!)
                          .catch((error) => toastApiError(error))
                      }
                    >
                      <XIcon />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {canWrite && (
        <Card>
          <CardHeader>
            <CardTitle>Add an axis</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {isFirstAxis && defaultVariant && (
              <p className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
                This product currently has no option axes — it's a single item. Adding the first
                axis converts it: <strong>the existing item becomes your first variant and keeps
                its SKU code {defaultVariant.skuCode}</strong>. Nothing else about it changes.
              </p>
            )}
            {variantCount > 1 && (
              <p className="text-sm text-muted-foreground">
                This product already has {variantCount} variants. The server will refuse a new
                axis in that state — that refusal will show as a message if you try.
              </p>
            )}
            <div className="flex flex-wrap items-end gap-3">
              <div className="flex flex-col gap-1.5">
                <span className="text-sm font-medium">Attribute</span>
                <Select
                  value={pickedAttributeId}
                  onValueChange={(value) => {
                    setPickedAttributeId(value)
                    setPickedValueId('')
                  }}
                >
                  <SelectTrigger className="w-56">
                    <SelectValue placeholder="Choose an attribute" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableAttributes.map((attribute) => (
                      <SelectItem key={attribute.id} value={attribute.id!}>
                        {attribute.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-1.5">
                <span className="text-sm font-medium">
                  Value for the existing {isFirstAxis ? 'item' : 'variant'}
                </span>
                <Select
                  value={pickedValueId}
                  onValueChange={setPickedValueId}
                  disabled={!pickedAttributeId}
                >
                  <SelectTrigger className="w-56">
                    <SelectValue placeholder="Choose a value" />
                  </SelectTrigger>
                  <SelectContent>
                    {(valuesQuery.data ?? []).map((value) => (
                      <SelectItem key={value.id} value={value.id!}>
                        {value.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button
                type="button"
                disabled={!pickedAttributeId || !pickedValueId || addOption.isPending}
                onClick={submitAddOption}
              >
                <PlusIcon /> Add axis
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

export { ProductOptionsTab }
