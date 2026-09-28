import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { MoneyInput } from '@/components/form/MoneyInput'
import { toastApiError } from '@/lib/api-error'
import { sellingPriceExceedsMrp } from '@/lib/money'
import { useKeyedState } from '@/lib/use-keyed-state'
import { useUpdateVariantMutation, type Variant } from '@/api/products'

/** INR only — multi-currency is out of MVP scope (DECISIONS.md §10). */
const CURRENCY = 'INR'

function toIntOrUndefined(text: string): number | undefined {
  const trimmed = text.trim()
  if (trimmed === '') {
    return undefined
  }
  const value = Number.parseInt(trimmed, 10)
  return Number.isNaN(value) ? undefined : value
}

function toNumberOrUndefined(text: string): number | undefined {
  const trimmed = text.trim()
  if (trimmed === '') {
    return undefined
  }
  const value = Number.parseFloat(trimmed)
  return Number.isNaN(value) ? undefined : value
}

export interface VariantFieldsFormProps {
  productId: string
  variant: Variant
  /** `ProductResponse.skuCodesEditable` — true until the product has ever been ACTIVE (spec §5). */
  skuCodesEditable: boolean
  canWrite: boolean
  /** Hides the "SKU code" label's variant-combination context for a simple product, where this
   * form is presented as the product's own pricing & codes rather than "a variant's" fields. */
  hideOptionCombination?: boolean
  optionLabel?: string
  onSaved?: () => void
}

/**
 * The field set shared by the simple-product "Pricing & codes" section and each row of the
 * Variants table — SKU code, barcode, HSN, GST rate, MRP, base price, weight, dimensions, batch
 * flags. Money fields are `MoneyInput` throughout (D3.2 — minor units, never a plain number).
 *
 * `base_selling_price <= mrp` (D4.11) is shown as an inline warning, never a blocked submit — the
 * server's check constraint is authoritative. `shelf_life_days` only renders once `batchTracked`
 * is on (D4.12). `skuCode` renders read-only with the reason once `skuCodesEditable` is false.
 */
