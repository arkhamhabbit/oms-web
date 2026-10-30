import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { Batch } from '@/api/inventory'
import { batchLabel } from '@/lib/inventory'

const ALL = '__all__'

/** Choose one of a variant's batches (already fetched by the caller, who also knows if tracking applies). */
function BatchSelect({
  batches,
  value,
  onChange,
  ariaLabel,
  allLabel,
  className,
  id,
}: {
  batches: Batch[]
  value: string
  onChange: (batchId: string) => void
  ariaLabel: string
  allLabel?: string
  className?: string
  id?: string
}) {
  return (
    <Select
      value={value === '' ? (allLabel ? ALL : '') : value}
      onValueChange={(next) => onChange(next === ALL ? '' : next)}
    >
      <SelectTrigger id={id} className={className ?? 'w-64'} aria-label={ariaLabel}>
        <SelectValue placeholder="Choose a batch" />
      </SelectTrigger>
      <SelectContent>
        {allLabel && <SelectItem value={ALL}>{allLabel}</SelectItem>}
        {batches.map((b) => (
          <SelectItem key={b.id} value={b.id!}>
            {batchLabel(b)}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

export { BatchSelect }
