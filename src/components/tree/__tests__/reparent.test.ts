import { describe, expect, it } from 'vitest'

import { reparentTree } from '@/components/tree/reparent'
import type { CategoryNode } from '@/fixtures/categories'

function leaf(id: string): CategoryNode {
  return { id, name: id, slug: id, status: 'ACTIVE', live: true, children: [] }
}

function makeTree(): CategoryNode[] {
  return [
    { id: 'a', name: 'A', slug: 'a', status: 'ACTIVE', live: true, children: [leaf('a1'), leaf('a2')] },
    { id: 'b', name: 'B', slug: 'b', status: 'ACTIVE', live: true, children: [leaf('b1')] },
  ]
}

function findNode(nodes: CategoryNode[], id: string): CategoryNode | undefined {
  for (const node of nodes) {
    if (node.id === id) return node
    const found = findNode(node.children, id)
    if (found) return found
  }
  return undefined
}

describe('reparentTree', () => {
  it('moves a node from one parent into another', () => {
    const next = reparentTree(makeTree(), ['a1'], 'b', 1)

    const a = findNode(next, 'a')!
    const b = findNode(next, 'b')!
    expect(a.children.map((c) => c.id)).toEqual(['a2'])
    expect(b.children.map((c) => c.id)).toEqual(['b1', 'a1'])
  })

  it('moves a node to the tree root', () => {
    const next = reparentTree(makeTree(), ['a1'], null, 0)

    expect(next.map((n) => n.id)).toEqual(['a1', 'a', 'b'])
    expect(findNode(next, 'a')!.children.map((c) => c.id)).toEqual(['a2'])
  })

  it('reorders siblings within the same parent without losing any node', () => {
    const next = reparentTree(makeTree(), ['a2'], 'a', 0)

    expect(findNode(next, 'a')!.children.map((c) => c.id)).toEqual(['a2', 'a1'])
  })

  it('carries the moved node with its own children intact (three-level move)', () => {
    const tree = makeTree()
    // Give 'a' itself a grandchild-bearing subtree, then move 'a' under 'b'.
    const withGrandchild: CategoryNode[] = [
      { ...tree[0], children: [{ ...leaf('a1'), children: [leaf('a1x')] }] },
      tree[1],
    ]

    const next = reparentTree(withGrandchild, ['a'], 'b', 0)

    const b = findNode(next, 'b')!
    expect(b.children.map((c) => c.id)).toEqual(['a', 'b1'])
    const movedA = findNode(next, 'a')!
    expect(movedA.children[0].children.map((c) => c.id)).toEqual(['a1x'])
  })

  it('is a no-op when the dragged id does not exist', () => {
    const tree = makeTree()
    const next = reparentTree(tree, ['does-not-exist'], 'b', 0)
    expect(next).toEqual(tree)
  })
})
