import * as React from 'react'
import { ArrowDownIcon, ArrowUpIcon, PlusIcon, TrashIcon } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { ImageUrlField } from '@/components/form/ImageUrlField'
import { toastApiError } from '@/lib/api-error'
import { moveItem } from '@/lib/reorder'
import {
  useAddProductImageMutation,
  useAddVariantImageMutation,
  useProductImagesQuery,
  useRemoveProductImageMutation,
  useReorderProductImagesMutation,
  useVariantImagesQuery,
  type Variant,
} from '@/api/products'

function ProductLevelImages({ productId }: { productId: string }) {
  const imagesQuery = useProductImagesQuery(productId)
  const addImage = useAddProductImageMutation(productId)
  const removeImage = useRemoveProductImageMutation(productId)
  const reorder = useReorderProductImagesMutation(productId)

  const [url, setUrl] = React.useState('')
  const [altText, setAltText] = React.useState('')

  const images = imagesQuery.data ?? []

  function move(index: number, direction: -1 | 1) {
    const reordered = moveItem(images, index, direction)
    if (reordered === images) {
      return
    }
    reorder
      .mutateAsync({ orderedIds: reordered.map((i) => i.id!) })
      .catch((error) => toastApiError(error))
  }

  return (
    <div className="flex flex-col gap-3">
      {images.length === 0 ? (
        <p className="text-sm text-muted-foreground">No images yet.</p>
      ) : (
        <div className="flex flex-col divide-y rounded-md border bg-background">
          {images.map((image, index) => (
            <div key={image.id} className="flex items-center gap-3 px-3 py-2">
              <img src={image.url} alt={image.altText ?? ''} className="size-12 rounded object-cover" />
              <span className="flex-1 truncate text-sm">{image.url}</span>
              {index === 0 && <Badge variant="secondary">Primary</Badge>}
              <Button
                variant="ghost"
                size="icon"
                disabled={index === 0}
                title="Move up"
                onClick={() => move(index, -1)}
              >
                <ArrowUpIcon />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                disabled={index === images.length - 1}
                title="Move down"
                onClick={() => move(index, 1)}
              >
                <ArrowDownIcon />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                title="Remove"
                onClick={() => removeImage.mutateAsync(image.id!).catch((error) => toastApiError(error))}
              >
                <TrashIcon />
              </Button>
            </div>
          ))}
        </div>
      )}

      <div className="flex items-end gap-2">
        <div className="flex-1">
          <ImageUrlField value={url} onChange={(e) => setUrl(e.target.value)} />
        </div>
        <Input
          placeholder="Alt text (optional)"
          value={altText}
          onChange={(e) => setAltText(e.target.value)}
          className="w-48"
        />
        <Button
          type="button"
          disabled={!url || addImage.isPending}
          onClick={() =>
            addImage
              .mutateAsync({ url, altText: altText || undefined })
              .then(() => {
                setUrl('')
                setAltText('')
              })
              .catch((error) => toastApiError(error))
          }
        >
          <PlusIcon /> Add
        </Button>
      </div>
    </div>
  )
}

function VariantLevelImages({ productId, variant }: { productId: string; variant: Variant }) {
  const imagesQuery = useVariantImagesQuery(productId, variant.id)
  const addImage = useAddVariantImageMutation(productId, variant.id!)

  const [url, setUrl] = React.useState('')
  const [altText, setAltText] = React.useState('')

  const images = imagesQuery.data ?? []
  const anyInherited = images.some((i) => i.inherited)

  return (
    <div className="flex flex-col gap-3">
      {anyInherited && (
        <p className="rounded-md border border-blue-200 bg-blue-50 p-2 text-sm text-blue-900">
          Showing the product's images — this item has none of its own yet, so there is nothing
          to delete here. Add an image below to give it its own set (D4.14).
        </p>
      )}
      {images.length === 0 ? (
        <p className="text-sm text-muted-foreground">No images (product has none either).</p>
      ) : (
        <div className="flex flex-col divide-y rounded-md border bg-background">
          {images.map((image, index) => (
            <div key={`${image.url}-${index}`} className="flex items-center gap-3 px-3 py-2">
              <img src={image.url} alt={image.altText ?? ''} className="size-12 rounded object-cover" />
              <span className="flex-1 truncate text-sm">{image.url}</span>
              {image.inherited && <Badge variant="outline">Inherited from product</Badge>}
            </div>
          ))}
        </div>
      )}
      <p className="text-xs text-muted-foreground">
        **Contract gap** (flagged in the task's Status block): the resolved images endpoint returns
        no image id, so an existing own image can't be reordered or removed from here — only added.
        Removing or reordering an own image today requires the product's own image being new enough
        that you added it in this session, or going through a fresh add/replace.
      </p>
      <div className="flex items-end gap-2">
        <div className="flex-1">
          <ImageUrlField value={url} onChange={(e) => setUrl(e.target.value)} />
        </div>
        <Input
          placeholder="Alt text (optional)"
          value={altText}
          onChange={(e) => setAltText(e.target.value)}
          className="w-48"
        />
        <Button
          type="button"
          disabled={!url || addImage.isPending}
          onClick={() =>
            addImage
              .mutateAsync({ url, altText: altText || undefined })
              .then(() => {
                setUrl('')
                setAltText('')
              })
              .catch((error) => toastApiError(error))
          }
        >
          <PlusIcon /> Add
        </Button>
      </div>
    </div>
  )
}

export interface ProductImagesTabProps {
  productId: string
  variants: Variant[]
  isSimple: boolean
}

function ProductImagesTab({ productId, variants, isSimple }: ProductImagesTabProps) {
  const [level, setLevel] = React.useState<'product' | 'variant'>('product')
  const [variantId, setVariantId] = React.useState(variants[0]?.id)
  const selectedVariant = variants.find((v) => v.id === variantId) ?? variants[0]

  return (
    <div className="flex flex-col gap-4">
      <div className="flex gap-2">
        <Button
          size="sm"
          variant={level === 'product' ? 'default' : 'outline'}
          onClick={() => setLevel('product')}
        >
          Product images
        </Button>
        <Button
          size="sm"
          variant={level === 'variant' ? 'default' : 'outline'}
          onClick={() => setLevel('variant')}
        >
          {isSimple ? 'Item images' : 'Variant images'}
        </Button>
      </div>

      {level === 'product' && (
        <Card>
          <CardHeader>
            <CardTitle>Product images</CardTitle>
            <CardDescription>
              First image is the primary. A variant with none of its own falls back to these.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ProductLevelImages productId={productId} />
          </CardContent>
        </Card>
      )}

      {level === 'variant' && (
        <Card>
          <CardHeader>
            <CardTitle>{isSimple ? 'Item images' : 'Variant images'}</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {!isSimple && (
              <div className="flex flex-wrap gap-2">
                {variants.map((v) => (
                  <Button
                    key={v.id}
                    size="sm"
                    variant={v.id === selectedVariant?.id ? 'default' : 'outline'}
                    onClick={() => setVariantId(v.id)}
                  >
                    {v.skuCode}
                  </Button>
                ))}
              </div>
            )}
            {selectedVariant && (
              <VariantLevelImages productId={productId} variant={selectedVariant} />
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}

export { ProductImagesTab }
