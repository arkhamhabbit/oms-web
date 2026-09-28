import { useAttributeValuesQuery } from '@/api/attributes'
import type { Attribute } from '@/api/attributes'
import type { VariantOptionValueResponse } from '@/api/products'

function OneValueLabel({
  attributeId,
  attributeValueId,
  attributeName,
}: {
  attributeId: string
  attributeValueId: string
  attributeName: string
}) {
  const valuesQuery = useAttributeValuesQuery(attributeId)
  const label = valuesQuery.data?.find((v) => v.id === attributeValueId)?.label ?? '…'
  return (
    <span className="rounded-full border px-2 py-0.5 text-xs">
      {attributeName}: {label}
    </span>
  )
}

export interface VariantOptionSummaryProps {
  optionValues: VariantOptionValueResponse[]
  attributesById: Map<string | undefined, Attribute>
}

/** Renders a variant's option combination as "Weight: 1kg · Flavour: Chocolate" badges. Each axis
 * resolves its value label via the values query already cached by the Options tab / attribute
 * library — no bulk endpoint exists for this, so it's one small query per axis, deduplicated by
 * TanStack Query's cache across every variant row that shares the axis. */
function VariantOptionSummary({ optionValues, attributesById }: VariantOptionSummaryProps) {
  if (optionValues.length === 0) {
    return <span className="text-muted-foreground">—</span>
  }
  return (
    <div className="flex flex-wrap gap-1">
      {optionValues.map((ov) => (
        <OneValueLabel
          key={ov.attributeId}
          attributeId={ov.attributeId!}
          attributeValueId={ov.attributeValueId!}
          attributeName={attributesById.get(ov.attributeId)?.name ?? '?'}
        />
      ))}
    </div>
  )
}

export { VariantOptionSummary }
