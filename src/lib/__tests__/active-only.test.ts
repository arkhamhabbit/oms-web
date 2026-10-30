import { describe, expect, it } from 'vitest'

import { visibleCategoryOptions } from '@/components/catalog/ProductCategoryPicker'
import { isActiveFlag, isActiveStatus, keepActive, markInactive } from '@/lib/active-only'
import { reasonsFor, REASON_REQUIRED_TYPES } from '@/lib/inventory'
import { REASON_CODE_LABEL } from '@/lib/labels'

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

describe('reasons by movement type', () => {
  it('offers only the pairing the server accepts, and nothing for a type that takes no reason', () => {
    expect(reasonsFor('ADJUSTMENT')).not.toContain('DAMAGED_IN_TRANSIT')
    expect(reasonsFor('DAMAGE')).toContain('DAMAGED_IN_TRANSIT')
    expect(reasonsFor('RECEIPT')).toEqual([])
    expect(reasonsFor('EXPIRY_WRITE_OFF')).toEqual([])
  })

  it('has reasons for every type that requires one, each with a label', () => {
    for (const type of REASON_REQUIRED_TYPES) {
      expect(reasonsFor(type).length).toBeGreaterThan(0)
      for (const code of reasonsFor(type)) {
        expect(REASON_CODE_LABEL[code]).toBeTruthy()
      }
    }
  })
})
