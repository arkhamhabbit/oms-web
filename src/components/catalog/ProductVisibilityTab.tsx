import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { toastApiError } from '@/lib/api-error'
import { useKeyedState } from '@/lib/use-keyed-state'
import {
  useUpdateProductMutation,
  type Product,
  type ProductAudience,
  type ProductListingVisibility,
  type ProductLockedDisplay,
} from '@/api/products'

export interface ProductVisibilityTabProps {
  product: Product
  canWrite: boolean
}

const AUDIENCE_COPY: Record<ProductAudience, string> = {
  PUBLIC: 'Every customer can see this product.',
  TIER_RESTRICTED: 'Only customers in an eligible membership tier can see this product.',
  CUSTOMER_RESTRICTED: 'Only specifically-targeted customers can see this product.',
}

const LISTING_COPY: Record<ProductListingVisibility, string> = {
  LISTED: 'Appears in browse and search results.',
  UNLISTED: 'Reachable only by a direct link — hidden from browse and search.',
}

const LOCKED_COPY: Record<ProductLockedDisplay, string> = {
  SHOW_LOCKED: 'A customer who cannot buy it yet still sees it, shown as locked.',
  HIDE: 'A customer who cannot buy it yet does not see it at all.',
}

/**
 * D4.13's three orthogonal switches, each its own control with a plain-English "what a customer
 * sees" line — never merged into one enum. Tier/customer *targeting* itself (who exactly is
 * eligible) is not built yet (arrives in 1.0d); these three switches exist now and are fully
 * functional, but `TIER_RESTRICTED`/`CUSTOMER_RESTRICTED` currently have no targeting rules behind
 * them to configure from this screen.
 */
function ProductVisibilityTab({ product, canWrite }: ProductVisibilityTabProps) {
  const updateProduct = useUpdateProductMutation(product.id!)

  const resetKey = `${product.id}:${product.version}`
  const [audience, setAudience] = useKeyedState<ProductAudience>(
    resetKey,
    () => product.audience ?? 'PUBLIC'
  )
  const [listingVisibility, setListingVisibility] = useKeyedState<ProductListingVisibility>(
    resetKey,
    () => product.listingVisibility ?? 'LISTED'
  )
  const [lockedDisplay, setLockedDisplay] = useKeyedState<ProductLockedDisplay>(
    resetKey,
    () => product.lockedDisplay ?? 'SHOW_LOCKED'
  )

  const dirty =
    audience !== (product.audience ?? 'PUBLIC') ||
    listingVisibility !== (product.listingVisibility ?? 'LISTED') ||
    lockedDisplay !== (product.lockedDisplay ?? 'SHOW_LOCKED')

  function save() {
    updateProduct
      .mutateAsync({
        name: product.name!,
        slug: product.slug,
        brandId: product.brandId!,
        description: product.description,
        shortDescription: product.shortDescription,
        audience,
        listingVisibility,
        lockedDisplay,
        status: product.status!,
        live: product.live ?? false,
        version: product.version!,
      })
      .then(() => toast.success('Visibility saved'))
      .catch((error) => toastApiError(error))
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Visibility</CardTitle>
        <CardDescription>
          Three independent switches — tier/customer targeting rules themselves arrive with 1.0d;
          these controls exist now but have nothing behind {'"'}restricted{'"'} to configure yet.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-5">
        <div className="flex flex-col gap-1.5">
          <span className="text-sm font-medium">Audience</span>
          <Select
            value={audience}
            onValueChange={(v) => setAudience(v as ProductAudience)}
            disabled={!canWrite}
          >
            <SelectTrigger className="w-64">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="PUBLIC">Public</SelectItem>
              <SelectItem value="TIER_RESTRICTED">Tier restricted</SelectItem>
              <SelectItem value="CUSTOMER_RESTRICTED">Customer restricted</SelectItem>
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">{AUDIENCE_COPY[audience]}</p>
        </div>

        <div className="flex flex-col gap-1.5">
          <span className="text-sm font-medium">Listing visibility</span>
          <Select
            value={listingVisibility}
            onValueChange={(v) => setListingVisibility(v as ProductListingVisibility)}
            disabled={!canWrite}
          >
            <SelectTrigger className="w-64">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="LISTED">Listed</SelectItem>
              <SelectItem value="UNLISTED">Unlisted</SelectItem>
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">{LISTING_COPY[listingVisibility]}</p>
        </div>

        <div className="flex flex-col gap-1.5">
          <span className="text-sm font-medium">Locked display</span>
          <Select
            value={lockedDisplay}
            onValueChange={(v) => setLockedDisplay(v as ProductLockedDisplay)}
            disabled={!canWrite}
          >
            <SelectTrigger className="w-64">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="SHOW_LOCKED">Show, locked</SelectItem>
              <SelectItem value="HIDE">Hide</SelectItem>
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">{LOCKED_COPY[lockedDisplay]}</p>
        </div>

        <div>
          <Button type="button" disabled={!canWrite || !dirty || updateProduct.isPending} onClick={save}>
            Save visibility
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

export { ProductVisibilityTab }
