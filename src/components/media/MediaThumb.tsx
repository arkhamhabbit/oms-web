import * as React from 'react'
import { FilmIcon, ImageOffIcon, PlayIcon } from 'lucide-react'

import type { MediaRef } from '@/api/media'
import { formatDuration } from '@/lib/content-rules'
import { cn } from '@/lib/utils'

/** The fields a thumbnail needs — satisfied by both a library item and a media reference. */
export type Thumbable = Pick<MediaRef, 'kind' | 'thumbUrl' | 'posterUrl' | 'url' | 'durationMs'>

export interface MediaThumbProps {
  media?: Thumbable | null
  /** Used when there is no media at all (a legacy-URL row, say). */
  fallbackUrl?: string
  className?: string
  round?: boolean
  /** Which rendition to draw; the thumb is plenty for lists, the card one suits the wall. */
  size?: 'thumb' | 'card'
  alt?: string
}

/**
 * A media item as a picture. A video draws its poster, with its duration; an item that is not
 * READY has no renditions yet, so it draws a placeholder rather than a broken image.
 */
function MediaThumb({
  media,
  fallbackUrl,
  className,
  round,
  size = 'thumb',
  alt = '',
}: MediaThumbProps) {
  const [errored, setErrored] = React.useState(false)
  const src =
    (size === 'card' ? (media as MediaRef | undefined)?.cardUrl : undefined) ??
    media?.thumbUrl ??
    media?.posterUrl ??
    (media?.kind === 'VIDEO' ? undefined : media?.url) ??
    fallbackUrl
  const isVideo = media?.kind === 'VIDEO'

  return (
    <div
      className={cn(
        'relative flex size-12 shrink-0 items-center justify-center overflow-hidden border bg-muted',
        round ? 'rounded-full' : 'rounded-md',
        className
      )}
    >
      {src && !errored ? (
        <img
          src={src}
          alt={alt}
          className="size-full object-cover"
          onError={() => setErrored(true)}
          onLoad={() => setErrored(false)}
        />
      ) : isVideo ? (
        <FilmIcon className="size-4 text-muted-foreground" />
      ) : (
        <ImageOffIcon className="size-4 text-muted-foreground" />
      )}
      {isVideo && (
        <>
          <PlayIcon className="absolute size-4 fill-white text-white drop-shadow" />
          {media?.durationMs !== undefined && (
            <span className="absolute right-0.5 bottom-0.5 rounded bg-black/70 px-1 text-[10px] leading-4 text-white">
              {formatDuration(media.durationMs)}
            </span>
          )}
        </>
      )}
    </div>
  )
}

export { MediaThumb }
