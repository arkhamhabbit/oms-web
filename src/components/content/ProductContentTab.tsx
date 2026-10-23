import * as React from 'react'
import {
  ArrowDownIcon,
  ArrowUpIcon,
  CopyIcon,
  GripVerticalIcon,
  PencilIcon,
  PlusIcon,
  TrashIcon,
} from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Switch } from '@/components/ui/switch'
import { ConfirmDialog } from '@/components/common/ConfirmDialog'
import { BlockFormDialog } from '@/components/content/BlockFormDialog'
import { CopyContentDialog } from '@/components/content/CopyContentDialog'
import { PRODUCT_DEFAULT, SlidesEditor, VariantSelector } from '@/components/content/SlidesEditor'
import { WallPreview } from '@/components/content/WallPreview'
import { MediaThumb } from '@/components/media/MediaThumb'
import {
  useDeleteBlockMutation,
  useProductContentQuery,
  useReorderBlocksMutation,
  useUpdateBlockMutation,
  type ContentBlock,
} from '@/api/content'
import type { Variant } from '@/api/products'
import { toastApiError } from '@/lib/api-error'
import { FORMAT_LABELS, moveTo } from '@/lib/content-rules'
import { cn } from '@/lib/utils'

export interface ProductContentTabProps {
  productId: string
  variants: Variant[]
  isSimple: boolean
  canWrite: boolean
}

/**
 * The Instagram-style product page (D4.20): blocks in display order, each with its slides, a
 * per-variant override, and a read-only preview of the wall the app will show.
 */
