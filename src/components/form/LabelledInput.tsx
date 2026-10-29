import type * as React from 'react'

import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'

export interface LabelledInputProps extends Omit<
  React.ComponentProps<'input'>,
  'onChange' | 'value' | 'id'
> {
  id: string
  label: string
  value: string
  onValueChange: (value: string) => void
  /** The server's (or the form's) sentence for this field, shown directly beneath it. */
  error?: string
  hint?: string
}

/** A label, an input and its refusal sentence in one block, for the plain-state dialogs. */
function LabelledInput({
  id,
  label,
  value,
  onValueChange,
  error,
  hint,
  className,
  ...props
}: LabelledInputProps) {
  return (
    <div className={cn('grid gap-1.5', className)}>
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        value={value}
        aria-invalid={!!error}
        aria-describedby={error ? `${id}-error` : hint ? `${id}-hint` : undefined}
        onChange={(event) => onValueChange(event.target.value)}
        {...props}
      />
      {hint && !error && (
        <p id={`${id}-hint`} className="text-xs text-muted-foreground">
          {hint}
        </p>
      )}
      {error && (
        <p id={`${id}-error`} role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  )
}

export { LabelledInput }
