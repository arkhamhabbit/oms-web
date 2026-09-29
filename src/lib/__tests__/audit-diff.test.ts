import { describe, expect, it } from 'vitest'

import { diffSnapshots, formatDiffValue } from '@/lib/audit-diff'

describe('diffSnapshots', () => {
  it('classifies changed, added, removed and unchanged fields, sorted by name', () => {
    const rows = diffSnapshots(
      { name: 'Old', gone: 1, same: true },
      { name: 'New', added: 2, same: true }
    )
    expect(rows.map((r) => [r.field, r.kind])).toEqual([
      ['added', 'added'],
      ['gone', 'removed'],
      ['name', 'changed'],
      ['same', 'unchanged'],
    ])
  })

  it('treats a create (no before) as all added and a delete (no after) as all removed', () => {
    expect(diffSnapshots(undefined, { a: 1 }).map((r) => r.kind)).toEqual(['added'])
    expect(diffSnapshots({ a: 1 }, null).map((r) => r.kind)).toEqual(['removed'])
  })

  it('compares nested values structurally', () => {
    const rows = diffSnapshots({ perms: ['a', 'b'] }, { perms: ['a', 'b'] })
    expect(rows[0].kind).toBe('unchanged')
    expect(diffSnapshots({ perms: ['a'] }, { perms: ['a', 'b'] })[0].kind).toBe('changed')
  })

  it('does not confuse an explicit null with an absent field', () => {
    expect(diffSnapshots({}, { x: null })[0].kind).toBe('added')
    expect(diffSnapshots({ x: null }, { x: 1 })[0].kind).toBe('changed')
  })
})

describe('formatDiffValue', () => {
  it('renders absent, null, strings and structures distinctly', () => {
    expect(formatDiffValue(undefined)).toBe('—')
    expect(formatDiffValue(null)).toBe('null')
    expect(formatDiffValue('x')).toBe('x')
    expect(formatDiffValue({ a: 1 })).toBe('{"a":1}')
  })
})
