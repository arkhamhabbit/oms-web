import { Tree, type MoveHandler, type NodeApi, type NodeRendererProps } from 'react-arborist'
import { ChevronDown, ChevronRight, Folder } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import type { CategoryNode } from '@/fixtures/categories'
import { reparentTree } from '@/components/tree/reparent'

export interface CategoryTreeProps {
  data: CategoryNode[]
  onChange?: (data: CategoryNode[]) => void
  /**
   * Fired alongside `onChange`, with the pre-move tree, so a caller backed by a real API can
   * persist the move and — if the server rejects it (cycle, max depth) — roll back by calling
   * `onChange` again with `previousData`. The optimistic splice already happened by the time
   * this fires; rollback is the caller's responsibility, not silent, per the task's requirement
   * that a rejected reparent be visible rather than swallowed.
   */
  onMove?: (dragIds: string[], parentId: string | null, previousData: CategoryNode[]) => void
  onSelect?: (nodes: NodeApi<CategoryNode>[]) => void
  height?: number
}

function statusVariant(status: CategoryNode['status']) {
  switch (status) {
    case 'ACTIVE':
      return 'default' as const
    case 'IN_REVIEW':
      return 'secondary' as const
    case 'ARCHIVED':
      return 'outline' as const
    default:
      return 'outline' as const
  }
}

function CategoryTreeNode({ node, style, dragHandle }: NodeRendererProps<CategoryNode>) {
  return (
    <div
      ref={dragHandle}
      style={style}
      className={cn(
        'flex items-center gap-1.5 rounded-md px-1 text-sm',
        node.isSelected && 'bg-accent text-accent-foreground'
      )}
      onClick={() => {
        node.select()
        if (node.isInternal) {
          node.toggle()
        }
      }}
    >
      {node.isInternal ? (
        node.isOpen ? (
          <ChevronDown className="size-3.5 shrink-0" />
        ) : (
          <ChevronRight className="size-3.5 shrink-0" />
        )
      ) : (
        <span className="size-3.5 shrink-0" />
      )}
      <Folder className="size-3.5 shrink-0 text-muted-foreground" />
      <span className="truncate">{node.data.name}</span>
      <Badge variant={statusVariant(node.data.status)} className="ml-1 text-[10px]">
        {node.data.status}
      </Badge>
      {node.data.live && (
        <Badge variant="secondary" className="text-[10px]">
          LIVE
        </Badge>
      )}
    </div>
  )
}

/**
 * Three-level category tree with drag-to-reparent, backed by react-arborist. Renders from a
 * fixture shaped like GET /api/admin/categories/tree — id, name, slug, status, live, children.
 */
function CategoryTree({ data, onChange, onMove, onSelect, height = 400 }: CategoryTreeProps) {
  const handleMove: MoveHandler<CategoryNode> = ({ dragIds, parentId, index }) => {
    onChange?.(reparentTree(data, dragIds, parentId, index))
    onMove?.(dragIds, parentId, data)
  }

  return (
    <Tree<CategoryNode>
      data={data}
      idAccessor="id"
      childrenAccessor="children"
      onMove={handleMove}
      onSelect={onSelect}
      openByDefault
      width="100%"
      height={height}
      indent={20}
      rowHeight={28}
    >
      {CategoryTreeNode}
    </Tree>
  )
}

export { CategoryTree }
export type { NodeApi }
