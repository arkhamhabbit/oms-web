import * as React from 'react'
import { ChevronDownIcon } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

export interface MultiSelectOption {
  value: string
  label: string
}

export interface MultiSelectProps {
  options: MultiSelectOption[]
  value: string[]
  onValueChange: (value: string[]) => void
  placeholder?: string
  className?: string
  id?: string
}

function MultiSelect({
  options,
  value,
  onValueChange,
  placeholder = 'Select…',
  className,
  id,
}: MultiSelectProps) {
  const [open, setOpen] = React.useState(false)
  const selected = new Set(value)

  function toggle(optionValue: string) {
    if (selected.has(optionValue)) {
      onValueChange(value.filter((v) => v !== optionValue))
    } else {
      onValueChange([...value, optionValue])
    }
  }

  const selectedOptions = options.filter((o) => selected.has(o.value))

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          id={id}
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn('h-auto min-h-9 w-full justify-between font-normal', className)}
        >
          <span className="flex flex-1 flex-wrap gap-1">
            {selectedOptions.length === 0 ? (
              <span className="text-muted-foreground">{placeholder}</span>
            ) : (
              selectedOptions.map((option) => (
                <Badge key={option.value} variant="secondary">
                  {option.label}
                </Badge>
              ))
            )}
          </span>
          <ChevronDownIcon className="size-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-1" align="start">
        <div className="flex max-h-64 flex-col gap-0.5 overflow-y-auto">
          {options.map((option) => {
            const checked = selected.has(option.value)
            return (
              <label
                key={option.value}
                className="flex cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-accent"
              >
                <Checkbox checked={checked} onCheckedChange={() => toggle(option.value)} />
                {option.label}
              </label>
            )
          })}
        </div>
      </PopoverContent>
    </Popover>
  )
}

export { MultiSelect }
