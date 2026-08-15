import type { CategoryNode } from '@/fixtures/categories'

/** Removes the node with `id` from `nodes` (recursively) and returns [remaining, removedNode]. */
function removeNode(nodes: CategoryNode[], id: string): [CategoryNode[], CategoryNode | null] {
  let removed: CategoryNode | null = null
  const result: CategoryNode[] = []
  for (const node of nodes) {
    if (node.id === id) {
      removed = node
      continue
    }
    const [children, childRemoved] = removeNode(node.children, id)
    if (childRemoved) {
      removed = childRemoved
    }
    result.push({ ...node, children })
  }
  return [result, removed]
}

function insertNode(
  nodes: CategoryNode[],
  parentId: string | null,
  node: CategoryNode,
  index: number
): CategoryNode[] {
  if (parentId === null) {
    const result = [...nodes]
    result.splice(index, 0, node)
    return result
  }
  return nodes.map((n) => {
    if (n.id === parentId) {
      const children = [...n.children]
      children.splice(index, 0, node)
      return { ...n, children }
    }
    return { ...n, children: insertNode(n.children, parentId, node, index) }
  })
}

/**
 * Moves each node in `dragIds` out of its current position and into `parentId` at `index`,
 * matching react-arborist's onMove contract. `parentId: null` means the tree root.
 */
export function reparentTree(
  data: CategoryNode[],
  dragIds: string[],
  parentId: string | null,
  index: number
): CategoryNode[] {
  let next = data
  for (const dragId of dragIds) {
    const [withoutNode, removed] = removeNode(next, dragId)
    if (!removed) {
      continue
    }
    next = insertNode(withoutNode, parentId, removed, index)
  }
  return next
}
