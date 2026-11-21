import * as React from 'react'
import { MinusIcon, PlusIcon, Trash2Icon } from 'lucide-react'

import type { AdminQuote } from '@/api/orders'
import { useProductsQuery, useVariantsQuery } from '@/api/products'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { isApiError } from '@/lib/api-error'
import { addToBasket, MAX_LINE_QUANTITY, setQuantity, type BasketLine } from '@/lib/new-order'
import { placeRefusals, rupees } from '@/lib/orders'
import { useDebounced } from '@/lib/use-debounced'

function VariantRows({
  productId,
  productName,
  onAdd,
}: {
  productId: string
  productName: string
  onAdd: (line: Omit<BasketLine, 'quantity'>) => void
}) {
  const variants = useVariantsQuery(productId)
  if (variants.isLoading) {
    return <p className="px-2 text-xs text-muted-foreground">Loading variants…</p>
  }
  const rows = (variants.data ?? []).filter((v) => v.variantStatus !== 'DISCONTINUED')
  if (rows.length === 0) {
    return <p className="px-2 text-xs text-muted-foreground">No variant to add.</p>
  }
  return (
    <ul className="flex flex-col gap-1 pl-2">
      {rows.map((v) => (
        <li key={v.id} className="flex items-center justify-between gap-2 text-sm">
          <span>
            {v.name} <span className="font-mono text-xs text-muted-foreground">{v.skuCode}</span>
          </span>
          <Button
            size="sm"
            variant="outline"
            aria-label={`Add ${productName} ${v.name ?? ''} ${v.skuCode ?? ''}`.replace(/\s+/g, ' ').trim()}
            onClick={() =>
              onAdd({
                variantId: v.id!,
                productName,
                variantName: v.name ?? '',
                skuCode: v.skuCode ?? '',
              })
            }
          >
            <PlusIcon /> Add
          </Button>
        </li>
      ))}
    </ul>
  )
}

function ProductSearch({ onAdd }: { onAdd: (line: Omit<BasketLine, 'quantity'>) => void }) {
  const [text, setText] = React.useState('')
  const [open, setOpen] = React.useState<string | undefined>()
  const search = useDebounced(text.trim(), 300)
  const enabled = search.length >= 2
  const products = useProductsQuery({ page: 0, size: 8, search: enabled ? search : '' })
  const rows = enabled ? (products.data?.content ?? []) : []
  return (
    <div className="flex flex-col gap-2">
      <Input
        aria-label="Search products"
        placeholder="Product name or SKU"
        value={text}
        onChange={(e) => setText(e.target.value)}
      />
      {products.isError && (
        <p role="alert" className="text-sm text-destructive">
          {isApiError(products.error) ? products.error.message : 'Products could not be searched.'}
        </p>
      )}
      {enabled && !products.isLoading && rows.length === 0 && (
        <p className="text-sm text-muted-foreground">No product matches “{search}”.</p>
      )}
      <ul className="flex flex-col gap-1">
        {rows.map((p) => (
          <li key={p.id} className="rounded-md border p-2">
            <button
              type="button"
              className="w-full text-left text-sm font-medium"
              aria-expanded={open === p.id}
              onClick={() => setOpen(open === p.id ? undefined : p.id)}
            >
              {p.name}
              <span className="ml-2 text-xs font-normal text-muted-foreground">
                {p.variantCount ?? 0} {p.variantCount === 1 ? 'variant' : 'variants'}
              </span>
            </button>
            {open === p.id && (
              <VariantRows productId={p.id!} productName={p.name ?? ''} onAdd={onAdd} />
            )}
          </li>
        ))}
      </ul>
    </div>
  )
}

/**
 * Step 2: the basket. A line holds a variant and a quantity, nothing else; after a quote it shows
 * what the server says about that line: tier price, MRP, saving, stock, and any refusal that names it.
 * There is no price, discount or shipping control on this page: OMS prices the order.
 */
function BasketBuilder({
  lines,
  onChange,
  quote,
}: {
  lines: BasketLine[]
  onChange: (lines: BasketLine[]) => void
  quote: AdminQuote | undefined
}) {
  const placed = placeRefusals(quote)
  return (
    <Card>
      <CardHeader>
        <CardTitle>2. Basket</CardTitle>
        <CardDescription>
          Add variants and set quantities. Prices come from the quote on the right.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <ProductSearch onAdd={(add) => onChange(addToBasket(lines, add))} />
        {lines.length === 0 ? (
          <p className="text-sm text-muted-foreground">The basket is empty.</p>
        ) : (
          <ul aria-label="Basket" className="flex flex-col gap-2">
            {lines.map((line) => {
              const q = quote?.lines?.find((l) => l.variantId === line.variantId)
              const refusals = placed.byVariant.get(line.variantId) ?? []
              const short = q && (q.inStock === false || (q.available ?? Infinity) < line.quantity)
              return (
                <li
                  key={line.variantId}
                  data-testid={`basket-line-${line.skuCode}`}
                  className="flex flex-col gap-1 rounded-md border p-3"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="text-sm">
                      <div className="font-medium">{line.productName}</div>
                      <div className="text-xs text-muted-foreground">
                        {line.variantName} · <span className="font-mono">{line.skuCode}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button
                        size="icon"
                        variant="outline"
                        className="size-8"
                        aria-label={`Fewer ${line.skuCode}`}
                        onClick={() => onChange(setQuantity(lines, line.variantId, line.quantity - 1))}
                      >
                        <MinusIcon />
                      </Button>
                      <span
                        className="w-8 text-center text-sm tabular-nums"
                        aria-label={`Quantity of ${line.skuCode}`}
                      >
                        {line.quantity}
                      </span>
                      <Button
                        size="icon"
                        variant="outline"
                        className="size-8"
                        aria-label={`More ${line.skuCode}`}
                        disabled={line.quantity >= MAX_LINE_QUANTITY}
                        onClick={() => onChange(setQuantity(lines, line.variantId, line.quantity + 1))}
                      >
                        <PlusIcon />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="size-8"
                        aria-label={`Remove ${line.skuCode}`}
                        onClick={() => onChange(setQuantity(lines, line.variantId, 0))}
                      >
                        <Trash2Icon />
                      </Button>
                    </div>
                  </div>
                  {q && (
                    <div className="text-xs text-muted-foreground" data-testid="line-quote">
                      {rupees(q.unitPriceMinor)} each at the member’s tier · MRP {rupees(q.unitMrpMinor)}
                      {(q.lineSavingMinor ?? 0) > 0 ? ` · saves ${rupees(q.lineSavingMinor)}` : ''} ·{' '}
                      <span className={short ? 'font-medium text-destructive' : undefined}>
                        {q.inStock === false ? 'Out of stock' : `${q.available ?? 0} in stock`}
                      </span>
                    </div>
                  )}
                  {refusals.map((sentence) => (
                    <p key={sentence} role="alert" className="text-sm text-destructive">
                      {sentence}
                    </p>
                  ))}
                </li>
              )
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}

export { BasketBuilder }
