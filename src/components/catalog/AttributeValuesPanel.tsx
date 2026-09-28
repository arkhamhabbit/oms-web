import * as React from 'react'
import { ArrowDownIcon, ArrowUpIcon, PencilIcon, PlusIcon } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { AttributeValueFormDialog } from '@/components/catalog/AttributeValueFormDialog'
import { toastApiError } from '@/lib/api-error'
import { moveItem } from '@/lib/reorder'
import {
  useAttributeValuesQuery,
  useDeactivateValueMutation,
  useReactivateValueMutation,
  useReorderValuesMutation,
  type AttributeValue,
} from '@/api/attributes'

export interface AttributeValuesPanelProps {
  attributeId: string
  canWrite: boolean
}

/** Shown alongside a SINGLE_SELECT/MULTI_SELECT attribute (spec §2) — add, edit label, reorder,
 * deactivate/reactivate. Deactivating a value in use by a non-archived variant is refused by the
 * server with a count baked into the message; that message is rendered as-is via
 * `toastApiError`, never parsed apart, matching how every other business-rule rejection in this
 * app surfaces (see `TransitionMenu`). */
function AttributeValuesPanel({ attributeId, canWrite }: AttributeValuesPanelProps) {
  const valuesQuery = useAttributeValuesQuery(attributeId)
  const reorder = useReorderValuesMutation(attributeId)
  const deactivate = useDeactivateValueMutation(attributeId)
  const reactivate = useReactivateValueMutation(attributeId)

  const [formOpen, setFormOpen] = React.useState(false)
  const [editingValue, setEditingValue] = React.useState<AttributeValue | undefined>(undefined)

  const values = valuesQuery.data ?? []

  function openAdd() {
    setEditingValue(undefined)
    setFormOpen(true)
  }
  function openEdit(value: AttributeValue) {
    setEditingValue(value)
    setFormOpen(true)
  }

  function move(index: number, direction: -1 | 1) {
    const reordered = moveItem(values, index, direction)
    if (reordered === values) {
      return
    }
    reorder
      .mutateAsync({ orderedIds: reordered.map((v) => v.id!) })
      .catch((error) => toastApiError(error))
  }

  function toggleActive(value: AttributeValue) {
    const mutation = value.active ? deactivate : reactivate
    mutation.mutateAsync(value.id!).catch((error) => toastApiError(error))
  }

  if (valuesQuery.isLoading) {
    return <p className="p-4 text-sm text-muted-foreground">Loading values…</p>
  }

  return (
    <div className="flex flex-col gap-3 p-3">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">Values</span>
        <Button size="sm" variant="outline" disabled={!canWrite} onClick={openAdd}>
          <PlusIcon /> Add value
        </Button>
      </div>
      {values.length === 0 ? (
        <p className="text-sm text-muted-foreground">No values yet.</p>
      ) : (
        <div className="flex flex-col divide-y rounded-md border bg-background">
          {values.map((value, index) => (
            <div key={value.id} className="flex items-center justify-between gap-2 px-3 py-2">
              <div className="flex items-center gap-2">
                <span className="font-medium">{value.label}</span>
                <span className="text-xs text-muted-foreground">({value.code})</span>
                {!value.active && <Badge variant="outline">Inactive</Badge>}
              </div>
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
                  disabled={!canWrite || index === values.length - 1}
                  title="Move down"
                  onClick={() => move(index, 1)}
                >
                  <ArrowDownIcon />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  disabled={!canWrite}
                  title="Edit"
                  onClick={() => openEdit(value)}
                >
                  <PencilIcon />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={!canWrite}
                  onClick={() => toggleActive(value)}
                >
                  {value.active ? 'Deactivate' : 'Reactivate'}
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <AttributeValueFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        attributeId={attributeId}
        value={editingValue}
      />
    </div>
  )
}

export { AttributeValuesPanel }
