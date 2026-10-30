import type { BlockFormat, ContentBlock, ContentSlide } from '@/api/content'

/** D4.20 — how many slides one set (the product's, or one variant's override) may hold. */
export function maxSlides(format: BlockFormat): number | undefined {
  return format === 'SINGLE' || format === 'TITLED' ? 1 : undefined
}

export const FORMAT_LABELS: Record<BlockFormat, string> = {
  SINGLE: 'Single',
  TITLED: 'Titled',
  CAROUSEL: 'Carousel',
  STORY: 'Story',
}

export const FORMAT_HINTS: Record<BlockFormat, string> = {
  SINGLE: 'One image or video.',
  TITLED: 'One image or video with a title and a body.',
  CAROUSEL: 'Swipe-through slides.',
  STORY: 'Full-screen, tap-through slides.',
}

/** A sentence when one more slide cannot be added to a set of `count`; null when it can. */
export function addSlideProblem(format: BlockFormat, count: number): string | null {
  const max = maxSlides(format)
  if (max !== undefined && count >= max) {
    return `${FORMAT_LABELS[format]} blocks hold ${max === 1 ? 'one slide' : `${max} slides`} — edit the existing slide, or change the block's format.`
  }
  return null
}

/** A sentence when a slide's text is wrong for the format; null when it is fine. */
export function slideProblem(
  format: BlockFormat,
  slide: { title?: string | null; body?: string | null }
): string | null {
  if (format === 'TITLED' && (!slide.title?.trim() || !slide.body?.trim())) {
    return 'A titled slide needs both a title and a body.'
  }
  return null
}

/** The block's slides for one viewer: the variant's override when it has one, else the product's. */
export function slidesFor(block: ContentBlock, variantId: string | undefined): ContentSlide[] {
  if (variantId) {
    const override = block.overrides?.find((o) => o.variantId === variantId)
    if (override?.slides?.length) {
      return override.slides
    }
  }
  return block.slides ?? []
}

export function hasOverride(block: ContentBlock, variantId: string): boolean {
  return !!block.overrides?.some((o) => o.variantId === variantId && (o.slides?.length ?? 0) > 0)
}

/**
 * What OMS publishes (0.10 confirmed it): a block with no *product* slide is not published at all,
 * so it is in neither the highlights nor the wall, and its variant overrides go with it. OMS serves
 * no preview endpoint, so the console applies the same rule here.
 */
export function publishedBlocks(blocks: ContentBlock[]): ContentBlock[] {
  return blocks.filter((b) => (b.slides?.length ?? 0) > 0)
}

/** The highlight circles (D4.20): published blocks that carry an icon. */
export function highlightBlocks(blocks: ContentBlock[]): ContentBlock[] {
  return publishedBlocks(blocks).filter((b) => b.iconMediaId || b.icon)
}

/** The wall (D4.20): the published in-wall blocks in display order. Wall-only blocks are those with no circle. */
export function wallBlocks(blocks: ContentBlock[]): ContentBlock[] {
  return publishedBlocks(blocks).filter((b) => b.inWall)
}

/** Moves the item at `from` to position `to`; the same array when nothing would change. */
export function moveTo<T>(items: T[], from: number, to: number): T[] {
  if (from === to || from < 0 || to < 0 || from >= items.length || to >= items.length) {
    return items
  }
  const next = [...items]
  const [moved] = next.splice(from, 1)
  next.splice(to, 0, moved)
  return next
}

export type RatingParse = { ok: true; value: number | null } | { ok: false; message: string }

/** Rating is 0.0 to 5.0 with one decimal, or blank to clear. */
export function parseRating(text: string): RatingParse {
  const trimmed = text.trim()
  if (trimmed === '') {
    return { ok: true, value: null }
  }
  if (!/^\d(\.\d)?$/.test(trimmed)) {
    return { ok: false, message: 'Enter a rating from 0.0 to 5.0 with at most one decimal.' }
  }
  const value = Number(trimmed)
  if (value < 0 || value > 5) {
    return { ok: false, message: 'Enter a rating from 0.0 to 5.0 with at most one decimal.' }
  }
  return { ok: true, value }
}

export function formatDuration(durationMs: number | undefined): string {
  if (durationMs === undefined) {
    return ''
  }
  const totalSeconds = Math.round(durationMs / 1000)
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${minutes}:${String(seconds).padStart(2, '0')}`
}

export function formatBytes(bytes: number | undefined): string {
  if (bytes === undefined) {
    return ''
  }
  if (bytes < 1024) {
    return `${bytes} B`
  }
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`
  }
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}
