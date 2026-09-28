/**
 * Swaps the item at `index` with its neighbour in `direction`, returning a new array — or the
 * same array reference, unchanged, if the move would go out of bounds. Shared by every
 * reorderable list in the catalog (brands/categories already had this inlined per-page; the
 * attribute/value/group screens pull it out so the boundary check has one test, not four
 * copy-pasted ones).
 */
export function moveItem<T>(items: T[], index: number, direction: -1 | 1): T[] {
  const target = index + direction
  if (index < 0 || index >= items.length || target < 0 || target >= items.length) {
    return items
  }
  const next = [...items]
  ;[next[index], next[target]] = [next[target], next[index]]
  return next
}
