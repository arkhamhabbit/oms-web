import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { VariantFieldsForm } from '@/components/catalog/VariantFieldsForm'
import type { Variant } from '@/api/products'

export interface PricingCodesSectionProps {
  productId: string
  variant: Variant
  skuCodesEditable: boolean
  canWrite: boolean
}

/**
 * Spec §3: a product with no option axes must never show the word "variant" anywhere in the UI,
 * even though D4.9 means one exists underneath. This edits that single auto-created variant's
 * fields — `VariantFieldsForm` — as if they belonged to the product itself.
 */
function PricingCodesSection({
  productId,
  variant,
  skuCodesEditable,
  canWrite,
}: PricingCodesSectionProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Pricing & codes</CardTitle>
        <CardDescription>
          SKU, barcode, tax codes, pricing and shipping details for this product.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <VariantFieldsForm
          productId={productId}
          variant={variant}
          skuCodesEditable={skuCodesEditable}
          canWrite={canWrite}
        />
      </CardContent>
    </Card>
  )
}

export { PricingCodesSection }
