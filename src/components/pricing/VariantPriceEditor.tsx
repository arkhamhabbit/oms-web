import * as React from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { MoneyInput } from '@/components/form/MoneyInput'
import { NoticeBanner, noticeFromError, type Notice } from '@/components/common/NoticeBanner'
import { formatMoney } from '@/lib/money'
import { priceAboveBase, pricesRequest } from '@/lib/pricing'
import { useKeyedState } from '@/lib/use-keyed-state'
import { PRICING_LEVELS } from '@/api/enums.gen'
import {
  useSetVariantPricesMutation,
  useVariantPricesQuery,
  type PricingLevel,
  type VariantPrices,
} from '@/api/pricing'

const LEVEL_COPY: Record<PricingLevel, { label: string; help: string }> = {
  MEMBER: {
    label: 'Member price',
    help: 'What tiers on the member level pay.',
  },
  LOWEST: {
    label: 'Lowest price',
    help: 'The top tier pays this or the member price, whichever is lower.',
  },
}

/**
 * One variant's prices in one version, beside the MRP and base selling price they are checked
 * against. On a draft the levels are editable and saved in one write that *replaces* the
 * variant's prices; an empty level pays the base selling price. `price ≤ base ≤ MRP` is shown as a
 * hint and enforced by the server, whose refusal is shown as its own sentence right here, next to
 * the Save that caused it (a stale draft `version` gets the shared Reload banner, D2.24).
 */
function VariantPriceEditor({
  versionId,
  variantId,
  editable,
  onClose,
}: {
  versionId: string
  variantId: string
  editable: boolean
  onClose: () => void
}) {
  const prices = useVariantPricesQuery(versionId, variantId)
  const queryClient = useQueryClient()
  const [notice, setNotice] = React.useState<Notice | undefined>()

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-2">
        <div className="flex flex-col gap-1.5">
          <CardTitle>
            {prices.data ? (
              <>
                <span className="font-mono">{prices.data.skuCode}</span> · {prices.data.variantName}
              </>
            ) : (
              'Variant prices'
            )}
          </CardTitle>
          {prices.data && (
            <CardDescription>
              MRP {formatMoney(prices.data.mrp)} · base selling price{' '}
              {formatMoney(prices.data.baseSellingPrice)}. A tier never pays more than the base.
            </CardDescription>
          )}
        </div>
        <Button size="sm" variant="ghost" onClick={onClose}>
          Close
        </Button>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {notice && (
          <NoticeBanner
            notice={notice}
            onReload={() => {
              setNotice(undefined)
              // The draft's version moves with every price edit anywhere in it, so refresh all of it.
              void queryClient.invalidateQueries({ queryKey: ['pricing'] })
            }}
            onDismiss={() => setNotice(undefined)}
          />
        )}
        {prices.isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}
        {prices.isError && (
          <p role="alert" className="text-sm text-destructive">
            These prices could not be loaded.
          </p>
        )}
        {prices.data && (
          <LevelForm
            data={prices.data}
            versionId={versionId}
            variantId={variantId}
            editable={editable}
            onNotice={setNotice}
          />
        )}
      </CardContent>
    </Card>
  )
}

function LevelForm({
  data,
  versionId,
  variantId,
  editable,
  onNotice,
}: {
  data: VariantPrices
  versionId: string
  variantId: string
  editable: boolean
  onNotice: (notice: Notice | undefined) => void
}) {
  const save = useSetVariantPricesMutation(versionId, variantId)
  const stored = React.useMemo(
    () =>
      Object.fromEntries(
        (data.prices ?? []).map((p) => [p.level, p.price?.amountMinor ?? null])
      ) as Partial<Record<PricingLevel, number | null>>,
    [data.prices]
  )
  // Reset whenever the server's copy moves (a save landed, or someone else priced this draft).
  const [values, setValues] = useKeyedState(`${variantId}:${data.version}`, () => stored)
  const base = data.baseSellingPrice?.amountMinor
  const dirty = PRICING_LEVELS.some((level) => (values[level] ?? null) !== (stored[level] ?? null))

  function submit(event: React.FormEvent) {
    event.preventDefault()
    save
      .mutateAsync({
        version: data.version!,
        prices: pricesRequest(
          PRICING_LEVELS.map((level) => ({ level, amountMinor: values[level] ?? null })),
          data.currency ?? 'INR'
        ),
      })
      .then(() => {
        onNotice(undefined)
        toast.success('Prices saved')
      })
      .catch((error) => onNotice(noticeFromError(error, 'This draft')))
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      {PRICING_LEVELS.map((level) => {
        const value = values[level] ?? null
        const id = `price-${level}`
        return (
          <div key={level} className="grid max-w-md gap-1.5">
            <Label htmlFor={id}>{LEVEL_COPY[level].label}</Label>
            {editable ? (
              <MoneyInput
                id={id}
                valueMinor={value}
                placeholder={`Base: ${formatMoney(data.baseSellingPrice)}`}
                onValueMinorChange={(minor) => setValues((prev) => ({ ...prev, [level]: minor }))}
              />
            ) : (
              <p id={id} className="text-sm">
                {value === null
                  ? `Not set — pays the base selling price`
                  : formatMoney({ amountMinor: value, currency: data.currency })}
              </p>
            )}
            {priceAboveBase(value, base) ? (
              <p className="text-sm text-destructive">
                Above the base selling price ({formatMoney(data.baseSellingPrice)}) — the server
                will refuse it.
              </p>
            ) : (
              <p className="text-xs text-muted-foreground">
                {LEVEL_COPY[level].help}
                {editable && ' Leave empty to pay the base selling price.'}
              </p>
            )}
          </div>
        )
      })}
      {editable && (
        <div>
          <Button type="submit" disabled={!dirty || save.isPending}>
            Save prices
          </Button>
        </div>
      )}
    </form>
  )
}

export { VariantPriceEditor }
