import * as React from 'react'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { MediaPicker, pickedFromRef, type PickedMedia } from '@/components/media/MediaPicker'
import {
  useCreateBlockMutation,
  useUpdateBlockMutation,
  type BlockFormat,
  type ContentBlock,
} from '@/api/content'
import { FORMAT_HINTS, FORMAT_LABELS } from '@/lib/content-rules'
import { ApiClientError } from '@/lib/api-error'
import { useKeyedState } from '@/lib/use-keyed-state'

const FORMATS: BlockFormat[] = ['SINGLE', 'TITLED', 'CAROUSEL', 'STORY']

export interface BlockFormDialogProps {
  productId: string
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Omit to create a block; supply a block to edit it. */
  block?: ContentBlock
}

/** The server's refusal as one readable sentence: its message, plus any field it points at. */
export function describeApiError(error: unknown): string {
  if (error instanceof ApiClientError) {
    const fields = error.fieldErrors.map((f) => f.message).filter((m) => m && m !== error.message)
    return [error.message, ...fields].join(' ')
  }
  return error instanceof Error ? error.message : 'Something went wrong.'
}

function BlockFormDialog({ productId, open, onOpenChange, block }: BlockFormDialogProps) {
  const isEdit = !!block
  const createBlock = useCreateBlockMutation(productId)
  const updateBlock = useUpdateBlockMutation(productId)
  const pending = createBlock.isPending || updateBlock.isPending

  // Reset whenever the dialog opens, closes, or is pointed at another block.
  const resetKey = `${open}:${block?.id}:${block?.version}`
  const [title, setTitle] = useKeyedState(resetKey, () => block?.title ?? '')
  const [icon, setIcon] = useKeyedState<PickedMedia | null>(resetKey, () =>
    block ? pickedFromRef(block.icon, block.iconMediaId) : null
  )
  const [format, setFormat] = useKeyedState<BlockFormat>(
    resetKey,
    () => block?.format ?? 'CAROUSEL'
  )
  const [inWall, setInWall] = useKeyedState(resetKey, () => block?.inWall ?? true)
  const [error, setError] = useKeyedState<string | null>(resetKey, () => null)

  // A block with no circle can only be seen on the wall.
  const wallForced = !icon
  const effectiveInWall = wallForced ? true : inWall

  function submit(event: React.FormEvent) {
    event.preventDefault()
    setError(null)
    if (!title.trim()) {
      setError('Give the block a title.')
      return
    }
    const request = isEdit
      ? updateBlock.mutateAsync({
          blockId: block!.id!,
          title: title.trim(),
          format,
          iconMediaId: icon?.id ?? null,
          inWall: effectiveInWall,
          version: block!.version!,
        })
      : createBlock.mutateAsync({
          title: title.trim(),
          format,
          iconMediaId: icon?.id,
          inWall: effectiveInWall,
        })
    request.then(() => onOpenChange(false)).catch((cause) => setError(describeApiError(cause)))
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Edit block' : 'New block'}</DialogTitle>
          <DialogDescription>
            A block is one highlight circle on the product page and one place on its wall.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="block-title">Title</Label>
            <Input
              id="block-title"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Testimonials, Our Promise, Nutrients…"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Circle icon</Label>
            <MediaPicker label="icon" value={icon} onChange={setIcon} round />
            <p className="text-xs text-muted-foreground">
              Optional. Without one the block has no circle and appears on the wall only.
            </p>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="block-format">Format</Label>
            <Select value={format} onValueChange={(value) => setFormat(value as BlockFormat)}>
              <SelectTrigger id="block-format">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {FORMATS.map((f) => (
                  <SelectItem key={f} value={f}>
                    {FORMAT_LABELS[f]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">{FORMAT_HINTS[format]}</p>
          </div>
          <div className="flex items-center gap-2">
            <Switch
              id="block-in-wall"
              checked={effectiveInWall}
              disabled={wallForced}
              onCheckedChange={setInWall}
            />
            <Label htmlFor="block-in-wall">Show on the wall</Label>
            {wallForced && (
              <span className="text-xs text-muted-foreground">
                (a block with no circle is always on the wall)
              </span>
            )}
          </div>
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
          <DialogFooter>
            <Button type="submit" disabled={pending}>
              {isEdit ? 'Save' : 'Create block'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export { BlockFormDialog }
