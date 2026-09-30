import * as React from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { NoticeBanner, noticeFromError, type Notice } from '@/components/common/NoticeBanner'
import { ProductAllowlistCard } from '@/components/catalog/ProductAllowlistCard'
import { usePermissions } from '@/auth/usePermissions'
import { useKeyedState } from '@/lib/use-keyed-state'
import { requiredTierCodeFor, visibilitySaveProblem } from '@/lib/visibility'
import { PRODUCT_AUDIENCES } from '@/api/enums.gen'
import { useEffectiveLadderQuery } from '@/api/membership'
import {
  productQueryKey,
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

const AUDIENCE_LABEL: Record<ProductAudience, string> = {
  PUBLIC: 'Public',
  TIER_RESTRICTED: 'Tier restricted',
  CUSTOMER_RESTRICTED: 'Customer restricted',
}

const AUDIENCE_COPY: Record<ProductAudience, string> = {
  PUBLIC: 'Every customer can see this product.',
  TIER_RESTRICTED: 'Only customers at or above the required membership tier can see this product.',
  CUSTOMER_RESTRICTED: 'Only the customers on this product’s allowlist can see it.',
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
 * sees" line — never merged into one enum — plus what each restricted audience is restricted
 * *to*: the required tier (by stable code, D7.9) and the customer allowlist (1.0d).
 */
function ProductVisibilityTab({ product, canWrite }: ProductVisibilityTabProps) {
  const updateProduct = useUpdateProductMutation(product.id!)
  const queryClient = useQueryClient()
  const { has } = usePermissions()
  const canReadLadder = has('membership.read')
  const ladder = useEffectiveLadderQuery(canReadLadder)
  const [notice, setNotice] = React.useState<Notice | undefined>()

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
  const [tierCode, setTierCode] = useKeyedState<string | undefined>(
    resetKey,
    () => product.requiredTierCode ?? undefined
  )

  const tiers = ladder.data ?? []
  // D4.17(2): a stored tier the ladder in effect no longer has fails closed and hidden. Keep it
  // selectable so the operator can see what is stored, flagged, rather than silently blanking it.
  const storedTierMissing =
    !!product.requiredTierCode &&
    ladder.isSuccess &&
    !tiers.some((t) => t.code === product.requiredTierCode)

  const sentTierCode = requiredTierCodeFor(audience, tierCode)
  const problem = visibilitySaveProblem(audience, tierCode)
  const dirty =
    audience !== (product.audience ?? 'PUBLIC') ||
    listingVisibility !== (product.listingVisibility ?? 'LISTED') ||
    lockedDisplay !== (product.lockedDisplay ?? 'SHOW_LOCKED') ||
    sentTierCode !== (product.requiredTierCode ?? undefined)

  function save() {
    if (problem) {
      return
    }
    setNotice(undefined)
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
        requiredTierCode: sentTierCode,
        status: product.status!,
        live: product.live ?? false,
        version: product.version!,
      })
      .then(() => toast.success('Visibility saved'))
      .catch((error) => setNotice(noticeFromError(error, 'This product')))
  }

  function reload() {
    setNotice(undefined)
    void queryClient.invalidateQueries({ queryKey: productQueryKey(product.id) })
  }

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader>
          <CardTitle>Visibility</CardTitle>
          <CardDescription>
            Three independent switches: who may see the product, whether it is browsable, and what a
            customer who cannot buy it yet is shown.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-5">
          {notice && (
            <NoticeBanner
              notice={notice}
              onReload={reload}
              onDismiss={() => setNotice(undefined)}
            />
          )}

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="visibility-audience">Audience</Label>
            <Select
              value={audience}
              onValueChange={(v) => setAudience(v as ProductAudience)}
              disabled={!canWrite}
            >
              <SelectTrigger id="visibility-audience" className="w-64">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PRODUCT_AUDIENCES.map((a) => (
                  <SelectItem key={a} value={a}>
                    {AUDIENCE_LABEL[a]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">{AUDIENCE_COPY[audience]}</p>
          </div>

          {audience === 'TIER_RESTRICTED' && (
            <div className="flex flex-col gap-1.5 border-l-2 pl-4">
              <Label htmlFor="visibility-tier">Required tier</Label>
              {canReadLadder ? (
                <Select
                  value={tierCode ?? ''}
                  onValueChange={(v) => setTierCode(v || undefined)}
                  disabled={!canWrite || ladder.isLoading}
                >
                  <SelectTrigger
                    id="visibility-tier"
                    className="w-64"
                    aria-invalid={!!problem || undefined}
                  >
                    <SelectValue
                      placeholder={ladder.isLoading ? 'Loading tiers…' : 'Choose a tier'}
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {tiers.map((t) => (
                      <SelectItem key={t.code} value={t.code!}>
                        {t.name} ({t.code})
                      </SelectItem>
                    ))}
                    {storedTierMissing && (
                      <SelectItem value={product.requiredTierCode!}>
                        {product.requiredTierCode} — not in the ladder in effect
                      </SelectItem>
                    )}
                  </SelectContent>
                </Select>
              ) : (
                <p className="text-sm">
                  {tierCode ?? 'None set'}{' '}
                  <span className="text-xs text-muted-foreground">
                    — choosing a tier needs the <code>membership.read</code> permission to list
                    them.
                  </span>
                </p>
              )}
              {problem ? (
                <p className="text-sm text-destructive">{problem}</p>
              ) : (
                <p className="text-xs text-muted-foreground">
                  Customers at this tier or any higher one see it; the tier is matched by its code,
                  so it survives a new membership version.
                </p>
              )}
              {storedTierMissing && (
                <p className="text-sm text-destructive">
                  The ladder in effect has no {product.requiredTierCode} tier, so this product is
                  hidden from everyone until a tier that exists is chosen.
                </p>
              )}
            </div>
          )}

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="visibility-listing">Listing visibility</Label>
            <Select
              value={listingVisibility}
              onValueChange={(v) => setListingVisibility(v as ProductListingVisibility)}
              disabled={!canWrite}
            >
              <SelectTrigger id="visibility-listing" className="w-64">
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
            <Label htmlFor="visibility-locked">Locked display</Label>
            <Select
              value={lockedDisplay}
              onValueChange={(v) => setLockedDisplay(v as ProductLockedDisplay)}
              disabled={!canWrite}
            >
              <SelectTrigger id="visibility-locked" className="w-64">
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
            <Button
              type="button"
              disabled={!canWrite || !dirty || !!problem || updateProduct.isPending}
              onClick={save}
            >
              Save visibility
            </Button>
          </div>
        </CardContent>
      </Card>

      <ProductAllowlistCard
        productId={product.id!}
        restricted={(product.audience ?? 'PUBLIC') === 'CUSTOMER_RESTRICTED'}
        canWrite={canWrite}
      />
    </div>
  )
}

export { ProductVisibilityTab }
