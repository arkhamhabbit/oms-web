import * as React from 'react'
import { ArrowDownIcon, ArrowUpIcon, PencilIcon, PlusIcon, TrashIcon } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { MediaThumb } from '@/components/media/MediaThumb'
import { SlideFormDialog } from '@/components/content/SlideFormDialog'
import {
  useDeleteSlideMutation,
  useReorderSlidesMutation,
  type ContentBlock,
  type ContentSlide,
} from '@/api/content'
import type { Variant } from '@/api/products'
import { toastApiError } from '@/lib/api-error'
import { moveItem } from '@/lib/reorder'
import { addSlideProblem, FORMAT_LABELS, hasOverride } from '@/lib/content-rules'

export const PRODUCT_DEFAULT = 'PRODUCT'

export interface VariantSelectorProps {
  block: ContentBlock | undefined
  variants: Variant[]
  value: string
  onChange: (value: string) => void
  /** What a simple product calls its one variant. */
  noun?: 'item' | 'variant'
}

/** "Product default" or one variant; a variant that overrides the open block is marked. */
function VariantSelector({
  block,
  variants,
  value,
  onChange,
  noun = 'variant',
}: VariantSelectorProps) {
  return (
    <div className="flex items-center gap-2">
      <Label htmlFor="content-variant" className="text-sm">
        Showing
      </Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger id="content-variant" className="w-64">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={PRODUCT_DEFAULT}>Product default</SelectItem>
          {variants.map((v) => (
            <SelectItem key={v.id} value={v.id!}>
              {noun === 'item' ? 'Item ' : ''}
              {v.skuCode}
              {block && hasOverride(block, v.id!) ? ' · overridden' : ''}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}

export interface SlidesEditorProps {
  productId: string
  block: ContentBlock
  /** The selected variant's id, or undefined for the product default. */
  variantId: string | undefined
  canWrite: boolean
}

/**
 * The open block's slides. With "Product default" selected these are the product's slides; with
 * a variant selected they are that variant's override — adding its first slide starts the
 * override, and removing it hands the variant back to the product's slides.
 */
function SlidesEditor({ productId, block, variantId, canWrite }: SlidesEditorProps) {
  const reorder = useReorderSlidesMutation(productId, block.id!)
  const deleteSlide = useDeleteSlideMutation(productId, block.id!)
  const [formOpen, setFormOpen] = React.useState(false)
  const [editing, setEditing] = React.useState<ContentSlide | undefined>(undefined)
  const [removing, setRemoving] = React.useState(false)

  const format = block.format ?? 'CAROUSEL'
  const overrideSlides = variantId
    ? (block.overrides?.find((o) => o.variantId === variantId)?.slides ?? [])
    : []
  const overridden = variantId ? overrideSlides.length > 0 : false
  // A variant without an override is showing the product's slides, read-only here.
  const ownSlides = variantId ? overrideSlides : (block.slides ?? [])
  const shown = variantId && !overridden ? (block.slides ?? []) : ownSlides
  const readOnly = !canWrite || (!!variantId && !overridden)
  const addProblem = addSlideProblem(format, ownSlides.length)

  function move(index: number, direction: -1 | 1) {
    const reordered = moveItem(ownSlides, index, direction)
    if (reordered === ownSlides) {
      return
    }
    reorder
      .mutateAsync({ orderedIds: reordered.map((s) => s.id!), variantId })
      .catch((error) => toastApiError(error))
  }

  async function removeOverride() {
    setRemoving(true)
    try {
      // The override ends when its last slide goes (D4.20), so removing it is removing them all.
      for (const slide of overrideSlides) {
        await deleteSlide.mutateAsync(slide.id!)
      }
    } catch (error) {
      toastApiError(error)
    } finally {
      setRemoving(false)
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-medium">{block.title}</h3>
          <Badge variant="secondary">{FORMAT_LABELS[format]}</Badge>
          {variantId && (
            <Badge variant={overridden ? 'default' : 'outline'}>
              {overridden ? 'Variant override' : "Using the product's slides"}
            </Badge>
          )}
        </div>
        <div className="flex gap-2">
          {canWrite && variantId && overridden && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={removing}
              onClick={removeOverride}
            >
              Remove override
            </Button>
          )}
          {canWrite && (
            <Button
              type="button"
              size="sm"
              disabled={!!addProblem}
              title={addProblem ?? undefined}
              onClick={() => {
                setEditing(undefined)
                setFormOpen(true)
              }}
            >
              <PlusIcon /> {variantId && !overridden ? 'Start override' : 'Add slide'}
            </Button>
          )}
        </div>
      </div>
      {addProblem && canWrite && <p className="text-xs text-muted-foreground">{addProblem}</p>}

      {shown.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No slides yet. A block with no slides is not published to the app.
        </p>
      ) : (
        <ol className="flex flex-col divide-y rounded-md border bg-background">
          {shown.map((slide, index) => (
            <li
              key={slide.id}
              className={`flex items-center gap-3 px-3 py-2 ${readOnly ? 'opacity-70' : ''}`}
            >
              <span className="w-5 text-xs text-muted-foreground">{index + 1}</span>
              <MediaThumb media={slide.media} className="size-14" />
              <div className="min-w-0 flex-1 text-sm">
                <p className="truncate font-medium">
                  {slide.title || <span className="text-muted-foreground">No title</span>}
                </p>
                {slide.body && (
                  <p className="truncate text-xs text-muted-foreground">{slide.body}</p>
                )}
                {slide.linkUrl && (
                  <p className="truncate text-xs text-muted-foreground">{slide.linkUrl}</p>
                )}
              </div>
              {!readOnly && (
                <>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    disabled={index === 0}
                    title="Move up"
                    onClick={() => move(index, -1)}
                  >
                    <ArrowUpIcon />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    disabled={index === shown.length - 1}
                    title="Move down"
                    onClick={() => move(index, 1)}
                  >
                    <ArrowDownIcon />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    title="Edit slide"
                    onClick={() => {
                      setEditing(slide)
                      setFormOpen(true)
                    }}
                  >
                    <PencilIcon />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    title="Remove slide"
                    onClick={() =>
                      deleteSlide.mutateAsync(slide.id!).catch((error) => toastApiError(error))
                    }
                  >
                    <TrashIcon />
                  </Button>
                </>
              )}
            </li>
          ))}
        </ol>
      )}

      <SlideFormDialog
        productId={productId}
        block={block}
        variantId={variantId}
        open={formOpen}
        onOpenChange={setFormOpen}
        slide={editing}
      />
    </div>
  )
}

export { SlidesEditor, VariantSelector }
