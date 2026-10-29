import { Button } from '@/components/ui/button'
import { VariantPicker } from '@/components/pricing/VariantPicker'

/** What the stock and procurement forms need to know about a chosen variant. */
export interface ChosenVariant {
  id: string
  skuCode: string
  name: string
  /** Known when picked through the catalog search; absent when a stock row opened the form. */
  batchTracked?: boolean
}

/**
 * Choose a variant by searching the catalog (the existing picker), then show the choice with a
 * way to change it. `locked` is for a form opened from a row that already names its variant.
 */
function VariantChoice({
  value,
  onChange,
  locked = false,
  actionLabel = 'Choose',
  ariaLabel = 'Find a product or SKU',
}: {
  value: ChosenVariant | null
  onChange: (variant: ChosenVariant | null) => void
  locked?: boolean
  actionLabel?: string
  ariaLabel?: string
}) {
  if (value) {
    return (
      <div className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm">
        <span className="font-mono">{value.skuCode}</span>
        <span className="min-w-0 flex-1 truncate text-muted-foreground">{value.name}</span>
        {!locked && (
          <Button type="button" size="sm" variant="ghost" onClick={() => onChange(null)}>
            Change
          </Button>
        )}
      </div>
    )
  }
  return (
    <VariantPicker
      actionLabel={actionLabel}
      ariaLabel={ariaLabel}
      onPick={(variantId, variant) =>
        onChange({
          id: variantId,
          skuCode: variant.skuCode ?? '',
          name: variant.name ?? '',
          batchTracked: variant.batchTracked,
        })
      }
    />
  )
}

export { VariantChoice }
