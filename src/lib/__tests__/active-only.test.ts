import { describe, expect, it } from 'vitest'

import { visibleCategoryOptions } from '@/components/catalog/ProductCategoryPicker'
import { isActiveFlag, isActiveStatus, keepActive, markInactive } from '@/lib/active-only'

const brands = [
  { id: 'a', name: 'Alpha', status: 'ACTIVE' },
  { id: 'b', name: 'Beta', status: 'ARCHIVED' },
  { id: 'c', name: 'Gamma', status: 'DRAFT' },
]

describe('active-only pickers', () => {
  it('offers active entries only', () => {
    expect(keepActive(brands, isActiveStatus).map((b) => b.id)).toEqual(['a'])
  })

  it('keeps the one already assigned, marked, so the control does not go blank', () => {
    const shown = keepActive(brands, isActiveStatus, ['b'])
    expect(shown.map((b) => b.id)).toEqual(['a', 'b'])
    expect(markInactive('Beta', isActiveStatus(shown[1]))).toBe('Beta (Inactive)')
    expect(markInactive('Alpha', isActiveStatus(shown[0]))).toBe('Alpha')
  })

  it('treats an attribute or value as active unless it says otherwise', () => {
    expect(isActiveFlag({})).toBe(true)
    expect(isActiveFlag({ active: true })).toBe(true)
    expect(isActiveFlag({ active: false })).toBe(false)
  })

  it('keeps an inactive category only when something chosen or active sits beneath it', () => {
    const node = (id: string, status: 'DRAFT' | 'ACTIVE' | 'ARCHIVED') => ({ id, status, name: id })
    const options = [
      { id: 'root', depth: 0, node: node('root', 'DRAFT'), disabled: false },
      { id: 'kid', depth: 1, node: node('kid', 'ACTIVE'), disabled: false },
      { id: 'old', depth: 0, node: node('old', 'ARCHIVED'), disabled: false },
      { id: 'oldkid', depth: 1, node: node('oldkid', 'ARCHIVED'), disabled: false },
      { id: 'lone', depth: 0, node: node('lone', 'ACTIVE'), disabled: false },
    ]
    expect(visibleCategoryOptions(options, new Set()).map((o) => o.id)).toEqual([
      'root',
      'kid',
      'lone',
    ])
    expect(visibleCategoryOptions(options, new Set(['oldkid'])).map((o) => o.id)).toEqual([
      'root',
      'kid',
      'old',
      'oldkid',
      'lone',
    ])
  })
})
