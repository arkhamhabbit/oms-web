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
import { MediaPicker, pickedFromRef, type PickedMedia } from '@/components/media/MediaPicker'
import { describeApiError } from '@/components/content/BlockFormDialog'
import {
  useAddSlideMutation,
  useUpdateSlideMutation,
  type ContentBlock,
  type ContentSlide,
} from '@/api/content'
import { slideProblem } from '@/lib/content-rules'
import { useKeyedState } from '@/lib/use-keyed-state'

export interface SlideFormDialogProps {
  productId: string
  block: ContentBlock
  /** The variant whose override this slide belongs to; undefined for the product's own slides. */
  variantId?: string
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Omit to add a slide; supply one to edit it. */
  slide?: ContentSlide
}

function SlideFormDialog({
  productId,
  block,
  variantId,
  open,
  onOpenChange,
  slide,
}: SlideFormDialogProps) {
  const isEdit = !!slide
  const addSlide = useAddSlideMutation(productId, block.id!)
  const updateSlide = useUpdateSlideMutation(productId, block.id!)
  const pending = addSlide.isPending || updateSlide.isPending
  const format = block.format ?? 'CAROUSEL'

  const resetKey = `${open}:${slide?.id}:${slide?.version}`
  const [media, setMedia] = useKeyedState<PickedMedia | null>(resetKey, () =>
    slide ? pickedFromRef(slide.media, slide.mediaId) : null
  )
  const [title, setTitle] = useKeyedState(resetKey, () => slide?.title ?? '')
  const [body, setBody] = useKeyedState(resetKey, () => slide?.body ?? '')
  const [linkUrl, setLinkUrl] = useKeyedState(resetKey, () => slide?.linkUrl ?? '')
  const [error, setError] = useKeyedState<string | null>(resetKey, () => null)

  function submit(event: React.FormEvent) {
    event.preventDefault()
    setError(null)
    if (!media) {
      setError('Choose an image or a video for the slide.')
      return
    }
    const problem = slideProblem(format, { title, body })
    if (problem) {
      setError(problem)
      return
    }
    const request = isEdit
      ? updateSlide.mutateAsync({
          slideId: slide!.id!,
          mediaId: media.id,
          title: title.trim() || null,
          body: body.trim() || null,
          linkUrl: linkUrl.trim() || null,
          version: slide!.version!,
        })
      : addSlide.mutateAsync({
          mediaId: media.id,
          title: title.trim() || undefined,
          body: body.trim() || undefined,
          linkUrl: linkUrl.trim() || undefined,
          variantId,
        })
    request.then(() => onOpenChange(false)).catch((cause) => setError(describeApiError(cause)))
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Edit slide' : 'Add slide'}</DialogTitle>
          <DialogDescription>
            {block.title}
            {variantId ? ' — for this variant only' : ''}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label>Image or video</Label>
            <MediaPicker
              label="media"
              kinds={['IMAGE', 'VIDEO']}
              value={media}
              onChange={setMedia}
              clearable={false}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="slide-title">Title{format === 'TITLED' ? '' : ' (optional)'}</Label>
            <Input
              id="slide-title"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="slide-body">Body{format === 'TITLED' ? '' : ' (optional)'}</Label>
            <textarea
              id="slide-body"
              rows={3}
              value={body}
              onChange={(event) => setBody(event.target.value)}
              className="rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="slide-link">Link (optional)</Label>
            <Input
              id="slide-link"
              type="url"
              placeholder="https://…"
              value={linkUrl}
              onChange={(event) => setLinkUrl(event.target.value)}
            />
          </div>
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
          <DialogFooter>
            <Button type="submit" disabled={pending}>
              {isEdit ? 'Save' : 'Add slide'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export { SlideFormDialog }
