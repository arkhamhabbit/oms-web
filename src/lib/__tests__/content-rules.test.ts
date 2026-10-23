import { describe, expect, it } from 'vitest'

import type { ContentBlock } from '@/api/content'
import {
  addSlideProblem,
  formatBytes,
  formatDuration,
  hasOverride,
  maxSlides,
  moveTo,
  parseRating,
  slideProblem,
  slidesFor,
  wallBlocks,
} from '@/lib/content-rules'

describe('slide limits by format (D4.20)', () => {
  it('holds one slide for SINGLE and TITLED, any number for CAROUSEL and STORY', () => {
    expect(maxSlides('SINGLE')).toBe(1)
    expect(maxSlides('TITLED')).toBe(1)
    expect(maxSlides('CAROUSEL')).toBeUndefined()
    expect(maxSlides('STORY')).toBeUndefined()
  })

  it('refuses a second slide only where the format caps the set', () => {
    expect(addSlideProblem('SINGLE', 0)).toBeNull()
    expect(addSlideProblem('SINGLE', 1)).toMatch(/one slide/)
    expect(addSlideProblem('TITLED', 1)).toMatch(/one slide/)
    expect(addSlideProblem('CAROUSEL', 7)).toBeNull()
  })

  it('needs a title and a body on a TITLED slide', () => {
    expect(slideProblem('TITLED', { title: 'Hi', body: '' })).toMatch(/title and a body/)
    expect(slideProblem('TITLED', { title: ' ', body: 'x' })).toMatch(/title and a body/)
    expect(slideProblem('TITLED', { title: 'Hi', body: 'x' })).toBeNull()
    expect(slideProblem('CAROUSEL', {})).toBeNull()
  })
})

describe('per-variant override', () => {
  const block: ContentBlock = {
    id: 'b1',
    slides: [{ id: 'p1' }],
    overrides: [
      { variantId: 'v1', slides: [{ id: 'o1' }, { id: 'o2' }] },
      { variantId: 'v2', slides: [] },
    ],
  }

  it('shows the variant its own slides when it has any, else the product’s', () => {
    expect(slidesFor(block, undefined).map((s) => s.id)).toEqual(['p1'])
    expect(slidesFor(block, 'v1').map((s) => s.id)).toEqual(['o1', 'o2'])
    expect(slidesFor(block, 'v2').map((s) => s.id)).toEqual(['p1'])
    expect(slidesFor(block, 'v3').map((s) => s.id)).toEqual(['p1'])
  })

  it('knows which variants override', () => {
    expect(hasOverride(block, 'v1')).toBe(true)
    expect(hasOverride(block, 'v2')).toBe(false)
  })
})

describe('wall and reorder', () => {
  it('takes the in-wall blocks in display order', () => {
    const blocks: ContentBlock[] = [
      { id: 'a', inWall: true },
      { id: 'b', inWall: false },
      { id: 'c', inWall: true },
    ]
    expect(wallBlocks(blocks).map((b) => b.id)).toEqual(['a', 'c'])
  })

  it('moves an item to a position, and ignores no-ops', () => {
    expect(moveTo(['a', 'b', 'c'], 0, 2)).toEqual(['b', 'c', 'a'])
    expect(moveTo(['a', 'b', 'c'], 2, 0)).toEqual(['c', 'a', 'b'])
    const same = ['a', 'b']
    expect(moveTo(same, 1, 1)).toBe(same)
    expect(moveTo(same, 0, 5)).toBe(same)
  })
})

describe('rating', () => {
  it('accepts 0.0–5.0 with one decimal, and blank to clear', () => {
    expect(parseRating('4.8')).toEqual({ ok: true, value: 4.8 })
    expect(parseRating('5')).toEqual({ ok: true, value: 5 })
    expect(parseRating('0')).toEqual({ ok: true, value: 0 })
    expect(parseRating('  ')).toEqual({ ok: true, value: null })
  })

  it('refuses out-of-range and over-precise values', () => {
    expect(parseRating('5.1').ok).toBe(false)
    expect(parseRating('4.85').ok).toBe(false)
    expect(parseRating('-1').ok).toBe(false)
    expect(parseRating('abc').ok).toBe(false)
  })
})

describe('formatting', () => {
  it('formats durations and sizes', () => {
    expect(formatDuration(65_000)).toBe('1:05')
    expect(formatDuration(undefined)).toBe('')
    expect(formatBytes(512)).toBe('512 B')
    expect(formatBytes(153048)).toBe('149.5 KB')
    expect(formatBytes(5 * 1024 * 1024)).toBe('5.0 MB')
  })
})
