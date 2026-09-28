import { describe, expect, it } from 'vitest'

import { moveItem } from '@/lib/reorder'

describe('moveItem', () => {
  it('swaps an item with its next neighbour', () => {
    expect(moveItem(['a', 'b', 'c'], 0, 1)).toEqual(['b', 'a', 'c'])
  })

  it('swaps an item with its previous neighbour', () => {
    expect(moveItem(['a', 'b', 'c'], 2, -1)).toEqual(['a', 'c', 'b'])
  })

  it('is a no-op moving the first item up', () => {
    const items = ['a', 'b', 'c']
    expect(moveItem(items, 0, -1)).toBe(items)
  })

  it('is a no-op moving the last item down', () => {
    const items = ['a', 'b', 'c']
    expect(moveItem(items, 2, 1)).toBe(items)
  })

  it('does not mutate the original array', () => {
    const items = ['a', 'b', 'c']
    moveItem(items, 0, 1)
    expect(items).toEqual(['a', 'b', 'c'])
  })
})
