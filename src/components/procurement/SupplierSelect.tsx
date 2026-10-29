import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useSuppliersQuery } from '@/api/procurement'

const ALL = '__all__'

/** A supplier chooser ('' is no choice, or "all" when `allLabel` is given). Up to 200 in one read. */
function SupplierSelect({
  value,
  onChange,
  ariaLabel,
  allLabel,
  activeOnly = false,
  className,
  id,
  disabled,
}: {
  value: string
  onChange: (supplierId: string) => void
  ariaLabel: string
  allLabel?: string
  activeOnly?: boolean
  className?: string
  id?: string
  disabled?: boolean
}) {
  const suppliers = useSuppliersQuery({
    page: 0,
    size: 200,
    active: activeOnly ? true : undefined,
  })
  const rows = suppliers.data?.content ?? []

  return (
    <Select
      value={value === '' ? (allLabel ? ALL : '') : value}
      onValueChange={(next) => onChange(next === ALL ? '' : next)}
      disabled={disabled}
    >
      <SelectTrigger id={id} className={className ?? 'w-56'} aria-label={ariaLabel}>
        <SelectValue placeholder={suppliers.isLoading ? 'Loading…' : 'Choose a supplier'} />
      </SelectTrigger>
      <SelectContent>
        {allLabel && <SelectItem value={ALL}>{allLabel}</SelectItem>}
        {rows.map((s) => (
          <SelectItem key={s.id} value={s.id!}>
            {s.code} — {s.name}
            {s.active === false ? ' (inactive)' : ''}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

export { SupplierSelect }
