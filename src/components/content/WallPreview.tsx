import { FilmIcon, ImageOffIcon } from 'lucide-react'

import { MediaThumb } from '@/components/media/MediaThumb'
import type { ContentBlock } from '@/api/content'
import { FORMAT_LABELS, slidesFor, wallBlocks } from '@/lib/content-rules'

export interface WallPreviewProps {
  blocks: ContentBlock[]
  /** Preview as this variant would see it; undefined for the product default. */
  variantId?: string
}

/**
 * Read-only: what the app will show (D4.20). The highlight circles in order, then the wall as a
 * three-column grid of the in-wall blocks, each tile drawn from its first slide. A block with no
 * slide is not published, so it is drawn as an empty tile to make that visible.
 */
function WallPreview({ blocks, variantId }: WallPreviewProps) {
  const circles = blocks.filter((b) => b.iconMediaId || b.icon)
  const wall = wallBlocks(blocks)

  return (
    <div className="flex flex-col gap-4" data-testid="wall-preview">
      <div>
        <h3 className="mb-2 text-sm font-medium">Highlights</h3>
        {circles.length === 0 ? (
          <p className="text-sm text-muted-foreground">No circles.</p>
        ) : (
          <ul className="flex flex-wrap gap-4">
            {circles.map((block) => (
              <li key={block.id} className="flex w-16 flex-col items-center gap-1 text-center">
                <MediaThumb media={block.icon} round className="size-14" />
                <span className="w-full truncate text-xs">{block.title}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
      <div>
        <h3 className="mb-2 text-sm font-medium">Wall</h3>
        {wall.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nothing is on the wall.</p>
        ) : (
          <ul className="grid max-w-md grid-cols-3 gap-1">
            {wall.map((block) => {
              const first = slidesFor(block, variantId)[0]
              return (
                <li
                  key={block.id}
                  data-testid="wall-tile"
                  className="relative aspect-[3/4] overflow-hidden rounded-sm border bg-muted"
                >
                  {first?.media ? (
                    <MediaThumb
                      media={first.media}
                      size="card"
                      className="size-full rounded-none border-0"
                    />
                  ) : (
                    <div className="flex size-full items-center justify-center">
                      <ImageOffIcon className="size-5 text-muted-foreground" />
                    </div>
                  )}
                  <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent p-1.5">
                    <p className="truncate text-xs font-medium text-white">{block.title}</p>
                    <p className="flex items-center gap-1 text-[10px] text-white/80">
                      {first?.media?.kind === 'VIDEO' && <FilmIcon className="size-3" />}
                      {FORMAT_LABELS[block.format ?? 'CAROUSEL']}
                      {!block.icon && ' · wall only'}
                    </p>
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </div>
  )
}

export { WallPreview }