function ProductContentTab({ productId, variants, isSimple, canWrite }: ProductContentTabProps) {
  const contentQuery = useProductContentQuery(productId)
  const updateBlock = useUpdateBlockMutation(productId)
  const deleteBlock = useDeleteBlockMutation(productId)
  const reorder = useReorderBlocksMutation(productId)

  const blocks = React.useMemo(() => contentQuery.data?.blocks ?? [], [contentQuery.data])
  const [pendingOrder, setPendingOrder] = React.useState<string[] | null>(null)
  const ordered = pendingOrder
    ? pendingOrder
        .map((id) => blocks.find((b) => b.id === id))
        .filter((b): b is ContentBlock => !!b)
    : blocks

  const [selectedId, setSelectedId] = React.useState<string | undefined>(undefined)
  const selected = ordered.find((b) => b.id === selectedId) ?? ordered[0]
  const [variantValue, setVariantValue] = React.useState(PRODUCT_DEFAULT)
  const variantId = variantValue === PRODUCT_DEFAULT ? undefined : variantValue

  const [blockFormOpen, setBlockFormOpen] = React.useState(false)
  const [editingBlock, setEditingBlock] = React.useState<ContentBlock | undefined>(undefined)
  const [copyOpen, setCopyOpen] = React.useState(false)
  const [deleting, setDeleting] = React.useState<ContentBlock | null>(null)
  const [dragIndex, setDragIndex] = React.useState<number | null>(null)

  function applyOrder(next: ContentBlock[]) {
    if (next === ordered) {
      return
    }
    const ids = next.map((b) => b.id!)
    setPendingOrder(ids)
    reorder
      .mutateAsync(ids)
      .catch((error) => toastApiError(error))
      .finally(() => setPendingOrder(null))
  }

  function toggleWall(block: ContentBlock, inWall: boolean) {
    updateBlock
      .mutateAsync({
        blockId: block.id!,
        title: block.title!,
        format: block.format!,
        // The current circle is sent back to keep it (D4.20).
        iconMediaId: block.iconMediaId ?? null,
        inWall,
        version: block.version!,
      })
      .catch((error) => toastApiError(error))
  }

  if (contentQuery.isLoading) {
    return <p className="text-sm text-muted-foreground">Loading…</p>
  }

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-2">
          <div>
            <CardTitle>Blocks</CardTitle>
            <CardDescription>
              Each block is a highlight circle and a place on the wall. Drag to reorder.
            </CardDescription>
          </div>
          {canWrite && (
            <div className="flex gap-2">
              <Button type="button" variant="outline" size="sm" onClick={() => setCopyOpen(true)}>
                <CopyIcon /> Copy from product…
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={() => {
                  setEditingBlock(undefined)
                  setBlockFormOpen(true)
                }}
              >
                <PlusIcon /> New block
              </Button>
            </div>
          )}
        </CardHeader>
        <CardContent>
          {ordered.length === 0 ? (
            <p className="text-sm text-muted-foreground">No blocks yet.</p>
          ) : (
            <ol
              className="flex flex-col divide-y rounded-md border bg-background"
              aria-label="Blocks"
            >
              {ordered.map((block, index) => (
                <li
                  key={block.id}
                  draggable={canWrite}
                  onDragStart={() => setDragIndex(index)}
                  onDragOver={(event) => event.preventDefault()}
                  onDrop={(event) => {
                    event.preventDefault()
                    if (dragIndex !== null) {
                      applyOrder(moveTo(ordered, dragIndex, index))
                    }
                    setDragIndex(null)
                  }}
                  onDragEnd={() => setDragIndex(null)}
                  className={cn(
                    'flex items-center gap-3 px-3 py-2',
                    selected?.id === block.id && 'bg-accent/50',
                    dragIndex === index && 'opacity-50'
                  )}
                >
                  {canWrite && (
                    <GripVerticalIcon
                      className="size-4 cursor-grab text-muted-foreground"
                      aria-hidden
                    />
                  )}
                  <MediaThumb media={block.icon} round className="size-10" />
                  <button
                    type="button"
                    onClick={() => setSelectedId(block.id)}
                    className="min-w-0 flex-1 text-left"
                    aria-label={`Open ${block.title}`}
                  >
                    <p className="truncate text-sm font-medium">{block.title}</p>
                    <p className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                      <Badge variant="secondary">{FORMAT_LABELS[block.format ?? 'CAROUSEL']}</Badge>
                      <span>
                        {block.slides?.length ?? 0} slide
                        {(block.slides?.length ?? 0) === 1 ? '' : 's'}
                      </span>
                      {!block.icon && <Badge variant="outline">Wall only</Badge>}
                      {(block.overrides?.length ?? 0) > 0 && (
                        <Badge variant="outline">Variant overrides</Badge>
                      )}
                    </p>
                  </button>
                  <label className="flex items-center gap-1.5 text-xs">
                    <Switch
                      checked={!!block.inWall}
                      // A block with no circle can only be on the wall.
                      disabled={!canWrite || !block.icon || updateBlock.isPending}
                      onCheckedChange={(checked) => toggleWall(block, checked)}
                      aria-label={`${block.title} in wall`}
                    />
                    In wall
                  </label>
                  {canWrite && (
                    <>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        disabled={index === 0}
                        title="Move up"
                        onClick={() => applyOrder(moveTo(ordered, index, index - 1))}
                      >
                        <ArrowUpIcon />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        disabled={index === ordered.length - 1}
                        title="Move down"
                        onClick={() => applyOrder(moveTo(ordered, index, index + 1))}
                      >
                        <ArrowDownIcon />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        title="Edit block"
                        onClick={() => {
                          setEditingBlock(block)
                          setBlockFormOpen(true)
                        }}
                      >
                        <PencilIcon />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        title="Delete block"
                        onClick={() => setDeleting(block)}
                      >
                        <TrashIcon />
                      </Button>
                    </>
                  )}
                </li>
              ))}
            </ol>
          )}
        </CardContent>
      </Card>

      {selected && (
        <Card>
          <CardHeader className="flex flex-row items-start justify-between gap-2">
            <div>
              <CardTitle>Slides</CardTitle>
              <CardDescription>
                {isSimple
                  ? 'Pick the item to give it its own slides for this block; otherwise it shows the product’s.'
                  : 'Pick a variant to give it its own slides for this block; otherwise it shows the product’s.'}
              </CardDescription>
            </div>
            <VariantSelector
              block={selected}
              variants={variants}
              value={variantValue}
              onChange={setVariantValue}
              noun={isSimple ? 'item' : 'variant'}
            />
          </CardHeader>
          <CardContent>
            <SlidesEditor
              key={`${selected.id}:${variantId ?? ''}`}
              productId={productId}
              block={selected}
              variantId={variantId}
              canWrite={canWrite}
            />
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Wall preview</CardTitle>
          <CardDescription>
            What the app shows{variantId ? ' for the selected variant' : ''}. Read-only.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <WallPreview blocks={ordered} variantId={variantId} />
        </CardContent>
      </Card>

      <BlockFormDialog
        productId={productId}
        open={blockFormOpen}
        onOpenChange={setBlockFormOpen}
        block={editingBlock}
      />
      <CopyContentDialog productId={productId} open={copyOpen} onOpenChange={setCopyOpen} />
      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(open) => !open && setDeleting(null)}
        title="Delete this block?"
        confirmLabel="Delete block"
        destructive
        pending={deleteBlock.isPending}
        onConfirm={() =>
          deleteBlock
            .mutateAsync(deleting!.id!)
            .then(() => setDeleting(null))
            .catch((error) => toastApiError(error))
        }
      >
        <p className="text-sm">
          <strong>{deleting?.title}</strong> and all of its slides, including variant overrides, are
          removed from the product page. The files stay in the media library.
        </p>
      </ConfirmDialog>
    </div>
  )
}

export { ProductContentTab }
