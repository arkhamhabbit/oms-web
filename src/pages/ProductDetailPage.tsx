import * as React from 'react'
import { useParams } from 'react-router-dom'

import { Button } from '@/components/ui/button'
import { CatalogStatusBadges } from '@/components/catalog/CatalogStatusBadges'
import { ProductDetailsTab } from '@/components/catalog/ProductDetailsTab'
import { ProductOptionsTab } from '@/components/catalog/ProductOptionsTab'
import { PricingCodesSection } from '@/components/catalog/PricingCodesSection'
import { VariantsTab } from '@/components/catalog/VariantsTab'
import { ProductSpecsTab } from '@/components/catalog/ProductSpecsTab'
import { ProductImagesTab } from '@/components/catalog/ProductImagesTab'
import { ProductContentTab } from '@/components/content/ProductContentTab'
import { ProductMerchandisingTab } from '@/components/catalog/ProductMerchandisingTab'
import { ProductVisibilityTab } from '@/components/catalog/ProductVisibilityTab'
import { ArchivedNotice, RestoreButton } from '@/components/catalog/RestoreButton'
import { ProductTransitionMenu } from '@/components/catalog/ProductTransitionMenu'
import { useBreadcrumb } from '@/layouts/breadcrumb-context'
import { usePermissions } from '@/auth/usePermissions'
import type { CatalogStatus } from '@/lib/catalog-transitions'
import { useProductQuery, useRestoreProductMutation } from '@/api/products'

type Tab =
  | 'details'
  | 'options'
  | 'variants'
  | 'specs'
  | 'images'
  | 'content'
  | 'merchandising'
  | 'visibility'

function ProductDetailPage() {
  const { id } = useParams<{ id: string }>()
  const { has } = usePermissions()
  const hasWrite = has('catalog.product.write')
  const canApprove = has('catalog.product.approve')
  const canPublish = has('catalog.product.publish')

  const productQuery = useProductQuery(id)
  const restore = useRestoreProductMutation(id ?? '')
  const detail = productQuery.data
  const product = detail?.product

  useBreadcrumb([{ label: 'Products', to: '/products' }, { label: product?.name ?? 'Product' }])

  const [tab, setTab] = React.useState<Tab>('details')

  if (productQuery.isLoading) {
    return <p className="text-sm text-muted-foreground">Loading…</p>
  }
  if (!detail || !product) {
    return <p className="text-sm text-muted-foreground">Product not found.</p>
  }

  // An archived product is read-only (D4.23): every edit control below is disabled until it is restored.
  const archived = product.status === 'ARCHIVED'
  const canWrite = hasWrite && !archived
  const options = detail.options ?? []
  const variants = detail.variants ?? []
  const categories = detail.categories ?? []
  // D4.9: a simple product has no option axes and exactly one variant — the UI must never say
  // "variant" for it (spec §3). Everything downstream keys off this, not off `variants.length`
  // directly, so the moment an axis is added the whole page switches vocabulary at once.
  const isSimple = options.length === 0
  const defaultVariant = variants.find((v) => v.isDefault) ?? variants[0]

  const tabs: { key: Tab; label: string }[] = [
    { key: 'details', label: 'Details' },
    { key: 'options', label: 'Options' },
    { key: 'variants', label: isSimple ? 'Pricing & codes' : 'Variants' },
    { key: 'specs', label: 'Specs' },
    { key: 'images', label: 'Images' },
    { key: 'content', label: 'Content' },
    { key: 'merchandising', label: 'Merchandising' },
    { key: 'visibility', label: 'Visibility' },
  ]

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-semibold">{product.name}</h1>
          <CatalogStatusBadges status={product.status as CatalogStatus} live={!!product.live} />
        </div>
        <div className="flex items-start gap-2">
          <ProductTransitionMenu
            product={product}
            canWrite={canWrite}
            canApprove={canApprove}
            canPublish={canPublish}
          />
          <RestoreButton
            className="flex flex-col items-end gap-1"
            status={product.status}
            canPublish={canPublish}
            noun="product"
            name={product.name ?? 'This product'}
            onRestore={() => restore.mutateAsync(product.version!)}
          />
        </div>
      </div>
      {archived && <ArchivedNotice />}

      <div className="flex gap-2 border-b pb-2">
        {tabs.map((t) => (
          <Button
            key={t.key}
            variant={tab === t.key ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setTab(t.key)}
          >
            {t.label}
          </Button>
        ))}
      </div>

      {tab === 'details' && (
        <ProductDetailsTab product={product} categories={categories} canWrite={canWrite} />
      )}
      {tab === 'options' && (
        <ProductOptionsTab
          productId={product.id!}
          options={options}
          defaultVariant={defaultVariant}
          variantCount={variants.length}
          canWrite={canWrite}
        />
      )}
      {tab === 'variants' &&
        (isSimple ? (
          defaultVariant ? (
            <PricingCodesSection
              productId={product.id!}
              variant={defaultVariant}
              skuCodesEditable={!!product.skuCodesEditable}
              canWrite={canWrite}
              productAudience={product.audience ?? 'PUBLIC'}
              productRequiredTierCode={product.requiredTierCode ?? undefined}
            />
          ) : (
            <p className="text-sm text-muted-foreground">No default variant found.</p>
          )
        ) : (
          <VariantsTab
            productId={product.id!}
            variants={variants}
            options={options}
            skuCodesEditable={!!product.skuCodesEditable}
            canWrite={canWrite}
            productAudience={product.audience ?? 'PUBLIC'}
            productRequiredTierCode={product.requiredTierCode ?? undefined}
          />
        ))}
      {tab === 'specs' && (
        <ProductSpecsTab productId={product.id!} variants={variants} isSimple={isSimple} />
      )}
      {tab === 'images' && (
        <ProductImagesTab productId={product.id!} variants={variants} isSimple={isSimple} />
      )}
      {tab === 'content' && (
        <ProductContentTab
          productId={product.id!}
          variants={variants}
          isSimple={isSimple}
          canWrite={canWrite}
        />
      )}
      {tab === 'merchandising' && (
        <ProductMerchandisingTab
          productId={product.id!}
          variants={variants}
          isSimple={isSimple}
          canWrite={canWrite}
        />
      )}
      {tab === 'visibility' && <ProductVisibilityTab product={product} canWrite={canWrite} />}
    </div>
  )
}

export default ProductDetailPage
