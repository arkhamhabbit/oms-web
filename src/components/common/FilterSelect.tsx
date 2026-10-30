import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

const ALL = '__all__'

/** A list-filter dropdown with an "all" entry; `value` is '' when no filter is chosen. */
function FilterSelect<T extends string>({
  value,
  onChange,
  options,
  ariaLabel,
  allLabel,
  className = 'w-48',
}: {
  value: T | ''
  onChange: (value: T | '') => void
  options: { value: T; label: string }[]
  ariaLabel: string
  allLabel: string
  className?: string
}) {
  return (
    <Select
      value={value === '' ? ALL : value}
      onValueChange={(next) => onChange(next === ALL ? '' : (next as T))}
    >
      <SelectTrigger className={className} aria-label={ariaLabel}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={ALL}>{allLabel}</SelectItem>
        {options.map((o) => (
          <SelectItem key={o.value} value={o.value}>
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

export { FilterSelect }