function VariantFieldsForm({
  productId,
  variant,
  skuCodesEditable,
  canWrite,
  optionLabel,
  onSaved,
}: VariantFieldsFormProps) {
  const updateVariant = useUpdateVariantMutation(productId, variant.id!)

  // Re-derives every field whenever the server's copy moves (a save landed, or someone else's
  // did) — `version` is the reliable signal, combined with `id` for switching between variants
  // entirely. See `useKeyedState`'s doc comment for why this happens during render, not an effect.
  const resetKey = `${variant.id}:${variant.version}`
  const [skuCode, setSkuCode] = useKeyedState(resetKey, () => variant.skuCode ?? '')
  const [barcode, setBarcode] = useKeyedState(resetKey, () => variant.barcode ?? '')
  const [hsnCode, setHsnCode] = useKeyedState(resetKey, () => variant.hsnCode ?? '')
  const [gstRate, setGstRate] = useKeyedState(resetKey, () => variant.gstRate?.toString() ?? '')
  const [mrpMinor, setMrpMinor] = useKeyedState<number | null>(
    resetKey,
    () => variant.mrp?.amountMinor ?? null
  )
  const [baseSellingPriceMinor, setBaseSellingPriceMinor] = useKeyedState<number | null>(
    resetKey,
    () => variant.baseSellingPrice?.amountMinor ?? null
  )
  const [weightGrams, setWeightGrams] = useKeyedState(
    resetKey,
    () => variant.weightGrams?.toString() ?? ''
  )
  const [lengthMm, setLengthMm] = useKeyedState(resetKey, () => variant.lengthMm?.toString() ?? '')
  const [widthMm, setWidthMm] = useKeyedState(resetKey, () => variant.widthMm?.toString() ?? '')
  const [heightMm, setHeightMm] = useKeyedState(resetKey, () => variant.heightMm?.toString() ?? '')
  const [batchTracked, setBatchTracked] = useKeyedState(resetKey, () => !!variant.batchTracked)
  const [shelfLifeDays, setShelfLifeDays] = useKeyedState(
    resetKey,
    () => variant.shelfLifeDays?.toString() ?? ''
  )

  const mrpExceeded =
    mrpMinor !== null &&
    baseSellingPriceMinor !== null &&
    sellingPriceExceedsMrp(baseSellingPriceMinor, mrpMinor)

  function handleSave() {
    updateVariant
      .mutateAsync({
        skuCode,
        barcode: barcode || undefined,
        hsnCode: hsnCode || undefined,
        gstRate: toNumberOrUndefined(gstRate),
        mrp: mrpMinor !== null ? { amountMinor: mrpMinor, currency: CURRENCY } : undefined,
        baseSellingPrice:
          baseSellingPriceMinor !== null
            ? { amountMinor: baseSellingPriceMinor, currency: CURRENCY }
            : undefined,
        weightGrams: toIntOrUndefined(weightGrams),
        lengthMm: toIntOrUndefined(lengthMm),
        widthMm: toIntOrUndefined(widthMm),
        heightMm: toIntOrUndefined(heightMm),
        batchTracked,
        shelfLifeDays: batchTracked ? toIntOrUndefined(shelfLifeDays) : undefined,
        version: variant.version!,
      })
      .then(() => {
        toast.success('Saved')
        onSaved?.()
      })
      .catch((error) => toastApiError(error))
  }

  const idPrefix = `variant-${variant.id}`

  return (
    <div className="flex flex-col gap-4">
      {optionLabel && (
        <p className="text-sm font-medium text-muted-foreground">{optionLabel}</p>
      )}
      {variant.missingForSale && variant.missingForSale.length > 0 && (
        <p className="rounded-md border border-amber-300 bg-amber-50 p-2 text-sm text-amber-900">
          Not ready for approval — missing: {variant.missingForSale.join(', ')}.
        </p>
      )}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`${idPrefix}-sku`}>SKU code</Label>
          <Input
            id={`${idPrefix}-sku`}
            className="font-mono"
            value={skuCode}
            disabled={!canWrite || !skuCodesEditable}
            onChange={(e) => setSkuCode(e.target.value)}
          />
          {!skuCodesEditable && (
            <p className="text-xs text-muted-foreground">
              Frozen — this product has been ACTIVE, and the code is already on warehouse labels
              and GRNs.
            </p>
          )}
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`${idPrefix}-barcode`}>Barcode</Label>
          <Input
            id={`${idPrefix}-barcode`}
            value={barcode}
            disabled={!canWrite}
            onChange={(e) => setBarcode(e.target.value)}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`${idPrefix}-hsn`}>HSN code</Label>
          <Input
            id={`${idPrefix}-hsn`}
            value={hsnCode}
            disabled={!canWrite}
            onChange={(e) => setHsnCode(e.target.value)}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`${idPrefix}-gst`}>GST rate (%)</Label>
          <Input
            id={`${idPrefix}-gst`}
            inputMode="decimal"
            value={gstRate}
            disabled={!canWrite}
            onChange={(e) => setGstRate(e.target.value)}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`${idPrefix}-mrp`}>MRP</Label>
          <MoneyInput
            id={`${idPrefix}-mrp`}
            valueMinor={mrpMinor}
            onValueMinorChange={setMrpMinor}
            disabled={!canWrite}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`${idPrefix}-price`}>Base selling price</Label>
          <MoneyInput
            id={`${idPrefix}-price`}
            valueMinor={baseSellingPriceMinor}
            onValueMinorChange={setBaseSellingPriceMinor}
            disabled={!canWrite}
          />
          {mrpExceeded && (
            <p className="text-xs text-destructive">
              Above MRP — the server will refuse this (D4.11). Shown as a hint only.
            </p>
          )}
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`${idPrefix}-weight`}>Weight (g)</Label>
          <Input
            id={`${idPrefix}-weight`}
            inputMode="numeric"
            value={weightGrams}
            disabled={!canWrite}
            onChange={(e) => setWeightGrams(e.target.value)}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`${idPrefix}-length`}>Length (mm)</Label>
          <Input
            id={`${idPrefix}-length`}
            inputMode="numeric"
            value={lengthMm}
            disabled={!canWrite}
            onChange={(e) => setLengthMm(e.target.value)}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`${idPrefix}-width`}>Width (mm)</Label>
          <Input
            id={`${idPrefix}-width`}
            inputMode="numeric"
            value={widthMm}
            disabled={!canWrite}
            onChange={(e) => setWidthMm(e.target.value)}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`${idPrefix}-height`}>Height (mm)</Label>
          <Input
            id={`${idPrefix}-height`}
            inputMode="numeric"
            value={heightMm}
            disabled={!canWrite}
            onChange={(e) => setHeightMm(e.target.value)}
          />
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-6">
        <div className="flex items-center gap-2">
          <Switch
            id={`${idPrefix}-batch-tracked`}
            checked={batchTracked}
            disabled={!canWrite}
            onCheckedChange={(checked) => setBatchTracked(!!checked)}
          />
          <Label htmlFor={`${idPrefix}-batch-tracked`}>Batch tracked</Label>
        </div>
        {batchTracked && (
          <div className="flex flex-col gap-1.5">
            <Label htmlFor={`${idPrefix}-shelf-life`}>Shelf life (days)</Label>
            <Input
              id={`${idPrefix}-shelf-life`}
              inputMode="numeric"
              className="w-32"
              value={shelfLifeDays}
              disabled={!canWrite}
              onChange={(e) => setShelfLifeDays(e.target.value)}
            />
          </div>
        )}
      </div>

      <div>
        <Button type="button" disabled={!canWrite || updateVariant.isPending} onClick={handleSave}>
          Save
        </Button>
      </div>
    </div>
  )
}

export { VariantFieldsForm }
