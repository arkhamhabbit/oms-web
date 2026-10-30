import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useWarehousesQuery } from '@/api/inventory'

const ALL = '__all__'

/**
 * A warehouse chooser. `value` is a warehouse id, or '' for "no choice" (which is "All
 * warehouses" when `allLabel` is given). Takes up to 200 warehouses in one read: the list has
 * no picker-friendly lookup, and a business has a handful.
 */
function WarehouseSelect({
  value,
  onChange,
  ariaLabel,
  allLabel,
  activeOnly = false,
  exclude,
  className,
  id,
}: {
  value: string
  onChange: (warehouseId: string) => void
  ariaLabel: string
  /** Offer an "all" entry with this label; omit for a required choice. */
  allLabel?: string
  activeOnly?: boolean
  /** A warehouse id to leave out (the transfer's other end). */
  exclude?: string
  className?: string
  id?: string
}) {
  const warehouses = useWarehousesQuery({
    page: 0,
    size: 200,
    active: activeOnly ? true : undefined,
  })
  const rows = (warehouses.data?.content ?? []).filter((w) => w.id !== exclude)

  return (
    <Select
      value={value === '' ? (allLabel ? ALL : '') : value}
      onValueChange={(next) => onChange(next === ALL ? '' : next)}
    >
      <SelectTrigger id={id} className={className ?? 'w-56'} aria-label={ariaLabel}>
        <SelectValue placeholder={warehouses.isLoading ? 'Loading…' : 'Choose a warehouse'} />
      </SelectTrigger>
      <SelectContent>
        {allLabel && <SelectItem value={ALL}>{allLabel}</SelectItem>}
        {rows.map((w) => (
          <SelectItem key={w.id} value={w.id!}>
            {w.code} — {w.name}
            {w.active === false ? ' (inactive)' : ''}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

export { WarehouseSelect }
