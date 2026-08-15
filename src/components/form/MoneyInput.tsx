import * as React from 'react'

import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import { majorStringToMinor, minorToMajorString } from '@/lib/money'

export interface MoneyInputProps
  extends Omit<React.ComponentProps<'input'>, 'value' | 'onChange' | 'type'> {
  /** Amount in minor units (paise) — D3.2. Null while the field is empty or invalid. */
  valueMinor: number | null
  onValueMinorChange: (amountMinor: number | null) => void
  currencySymbol?: string
}

/**
 * Displays and edits a Money amount in major units (rupees) while the value it produces
 * — and the value it's controlled by — stays in integer minor units throughout, per D3.2.
 * Free-typing is preserved (e.g. a trailing "." or "4499.5") until the value resolves to a
 * valid amount; invalid intermediate text does not clobber the last valid minor value.
 */
function MoneyInput({
  valueMinor,
  onValueMinorChange,
  currencySymbol = '₹',
  className,
  id,
  ...props
}: MoneyInputProps) {
  const [text, setText] = React.useState(() =>
    valueMinor === null ? '' : minorToMajorString(valueMinor)
  )
  // Tracks the last valueMinor we rendered text for, so an external change to the
  // controlled value can resync `text` during render instead of via a setState-in-effect.
  const [syncedValueMinor, setSyncedValueMinor] = React.useState(valueMinor)

  if (valueMinor !== syncedValueMinor) {
    setSyncedValueMinor(valueMinor)
    setText(valueMinor === null ? '' : minorToMajorString(valueMinor))
  }

  return (
    <div className={cn('relative', className)}>
      <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-sm text-muted-foreground">
        {currencySymbol}
      </span>
      <Input
        id={id}
        inputMode="decimal"
        className="pl-7"
        value={text}
        onChange={(event) => {
          const next = event.target.value
          const minor = majorStringToMinor(next)
          setText(next)
          // Mark this minor value as already synced so the render-time check above
          // doesn't immediately overwrite the free-typed text once the new prop arrives.
          setSyncedValueMinor(minor)
          onValueMinorChange(minor)
        }}
        onBlur={(event) => {
          const minor = majorStringToMinor(event.target.value)
          setText(minor === null ? '' : minorToMajorString(minor))
          setSyncedValueMinor(minor)
        }}
        {...props}
      />
    </div>
  )
}

export { MoneyInput }
