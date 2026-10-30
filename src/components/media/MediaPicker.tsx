import * as React from 'react'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { MediaLibraryGrid } from '@/components/media/MediaLibraryGrid'
import { MediaThumb, type Thumbable } from '@/components/media/MediaThumb'
import { MediaUploader } from '@/components/media/MediaUploader'
import { usePermissions } from '@/auth/usePermissions'
import type { Media, MediaKind, MediaRef } from '@/api/media'

/** What a form holds for a media reference: the library id to send, and enough to draw it. */
export interface PickedMedia {
  id: string
  preview: Thumbable
  filename?: string
}

/** A response's media reference as a picked value; null for none, or for a legacy URL (no library id). */
export function pickedFromRef(
  ref: MediaRef | null | undefined,
  mediaId?: string | null
): PickedMedia | null {
  const id = ref?.mediaId ?? mediaId ?? undefined
  if (!ref || !id || ref.legacy) {
    return null
  }
  return { id, preview: ref }
}

export function pickedFromMedia(media: Media): PickedMedia {
  return { id: media.id!, preview: media, filename: media.filename }
}

export interface MediaPickerProps {
  value: PickedMedia | null
  onChange: (value: PickedMedia | null) => void
  kinds?: MediaKind[]
  /** The URL typed before the library existed: shown read-only until it is replaced. */
  legacyUrl?: string
  /** Wording for the field in the dialog title and button, e.g. "logo". */
  label?: string
  disabled?: boolean
  /** Whether clearing is offered (a form field, yes; a slide's required media, no). */
  clearable?: boolean
  round?: boolean
}

type Mode = 'upload' | 'library'

/**
 * The one control for setting a media reference (D4.19): **upload from this computer**, or
 * **choose from the library**. It never holds a URL — it hands the form a library id.
 */
function MediaPicker({
  value,
  onChange,
  kinds = ['IMAGE'],
  legacyUrl,
  label = 'file',
  disabled,
  clearable = true,
  round,
}: MediaPickerProps) {
  const { has } = usePermissions()
  const canUpload = has('catalog.media.write')
  const canBrowse = has('catalog.media.read')
  const [open, setOpen] = React.useState(false)
  const [mode, setMode] = React.useState<Mode>(canUpload ? 'upload' : 'library')
  const [uploaded, setUploaded] = React.useState<Media | null>(null)

  function pick(media: Media) {
    onChange(pickedFromMedia(media))
    setOpen(false)
    setUploaded(null)
  }

  const hasCurrent = !!value || !!legacyUrl
  const actionLabel =
    legacyUrl && !value ? `Replace with upload` : hasCurrent ? `Change ${label}` : `Add ${label}`

  return (
    <div className="flex items-center gap-3">
      <MediaThumb
        media={value?.preview}
        fallbackUrl={value ? undefined : legacyUrl}
        className="size-14"
        round={round}
      />
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        {value ? (
          <span className="truncate text-sm">{value.filename ?? 'From the library'}</span>
        ) : legacyUrl ? (
          <>
            <span className="truncate text-sm text-muted-foreground" title={legacyUrl}>
              {legacyUrl}
            </span>
            <span className="text-xs text-muted-foreground">Old URL — read-only</span>
          </>
        ) : (
          <span className="text-sm text-muted-foreground">None</span>
        )}
      </div>
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={disabled}
        onClick={() => setOpen(true)}
      >
        {actionLabel}
      </Button>
      {clearable && value && (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={disabled}
          onClick={() => onChange(null)}
        >
          Remove
        </Button>
      )}

      <Dialog
        open={open}
        onOpenChange={(next) => {
          setOpen(next)
          if (!next) {
            setUploaded(null)
          }
        }}
      >
        <DialogContent className="sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>{hasCurrent ? `Change ${label}` : `Add ${label}`}</DialogTitle>
            <DialogDescription>
              Upload{' '}
              {kinds.length === 2
                ? 'an image or a video'
                : kinds[0] === 'IMAGE'
                  ? 'an image'
                  : 'a video'}{' '}
              from this computer, or choose one already in the library.
            </DialogDescription>
          </DialogHeader>
          <div className="flex gap-2">
            {canUpload && (
              <Button
                type="button"
                size="sm"
                variant={mode === 'upload' ? 'default' : 'outline'}
                onClick={() => setMode('upload')}
              >
                Upload from this computer
              </Button>
            )}
            {canBrowse && (
              <Button
                type="button"
                size="sm"
                variant={mode === 'library' ? 'default' : 'outline'}
                onClick={() => setMode('library')}
              >
                Choose from the library
              </Button>
            )}
          </div>
          {!canUpload && !canBrowse && (
            <p className="text-sm text-muted-foreground">
              You do not have permission to upload or browse media.
            </p>
          )}
          {mode === 'upload' && canUpload && (
            <MediaUploader
              kinds={kinds}
              onReady={setUploaded}
              useLabel={`Use this ${kinds.length === 2 ? 'file' : kinds[0] === 'IMAGE' ? 'image' : 'video'}`}
              onUse={pick}
            />
          )}
          {mode === 'library' && canBrowse && (
            <div className="max-h-[60vh] overflow-y-auto">
              <MediaLibraryGrid
                kinds={kinds}
                status="READY"
                onSelect={pick}
                selectedId={value?.id ?? uploaded?.id}
              />
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

export { MediaPicker }
