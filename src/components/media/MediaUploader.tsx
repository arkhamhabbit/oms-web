import * as React from 'react'
import { UploadIcon } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { MediaThumb } from '@/components/media/MediaThumb'
import {
  mediaKindOf,
  uploadMedia,
  useInvalidateMedia,
  useMediaItemQuery,
  type Media,
  type MediaKind,
  type UploadProgress,
} from '@/api/media'
import { isApiError } from '@/lib/api-error'
import { formatBytes, formatDuration } from '@/lib/content-rules'

export interface MediaUploaderProps {
  kinds: MediaKind[]
  /** Called once per item when it is READY (immediately, or after a short wait for a slow confirm). */
  onReady?: (media: Media) => void
  /** Offered beside the result once the item is READY; omit both to just show the result. */
  useLabel?: string
  onUse?: (media: Media) => void
  /** An item deleted elsewhere on the page: its result line goes away instead of reading "Ready". */
  removedId?: string
}

const STAGE_LABELS: Record<UploadProgress['stage'], string> = {
  issuing: 'Requesting an upload link…',
  uploading: 'Uploading',
  confirming: 'Checking and processing the file…',
}

/**
 * Upload from this computer (D4.19): issue → PUT to the signed URL → confirm. Shows progress,
 * and the server's own sentence when it refuses the size, the type or the file itself. An item
 * the server is still processing (PENDING) is polled until it is READY.
 */
function MediaUploader({ kinds, onReady, useLabel, onUse, removedId }: MediaUploaderProps) {
  const inputRef = React.useRef<HTMLInputElement>(null)
  const invalidateMedia = useInvalidateMedia()
  const [progress, setProgress] = React.useState<UploadProgress | null>(null)
  const [error, setError] = React.useState<string | null>(null)
  const [uploaded, setUploaded] = React.useState<Media | null>(null)
  const [dragging, setDragging] = React.useState(false)

  const pending = uploaded?.status === 'PENDING' && uploaded.id !== removedId
  const polled = useMediaItemQuery(uploaded?.id, pending)
  const latest = pending && polled.data ? polled.data : uploaded
  const current = latest && latest.id !== removedId ? latest : null

  // Notify the parent exactly once per item, when it first shows as READY.
  const notifiedRef = React.useRef<string | undefined>(undefined)
  React.useEffect(() => {
    if (current?.status === 'READY' && current.id && notifiedRef.current !== current.id) {
      notifiedRef.current = current.id
      onReady?.(current)
    }
  }, [current, onReady])

  const accept = [
    kinds.includes('IMAGE') ? 'image/*' : '',
    kinds.includes('VIDEO') ? 'video/*' : '',
  ]
    .filter(Boolean)
    .join(',')
  const kindsText =
    kinds.length === 2 ? 'an image or a video' : kinds[0] === 'IMAGE' ? 'an image' : 'a video'

  async function upload(file: File) {
    setError(null)
    setUploaded(null)
    const kind = mediaKindOf(file.type)
    if (!kind || !kinds.includes(kind)) {
      setError(`"${file.name}" is not ${kindsText}. Choose ${kindsText} from your computer.`)
      return
    }
    try {
      const media = await uploadMedia(file, setProgress)
      setUploaded(media)
      await invalidateMedia()
    } catch (cause) {
      setError(isApiError(cause) ? cause.message : 'The upload failed.')
      await invalidateMedia()
    } finally {
      setProgress(null)
      if (inputRef.current) {
        inputRef.current.value = ''
      }
    }
  }

  const busy = progress !== null

  return (
    <div className="flex flex-col gap-3">
      <div
        onDragOver={(event) => {
          event.preventDefault()
          setDragging(true)
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(event) => {
          event.preventDefault()
          setDragging(false)
          const file = event.dataTransfer.files[0]
          if (file && !busy) {
            void upload(file)
          }
        }}
        className={`flex flex-col items-center gap-2 rounded-md border border-dashed p-6 text-center ${dragging ? 'border-primary bg-accent' : ''}`}
      >
        <UploadIcon className="size-5 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">Drop {kindsText} here, or</p>
        <input
          ref={inputRef}
          type="file"
          accept={accept}
          className="sr-only"
          aria-label="File to upload"
          disabled={busy}
          onChange={(event) => {
            const file = event.target.files?.[0]
            if (file) {
              void upload(file)
            }
          }}
        />
        <Button
          type="button"
          variant="outline"
          disabled={busy}
          onClick={() => inputRef.current?.click()}
        >
          Choose a file
        </Button>
      </div>

      {progress && (
        <div className="flex flex-col gap-1" role="status">
          <div className="h-2 overflow-hidden rounded bg-muted">
            <div
              className="h-full bg-primary transition-all"
              style={{ width: `${Math.round(progress.fraction * 100)}%` }}
            />
          </div>
          <p className="text-xs text-muted-foreground">
            {STAGE_LABELS[progress.stage]}
            {progress.stage === 'uploading' && ` ${Math.round(progress.fraction * 100)}%`}
          </p>
        </div>
      )}

      {error && (
        <p
          role="alert"
          className="rounded-md border border-destructive/40 bg-destructive/5 p-2 text-sm text-destructive"
        >
          {error}
        </p>
      )}

      {current && (
        <div className="flex items-center gap-3 rounded-md border p-2" data-testid="uploaded-media">
          <MediaThumb media={current} alt={current.filename} className="size-16" />
          <div className="flex-1 text-sm">
            <p className="truncate font-medium">{current.filename}</p>
            <p className="text-xs text-muted-foreground">
              {current.status === 'READY'
                ? [
                    current.width && current.height ? `${current.width}×${current.height}` : '',
                    current.kind === 'VIDEO' ? formatDuration(current.durationMs) : '',
                    formatBytes(current.bytes),
                    'Ready',
                  ]
                    .filter(Boolean)
                    .join(' · ')
                : 'Processing — this can take a moment…'}
            </p>
          </div>
          {useLabel && onUse && (
            <Button
              type="button"
              disabled={current.status !== 'READY'}
              onClick={() => onUse?.(current)}
            >
              {useLabel}
            </Button>
          )}
        </div>
      )}
    </div>
  )
}

export { MediaUploader }
