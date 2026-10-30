import * as React from 'react'

import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { MultiSelect } from '@/components/form/MultiSelect'
import { toastApiError } from '@/lib/api-error'
import { useKeyedState } from '@/lib/use-keyed-state'
import { useAttributeValuesQuery } from '@/api/attributes'
import type { Attribute } from '@/api/attributes'
import type { SpecValue } from '@/api/products'
import { markInactive } from '@/lib/active-only'

export interface SpecMutations {
  set: (body: { attributeId: string; attributeValueId?: string; valueText?: string; valueNumber?: number; valueBoolean?: boolean }) => Promise<unknown>
  clear: (attributeId: string) => Promise<unknown>
}

export interface SpecAttributeFieldProps {
  attribute: Attribute
  values: SpecValue[]
  mutations: SpecMutations
  /** The attribute has been deactivated but this record still carries a value for it. */
  inactive?: boolean
}

/**
 * One attribute's input in the Specs tab, rendered from `dataType` — spec §6: "reject nothing
 * client-side that the server would accept." There's no client-side validation of the value
 * against anything beyond the input's own type (a number field can't type letters into it, but
 * whatever it holds is submitted as-is).
 */
function SpecAttributeField({ attribute, values, mutations, inactive }: SpecAttributeFieldProps) {
  const name = markInactive(attribute.name, !inactive)
  const inputId = React.useId()
  const current = values.find((v) => v.attributeId === attribute.id)
  const dataType = attribute.dataType

  const resetKey = `${current?.id}:${current?.valueText}:${current?.valueNumber}`
  const [text, setText] = useKeyedState(resetKey, () => current?.valueText ?? '')
  const [number, setNumber] = useKeyedState(
    resetKey,
    () => current?.valueNumber?.toString() ?? ''
  )

  const valuesQuery = useAttributeValuesQuery(
    attribute.id,
    dataType === 'SINGLE_SELECT' || dataType === 'MULTI_SELECT'
  )
  const options = (valuesQuery.data ?? []).map((v) => ({ value: v.id!, label: v.label! }))

  if (dataType === 'TEXT') {
    return (
      <div className="flex flex-col gap-1.5">
        <Label htmlFor={inputId}>{name}</Label>
        <Input
          id={inputId}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onBlur={() => {
            if (text.trim() === '') {
              mutations.clear(attribute.id!).catch((error) => toastApiError(error))
            } else {
              mutations
                .set({ attributeId: attribute.id!, valueText: text })
                .catch((error) => toastApiError(error))
            }
          }}
        />
      </div>
    )
  }

  if (dataType === 'NUMBER') {
    return (
      <div className="flex flex-col gap-1.5">
        <Label htmlFor={inputId}>
          {name}
          {attribute.unit ? ` (${attribute.unit})` : ''}
        </Label>
        <Input
          id={inputId}
          inputMode="decimal"
          value={number}
          onChange={(e) => setNumber(e.target.value)}
          onBlur={() => {
            const parsed = Number.parseFloat(number)
            if (number.trim() === '' || Number.isNaN(parsed)) {
              mutations.clear(attribute.id!).catch((error) => toastApiError(error))
            } else {
              mutations
                .set({ attributeId: attribute.id!, valueNumber: parsed })
                .catch((error) => toastApiError(error))
            }
          }}
        />
      </div>
    )
  }

  if (dataType === 'BOOLEAN') {
    return (
      <div className="flex items-center gap-2">
        <Switch
          id={inputId}
          checked={!!current?.valueBoolean}
          onCheckedChange={(checked) =>
            mutations
              .set({ attributeId: attribute.id!, valueBoolean: !!checked })
              .catch((error) => toastApiError(error))
          }
        />
        <Label htmlFor={inputId}>{name}</Label>
      </div>
    )
  }

  if (dataType === 'SINGLE_SELECT') {
    return (
      <div className="flex flex-col gap-1.5">
        <Label htmlFor={inputId}>{name}</Label>
        <Select
          value={current?.attributeValueId ?? ''}
          onValueChange={(value) =>
            mutations
              .set({ attributeId: attribute.id!, attributeValueId: value })
              .catch((error) => toastApiError(error))
          }
        >
          <SelectTrigger id={inputId}>
            <SelectValue placeholder="Choose a value" />
          </SelectTrigger>
          <SelectContent>
            {options.map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    )
  }

  // MULTI_SELECT: the contract's set/clear pair is keyed by attributeId alone, with no per-value
  // remove — "adds" on set, and clear removes every value for the attribute at once. Removing one
  // of several selected values therefore clears them all and re-adds the ones that remain, rather
  // than one direct per-value call — a real constraint of the two endpoints available, not
  // something this UI works around silently.
  const currentValueIds = values.filter((v) => v.attributeId === attribute.id).map((v) => v.attributeValueId!)
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={inputId}>{name}</Label>
      <MultiSelect
        id={inputId}
        options={options}
        value={currentValueIds}
        onValueChange={async (nextIds) => {
          const removed = currentValueIds.filter((id) => !nextIds.includes(id))
          try {
            if (removed.length > 0) {
              await mutations.clear(attribute.id!)
              for (const id of nextIds) {
                await mutations.set({ attributeId: attribute.id!, attributeValueId: id })
              }
            } else {
              const added = nextIds.filter((id) => !currentValueIds.includes(id))
              for (const id of added) {
                await mutations.set({ attributeId: attribute.id!, attributeValueId: id })
              }
            }
          } catch (error) {
            toastApiError(error)
          }
        }}
      />
    </div>
  )
}

export { SpecAttributeField }
