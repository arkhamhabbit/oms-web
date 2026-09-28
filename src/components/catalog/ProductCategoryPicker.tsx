import { Checkbox } from '@/components/ui/checkbox'
import { cn } from '@/lib/utils'
import { flattenCategoryTree } from '@/lib/category-tree-adapter'
import type { CategoryTreeNode } from '@/api/categories'

export interface ProductCategoryPickerProps {
  tree: CategoryTreeNode[]
  selectedIds: string[]
  primaryId: string | undefined
  onChange: (selectedIds: string[], primaryId: string | undefined) => void
  disabled?: boolean
}

/**
 * Reuses W1.0's category tree (flattened, not the drag-to-reparent `CategoryTree` — this picker
 * only selects membership, it never moves a category) with a checkbox per node for membership and
 * a radio per node for "primary". **Exactly one primary is enforced here, visibly** — spec §2's
 * requirement that this not be discoverable only from a server 400: checking a category that isn't
 * yet primary and is the only one selected auto-marks it primary; unchecking the primary clears it
 * and, if others remain selected, promotes the first remaining one rather than leaving none set.
 */
function ProductCategoryPicker({
  tree,
  selectedIds,
  primaryId,
  onChange,
  disabled,
}: ProductCategoryPickerProps) {
  const options = flattenCategoryTree(tree)
  const selected = new Set(selectedIds)

  function toggle(id: string) {
    if (selected.has(id)) {
      const nextIds = selectedIds.filter((existing) => existing !== id)
      const nextPrimary = primaryId === id ? nextIds[0] : primaryId
      onChange(nextIds, nextPrimary)
    } else {
      const nextIds = [...selectedIds, id]
      const nextPrimary = primaryId ?? id
      onChange(nextIds, nextPrimary)
    }
  }

  function makePrimary(id: string) {
    onChange(selectedIds, id)
  }

  if (options.length === 0) {
    return <p className="text-sm text-muted-foreground">No categories exist yet.</p>
  }

  return (
    <div className="flex max-h-72 flex-col gap-0.5 overflow-y-auto rounded-md border p-2">
      {options.map((option) => {
        const isSelected = selected.has(option.id)
        return (
          <div
            key={option.id}
            className={cn(
              'flex items-center gap-2 rounded-sm px-2 py-1.5 text-sm',
              isSelected && 'bg-accent/50'
            )}
            style={{ paddingLeft: `${8 + option.depth * 16}px` }}
          >
            <Checkbox
              checked={isSelected}
              disabled={disabled}
              onCheckedChange={() => toggle(option.id)}
            />
            <span className="flex-1 truncate">{option.node.name}</span>
            {isSelected && (
              <label className="flex items-center gap-1 text-xs text-muted-foreground">
                <input
                  type="radio"
                  name="primary-category"
                  checked={primaryId === option.id}
                  disabled={disabled}
                  onChange={() => makePrimary(option.id)}
                />
                Primary
              </label>
            )}
          </div>
        )
      })}
    </div>
  )
}

export { ProductCategoryPicker }
