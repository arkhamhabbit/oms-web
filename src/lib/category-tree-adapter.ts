import type { CategoryNode } from '@/fixtures/categories'
import type { CategoryTreeNode } from '@/api/categories'

/** `CategoryTree` (W0.1a) renders the fixture-shaped `CategoryNode`; the real API's
 * `CategoryTreeResponse` is a superset (adds `parentId`, `displayOrder`) with every field
 * optional, since nothing in the OpenAPI spec marks them required. This narrows one to the
 * other for display — the full node (with parentId) stays available via `flattenCategoryTree`
 * for anything that needs it. */
export function toCategoryNodes(nodes: CategoryTreeNode[]): CategoryNode[] {
  return nodes.map((node) => ({
    id: node.id ?? '',
    name: node.name ?? '(unnamed)',
    slug: node.slug ?? '',
    status: node.status ?? 'DRAFT',
    live: node.live ?? false,
    children: toCategoryNodes(node.children ?? []),
  }))
}

export interface FlatCategoryOption {
  id: string
  depth: number
  node: CategoryTreeNode
  /** True for the node being edited or anything beneath it — an invalid parent choice (cycle). */
  disabled: boolean
}

/** Flattens the tree depth-first for a parent picker, marking `excludeId` and its descendants. */
export function flattenCategoryTree(
  nodes: CategoryTreeNode[],
  excludeId?: string,
  depth = 0,
  excludedSubtree = false
): FlatCategoryOption[] {
  return nodes.flatMap((node) => {
    const disabled = excludedSubtree || node.id === excludeId
    const option: FlatCategoryOption = { id: node.id ?? '', depth, node, disabled }
    return [option, ...flattenCategoryTree(node.children ?? [], excludeId, depth + 1, disabled)]
  })
}

/** Every node by id, for looking up a node's full detail (parentId, displayOrder) after
 * selecting it in the simplified tree view. */
export function indexCategoryTree(nodes: CategoryTreeNode[]): Map<string, CategoryTreeNode> {
  const index = new Map<string, CategoryTreeNode>()
  function walk(list: CategoryTreeNode[]) {
    for (const node of list) {
      if (node.id) {
        index.set(node.id, node)
      }
      walk(node.children ?? [])
    }
  }
  walk(nodes)
  return index
}
