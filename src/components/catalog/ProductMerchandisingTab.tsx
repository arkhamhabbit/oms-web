import * as React from 'react'
import { Link } from 'react-router-dom'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { MultiSelect } from '@/components/form/MultiSelect'
import { describeApiError } from '@/components/content/BlockFormDialog'
import {
  useProductMerchandisingQuery,
  useTagsQuery,
  useUpdateProductMerchandisingMutation,
  useUpdateVariantMerchandisingMutation,
  useVariantMerchandisingQuery,
  type Tag,
} from '@/api/merchandising'
import type { Variant } from '@/api/products'
import { toast } from 'sonner'
import { parseRating } from '@/lib/content-rules'
import { useKeyedState } from '@/lib/use-keyed-state'

function tagOptions(tags: Tag[]) {
  return tags.map((t) => ({ value: t.id!, label: t.label ?? t.code ?? '' }))
}

function ProductMerchandisingCard({
  productId,
  canWrite,
}: {
  productId: string
  canWrite: boolean
}) {
  const query = useProductMerchandisingQuery(productId)
  const tagsQuery = useTagsQuery()
  const update = useUpdateProductMerchandisingMutation(productId)
  const data = query.data

  // Re-seeded whenever the server's copy changes (a save bumps `version`).
  const [tagIds, setTagIds] = useKeyedState<string[]>(data, () =>
    (data?.tags ?? []).map((t) => t.id!)
  )
  const [rating, setRating] = useKeyedState(data, () =>
    data?.rating === undefined || data.rating === null ? '' : data.rating.toFixed(1)
  )
  const [specLine, setSpecLine] = useKeyedState(data, () => data?.specLine ?? '')
  const [tagline, setTagline] = useKeyedState(data, () => data?.tagline ?? '')
  const [error, setError] = useKeyedState<string | null>(data, () => null)

  function save(event: React.FormEvent) {
    event.preventDefault()
    setError(null)
    const parsed = parseRating(rating)
    if (!parsed.ok) {
      setError(parsed.message)
      return
    }
    update
      .mutateAsync({
        rating: parsed.value,
        specLine: specLine.trim() || null,
        tagline: tagline.trim() || null,
        tagIds,
        version: data!.version!,
      })
      .then(() => toast.success('Merchandising saved'))
      .catch((cause) => setError(describeApiError(cause)))
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Card copy, rating and tags</CardTitle>
        <CardDescription>
          Shown on product cards and the product page. Saved on its own, not with the product's
          details.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {!data ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : (
          <form onSubmit={save} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="merch-tags">Tags</Label>
                <Link to="/tags" className="text-xs text-primary underline">
                  Manage tags
                </Link>
              </div>
              <MultiSelect
                id="merch-tags"
                options={tagOptions(tagsQuery.data ?? [])}
                value={tagIds}
                onValueChange={setTagIds}
                placeholder="No tags"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="merch-rating">Rating (0.0 – 5.0)</Label>
              <Input
                id="merch-rating"
                inputMode="decimal"
                className="w-32"
                placeholder="No rating"
                value={rating}
                disabled={!canWrite}
                onChange={(event) => setRating(event.target.value)}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="merch-spec">Spec line</Label>
              <Input
                id="merch-spec"
                placeholder="26g protein · Whey isolated blend"
                value={specLine}
                disabled={!canWrite}
                onChange={(event) => setSpecLine(event.target.value)}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="merch-tagline">Tagline</Label>
              <Input
                id="merch-tagline"
                placeholder="Built for your hardest training days"
                value={tagline}
                disabled={!canWrite}
                onChange={(event) => setTagline(event.target.value)}
              />
            </div>
            {error && (
              <p role="alert" className="text-sm text-destructive">
                {error}
              </p>
            )}
            {canWrite && (
              <div>
                <Button type="submit" disabled={update.isPending}>
                  Save
                </Button>
              </div>
            )}
          </form>
        )}
      </CardContent>
    </Card>
  )
}

function VariantMerchandisingRow({
  productId,
  variant,
  canWrite,
}: {
  productId: string
  variant: Variant
  canWrite: boolean
}) {
  const query = useVariantMerchandisingQuery(productId, variant.id)
  const tagsQuery = useTagsQuery()
  const update = useUpdateVariantMerchandisingMutation(productId, variant.id!)
  const data = query.data

  const [tagIds, setTagIds] = useKeyedState<string[]>(data, () =>
    (data?.tags ?? []).map((t) => t.id!)
  )
  const [specLine, setSpecLine] = useKeyedState(data, () => data?.specLine ?? '')
  const [error, setError] = useKeyedState<string | null>(data, () => null)

  function save(event: React.FormEvent) {
    event.preventDefault()
    setError(null)
    update
      .mutateAsync({ specLine: specLine.trim() || null, tagIds, version: data!.version! })
      .then(() => toast.success(`${variant.skuCode} saved`))
      .catch((cause) => setError(describeApiError(cause)))
  }

  return (
    <form
      onSubmit={save}
      className="grid gap-3 py-3 md:grid-cols-[10rem_1fr_1fr_auto] md:items-end"
    >
      <div className="text-sm font-medium">{variant.skuCode}</div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor={`vtags-${variant.id}`} className="text-xs">
          Tags
        </Label>
        <MultiSelect
          id={`vtags-${variant.id}`}
          options={tagOptions(tagsQuery.data ?? [])}
          value={tagIds}
          onValueChange={setTagIds}
          placeholder="None"
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor={`vspec-${variant.id}`} className="text-xs">
          Spec line (overrides the product's)
        </Label>
        <Input
          id={`vspec-${variant.id}`}
          value={specLine}
          disabled={!canWrite || !data}
          placeholder="Same as the product"
          onChange={(event) => setSpecLine(event.target.value)}
        />
      </div>
      {canWrite && (
        <Button type="submit" size="sm" disabled={!data || update.isPending}>
          Save
        </Button>
      )}
      {error && (
        <p role="alert" className="text-sm text-destructive md:col-span-4">
          {error}
        </p>
      )}
    </form>
  )
}

export interface ProductMerchandisingTabProps {
  productId: string
  variants: Variant[]
  isSimple: boolean
  canWrite: boolean
}

function ProductMerchandisingTab({
  productId,
  variants,
  isSimple,
  canWrite,
}: ProductMerchandisingTabProps) {
  return (
    <div className="flex flex-col gap-4">
      <ProductMerchandisingCard productId={productId} canWrite={canWrite} />
      <Card>
        <CardHeader>
          <CardTitle>{isSimple ? 'Item' : 'Variants'}</CardTitle>
          <CardDescription>
            {isSimple ? 'An item' : 'A variant'} can carry its own tags, and a spec line that replaces
            the product's.
          </CardDescription>
        </CardHeader>
        <CardContent className="divide-y">
          {variants.map((variant) => (
            <VariantMerchandisingRow
              key={variant.id}
              productId={productId}
              variant={variant}
              canWrite={canWrite}
            />
          ))}
        </CardContent>
      </Card>
    </div>
  )
}

export { ProductMerchandisingTab }
