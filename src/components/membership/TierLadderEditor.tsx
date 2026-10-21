import { PlusIcon, Trash2Icon } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { MoneyInput } from '@/components/form/MoneyInput'
import type { ApiFieldError } from '@/lib/api-error'
import { blankTierDraft, maintainHint, parseWholeNumber, type TierDraft } from '@/lib/membership'

/** A whole-number text input that reports `null` while empty or not a plain non-negative integer. */
function NumberField({
  id,
  value,
  onChange,
  disabled,
  invalid,
}: {
  id: string
  value: number | null
  onChange: (value: number | null) => void
  disabled?: boolean
  invalid?: boolean
}) {
  return (
    <Input
      id={id}
      inputMode="numeric"
      disabled={disabled}
      aria-invalid={invalid || undefined}
      defaultValue={value === null ? '' : String(value)}
      onChange={(event) => onChange(parseWholeNumber(event.target.value))}
    />
  )
}

function FieldMessage({ text }: { text: string | undefined }) {
  return text ? <p className="text-xs text-destructive">{text}</p> : null
}

/**
 * The ladder as a stack of tier cards, lowest first. Each tier carries a **reach** threshold, a
 * **maintain** threshold (D7.15) and the benefit parameters, Carrots per friend order among them
 * (D7.16). The hints under a field mirror the server's rules; the server's own sentences, keyed
 * `tiers[i].field`, are shown beside them once it has refused a save.
 */
function TierLadderEditor({
  tiers,
  onChange,
  readOnly,
  serverErrors,
}: {
  tiers: TierDraft[]
  onChange: (tiers: TierDraft[]) => void
  readOnly?: boolean
  serverErrors?: ApiFieldError[]
}) {
  // Whatever tier is first starts everyone off and has nothing below it: reach 0, maintain 0.
  function emit(next: TierDraft[]) {
    onChange(
      next.map((tier, i) =>
        i === 0 ? { ...tier, thresholdPoints12mo: 0, maintainThresholdPoints: 0 } : tier
      )
    )
  }
  function patch(index: number, change: Partial<TierDraft>) {
    emit(tiers.map((tier, i) => (i === index ? { ...tier, ...change } : tier)))
  }
  function serverError(index: number, field: string) {
    return serverErrors?.find((e) => e.field === `tiers[${index}].${field}`)?.message
  }

  return (
    <div className="flex flex-col gap-4">
      {tiers.map((tier, index) => {
        const id = (name: string) => `${tier.key}-${name}`
        const hint = maintainHint(index, tier.maintainThresholdPoints, tier.thresholdPoints12mo)
        const maintainError = serverError(index, 'maintainThresholdPoints')
        return (
          <fieldset
            key={tier.key}
            aria-label={`Tier ${index + 1}`}
            className="grid gap-4 rounded-md border p-4 sm:grid-cols-2 lg:grid-cols-3"
          >
            <div className="grid gap-1.5">
              <Label htmlFor={id('name')}>Name</Label>
              <Input
                id={id('name')}
                value={tier.name}
                disabled={readOnly}
                onChange={(e) => patch(index, { name: e.target.value })}
              />
              <FieldMessage text={serverError(index, 'name')} />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor={id('code')}>Code</Label>
              <Input
                id={id('code')}
                className="font-mono"
                value={tier.code}
                disabled={readOnly}
                onChange={(e) => patch(index, { code: e.target.value.toUpperCase() })}
              />
              <p className="text-xs text-muted-foreground">
                Stable across versions — pricing and visibility refer to it.
              </p>
              <FieldMessage text={serverError(index, 'code')} />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor={id('pricing')}>Pricing level</Label>
              <Select
                value={tier.pricingLevel}
                disabled={readOnly}
                onValueChange={(v) =>
                  patch(index, { pricingLevel: v as TierDraft['pricingLevel'] })
                }
              >
                <SelectTrigger id={id('pricing')} className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="MEMBER">Member</SelectItem>
                  <SelectItem value="LOWEST">Lowest</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-1.5">
              <Label htmlFor={id('reach')}>Reach threshold (Bits in a cycle)</Label>
              <NumberField
                key={index === 0 ? 'base' : 'other'}
                id={id('reach')}
                value={tier.thresholdPoints12mo}
                disabled={readOnly || index === 0}
                invalid={!!serverError(index, 'thresholdPoints12mo')}
                onChange={(v) => patch(index, { thresholdPoints12mo: v })}
              />
              <p className="text-xs text-muted-foreground">
                {index === 0
                  ? 'The first tier is where everyone starts — 0.'
                  : 'Earning this in a cycle promotes the member at once.'}
              </p>
              <FieldMessage text={serverError(index, 'thresholdPoints12mo')} />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor={id('maintain')}>Maintain threshold (Bits in a cycle)</Label>
              {/* The base tier has nothing to drop to, so its maintain is fixed at 0. */}
              <NumberField
                key={index === 0 ? 'base' : 'other'}
                id={id('maintain')}
                value={tier.maintainThresholdPoints}
                disabled={readOnly || index === 0}
                invalid={!!hint || !!maintainError}
                onChange={(v) => patch(index, { maintainThresholdPoints: v })}
              />
              <p className="text-xs text-muted-foreground">
                {index === 0
                  ? 'Always 0 — nothing below the first tier to drop to.'
                  : 'Earn at least this in a cycle to keep the tier; short of it the member drops one tier.'}
              </p>
              {hint && <p className="text-xs text-destructive">{hint}</p>}
              <FieldMessage text={maintainError} />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor={id('carrots')}>Carrots per friend order (₹)</Label>
              <MoneyInput
                id={id('carrots')}
                disabled={readOnly}
                valueMinor={tier.carrotsPerFriendOrderMinor}
                onValueMinorChange={(v) => patch(index, { carrotsPerFriendOrderMinor: v })}
              />
              <p className="text-xs text-muted-foreground">
                Referral Carrots when a friend this member invited places an order. 0 or more.
              </p>
              <FieldMessage text={serverError(index, 'carrotsPerFriendOrderMinor')} />
            </div>

            <div className="grid gap-1.5">
              <Label htmlFor={id('invites')}>Active invite limit</Label>
              <NumberField
                id={id('invites')}
                value={tier.activeInviteLimit}
                disabled={readOnly}
                invalid={!!serverError(index, 'activeInviteLimit')}
                onChange={(v) => patch(index, { activeInviteLimit: v })}
              />
              <FieldMessage text={serverError(index, 'activeInviteLimit')} />
            </div>
            <div className="flex items-center gap-2 self-end pb-2">
              <Switch
                id={id('shipping')}
                checked={tier.freeShipping}
                disabled={readOnly}
                onCheckedChange={(checked) => patch(index, { freeShipping: checked })}
              />
              <Label htmlFor={id('shipping')}>Free shipping</Label>
            </div>
            {!readOnly && (
              <div className="flex items-end justify-end">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={tiers.length <= 1}
                  onClick={() => emit(tiers.filter((_, i) => i !== index))}
                >
                  <Trash2Icon /> Remove tier
                </Button>
              </div>
            )}
          </fieldset>
        )
      })}
      {!readOnly && (
        <div>
          <Button
            type="button"
            variant="outline"
            disabled={tiers.length >= 20}
            onClick={() => emit([...tiers, blankTierDraft()])}
          >
            <PlusIcon /> Add a tier on top
          </Button>
        </div>
      )}
    </div>
  )
}

export { TierLadderEditor }
