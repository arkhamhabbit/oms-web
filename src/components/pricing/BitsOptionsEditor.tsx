import * as React from 'react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { MoneyInput } from '@/components/form/MoneyInput'
import { NoticeBanner, noticeFromError, type Notice } from '@/components/common/NoticeBanner'
import { formatMoney } from '@/lib/money'
import { parseWholeNumber } from '@/lib/membership'
import { bitsOptionHint, bitsRequest, tierPriceHint, type BitsDraft } from '@/lib/pricing'
import { useKeyedState } from '@/lib/use-keyed-state'
import { useEffectiveLadderQuery } from '@/api/membership'
import {
  useSetVariantBitsOptionsMutation,
  type PricingLevel,
  type VariantPrices,
} from '@/api/pricing'

const EMPTY: BitsDraft = { points: null, priceMinor: null }

/**
 * One variant's Bits price per tier in a draft (D7.17): a lower price payable only by spending a
 * stated number of Bits. One row per tier code of the ladder in effect (D7.9 — by code, never by
 * the version-specific row id); both fields empty means that tier has no Bits option. Saved in
 * one write that *replaces* the variant's options. The hints beside a field are only hints — the
 * server resolves the real tier price, and its refusal is shown as its own sentence next to the
 * Save that caused it.
 */
function BitsOptionsEditor({
  data,
  versionId,
  variantId,
  editable,
}: {
  data: VariantPrices
  versionId: string
  variantId: string
  editable: boolean
}) {
  const ladder = useEffectiveLadderQuery()
  const save = useSetVariantBitsOptionsMutation(versionId, variantId)
  const [notice, setNotice] = React.useState<Notice | undefined>()

  const stored = React.useMemo(
    () =>
      Object.fromEntries(
        (data.bitsOptions ?? []).map((o) => [
          o.tierCode!.toUpperCase(),
          { points: o.pointsAmount ?? null, priceMinor: o.price?.amountMinor ?? null },
        ])
      ) as Record<string, BitsDraft>,
    [data.bitsOptions]
  )
  // Reset whenever the server's copy moves (a save landed, or someone else edited this draft).
  const [values, setValues] = useKeyedState(`${variantId}:${data.version}`, () => stored)

  // The ladder's tiers, plus any stored option whose code the ladder no longer has — shown, so it
  // can be seen and cleared rather than silently vanishing from the replace.
  const rows = React.useMemo(() => {
    const tiers = (ladder.data ?? []).map((t) => ({
      code: t.code!,
      name: t.name ?? t.code!,
      level: t.pricingLevel as PricingLevel | undefined,
      inLadder: true,
    }))
    const known = new Set(tiers.map((t) => t.code))
    const orphans = Object.keys(stored)
      .filter((code) => !known.has(code))
      .map((code) => ({ code, name: code, level: undefined, inLadder: false }))
    return [...tiers, ...orphans]
  }, [ladder.data, stored])

  const levelPrices = Object.fromEntries(
    (data.prices ?? []).map((p) => [p.level, p.price?.amountMinor ?? null])
  ) as Partial<Record<PricingLevel, number | null>>
  const base = data.baseSellingPrice?.amountMinor

  const same = (a: BitsDraft | undefined, b: BitsDraft | undefined) =>
    (a ?? EMPTY).points === (b ?? EMPTY).points &&
    (a ?? EMPTY).priceMinor === (b ?? EMPTY).priceMinor
  const dirty = rows.some((r) => !same(values[r.code], stored[r.code]))
  const request = bitsRequest(
    rows.map((r) => ({ tierCode: r.code, option: values[r.code] ?? EMPTY })),
    data.currency ?? 'INR'
  )

  function patch(code: string, change: Partial<BitsDraft>) {
    setValues((prev) => ({ ...prev, [code]: { ...(prev[code] ?? EMPTY), ...change } }))
  }

  function submit(event: React.FormEvent) {
    event.preventDefault()
    if (!request) {
      return
    }
    save
      .mutateAsync({ version: data.version!, bitsOptions: request })
      .then(() => {
        setNotice(undefined)
        toast.success('Bits options saved')
      })
      .catch((error) => setNotice(noticeFromError(error, 'This draft')))
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Bits price per tier</CardTitle>
        <CardDescription>
          A lower price a member can choose to pay with Bits instead of money. Set the Bits and the
          price for each tier that should get one; leave a tier empty for no Bits option. The price
          is at least ₹1 and below what that tier pays.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {notice && (
          <NoticeBanner
            notice={notice}
            onReload={() => setNotice(undefined)}
            onDismiss={() => setNotice(undefined)}
          />
        )}
        {ladder.isLoading && <p className="text-sm text-muted-foreground">Loading tiers…</p>}
        {ladder.isError && (
          <p role="alert" className="text-sm text-destructive">
            The tier ladder could not be loaded.
          </p>
        )}
        <form
          key={`${variantId}:${data.version}`}
          onSubmit={submit}
          className="flex flex-col gap-4"
        >
          {rows.map((row) => {
            const value = values[row.code] ?? EMPTY
            const tierPrice = tierPriceHint(row.level, levelPrices, base)
            const hint = editable ? bitsOptionHint(value, tierPrice) : undefined
            const id = `bits-${row.code}`
            return (
              <fieldset
                key={row.code}
                aria-label={`${row.name} Bits option`}
                className="grid gap-3 rounded-md border p-3 sm:grid-cols-3"
              >
                <div className="flex flex-col justify-center gap-0.5">
                  <span className="text-sm font-medium">{row.name}</span>
                  <span className="font-mono text-xs text-muted-foreground">{row.code}</span>
                  {tierPrice !== undefined && (
                    <span className="text-xs text-muted-foreground">
                      Pays about {formatMoney({ amountMinor: tierPrice, currency: data.currency })}
                    </span>
                  )}
                  {!row.inLadder && (
                    <span className="text-xs text-destructive">
                      Not in the ladder in effect — clear it.
                    </span>
                  )}
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor={`${id}-points`}>Bits</Label>
                  {editable ? (
                    <Input
                      id={`${id}-points`}
                      inputMode="numeric"
                      defaultValue={value.points === null ? '' : String(value.points)}
                      onChange={(e) =>
                        patch(row.code, { points: parseWholeNumber(e.target.value) })
                      }
                    />
                  ) : (
                    <p id={`${id}-points`} className="text-sm">
                      {value.points === null
                        ? 'No Bits option'
                        : value.points.toLocaleString('en-IN')}
                    </p>
                  )}
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor={`${id}-price`}>Price (₹)</Label>
                  {editable ? (
                    <MoneyInput
                      id={`${id}-price`}
                      valueMinor={value.priceMinor}
                      onValueMinorChange={(minor) => patch(row.code, { priceMinor: minor })}
                    />
                  ) : (
                    <p id={`${id}-price`} className="text-sm">
                      {value.priceMinor === null
                        ? '—'
                        : formatMoney({ amountMinor: value.priceMinor, currency: data.currency })}
                    </p>
                  )}
                </div>
                {hint && <p className="text-sm text-destructive sm:col-span-3">{hint}</p>}
              </fieldset>
            )
          })}
          {editable && (
            <div>
              <Button type="submit" disabled={!dirty || !request || save.isPending}>
                Save Bits options
              </Button>
            </div>
          )}
        </form>
      </CardContent>
    </Card>
  )
}

export { BitsOptionsEditor }
