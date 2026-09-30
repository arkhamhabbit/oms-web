import * as React from 'react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { formatMoney } from '@/lib/money'
import { useProductsQuery, useVariantsQuery } from '@/api/products'

/**
 * Finds a variant to price: search the catalog by product name or SKU, then choose one of the
 * product's variants. Needs `catalog.product.read`, which any pricing operator reading SKUs has.
 */
function VariantPicker({ onPick }: { onPick: (variantId: string) => void }) {
  const [search, setSearch] = React.useState('')
  const [productId, setProductId] = React.useState<string | undefined>()
  const trimmed = search.trim()

  return (
    <div className="flex flex-col gap-2">
      <Input
        placeholder="Find a product by name or SKU…"
        aria-label="Find a product to price"
        value={search}
        onChange={(event) => {
          setSearch(event.target.value)
          setProductId(undefined)
        }}
        className="w-80"
      />
      {trimmed.length >= 2 && !productId && (
        <ProductResults search={trimmed} onPick={setProductId} />
      )}
      {productId && <VariantResults productId={productId} onPick={onPick} />}
    </div>
  )
}

function ProductResults({ search, onPick }: { search: string; onPick: (id: string) => void }) {
  const products = useProductsQuery({ page: 0, size: 8, search })
  const rows = products.data?.content ?? []
  if (products.isLoading) {
    return <p className="text-sm text-muted-foreground">Searching…</p>
  }
  if (rows.length === 0) {
    return <p className="text-sm text-muted-foreground">No product matches “{search}”.</p>
  }
  return (
    <ul className="flex max-w-xl flex-col divide-y rounded-md border">
      {rows.map((p) => (
        <li key={p.id}>
          <button
            type="button"
            className="flex w-full items-center gap-3 px-3 py-2 text-left text-sm hover:bg-muted"
            onClick={() => onPick(p.id!)}
          >
            <span className="flex-1 truncate">{p.name}</span>
            <span className="text-xs text-muted-foreground">
              {p.brandName} · {p.variantCount} variant{p.variantCount === 1 ? '' : 's'}
            </span>
          </button>
        </li>
      ))}
    </ul>
  )
}

function VariantResults({
  productId,
  onPick,
}: {
  productId: string
  onPick: (variantId: string) => void
}) {
  const variants = useVariantsQuery(productId)
  const rows = variants.data ?? []
  if (variants.isLoading) {
    return <p className="text-sm text-muted-foreground">Loading variants…</p>
  }
  return (
    <ul className="flex max-w-xl flex-col divide-y rounded-md border">
      {rows.map((v) => (
        <li key={v.id} className="flex items-center gap-3 px-3 py-2 text-sm">
          <span className="font-mono">{v.skuCode}</span>
          <span className="flex-1 truncate">{v.name}</span>
          <span className="text-xs text-muted-foreground">
            base {formatMoney(v.baseSellingPrice)}
          </span>
          <Button size="sm" variant="outline" onClick={() => onPick(v.id!)}>
            Price this
          </Button>
        </li>
      ))}
    </ul>
  )
}

export { VariantPicker }
