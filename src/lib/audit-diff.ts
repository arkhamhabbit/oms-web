export type DiffKind = 'added' | 'removed' | 'changed' | 'unchanged'

export interface DiffRow {
  field: string
  kind: DiffKind
  before: unknown
  after: unknown
}

type Snapshot = Record<string, unknown> | null | undefined

/**
 * Field-by-field diff of an audit entry's before/after snapshots. Either side may be absent
 * (a create has no `before`, a delete no `after`); a field present on one side only is
 * added/removed rather than "changed to undefined". Values are compared structurally —
 * snapshots can hold nested objects and arrays.
 */
export function diffSnapshots(before: Snapshot, after: Snapshot): DiffRow[] {
  const b = before ?? {}
  const a = after ?? {}
  const fields = [...new Set([...Object.keys(b), ...Object.keys(a)])].sort()

  return fields.map((field) => {
    const inBefore = field in b
    const inAfter = field in a
    let kind: DiffKind
    if (!inBefore) {
      kind = 'added'
    } else if (!inAfter) {
      kind = 'removed'
    } else {
      kind = JSON.stringify(b[field]) === JSON.stringify(a[field]) ? 'unchanged' : 'changed'
    }
    return { field, kind, before: b[field], after: a[field] }
  })
}

export function formatDiffValue(value: unknown): string {
  if (value === undefined) {
    return '—'
  }
  if (value === null) {
    return 'null'
  }
  return typeof value === 'string' ? value : JSON.stringify(value)
}
