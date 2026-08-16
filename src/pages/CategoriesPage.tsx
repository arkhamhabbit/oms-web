import * as React from 'react'
import type { ColumnDef } from '@tanstack/react-table'
import { PencilIcon, PlusIcon } from 'lucide-react'
import { toast } from 'sonner'

import { CategoryTree } from '@/components/tree/CategoryTree'
import { DataTable } from '@/components/data-table/DataTable'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { CatalogStatusBadges } from '@/components/catalog/CatalogStatusBadges'
import { TransitionMenu } from '@/components/catalog/TransitionMenu'
import { CategoryFormDialog } from '@/components/catalog/CategoryFormDialog'
import type { CategoryNode } from '@/fixtures/categories'
import { useBreadcrumb } from '@/layouts/breadcrumb-context'
import { usePermissions } from '@/auth/usePermissions'
import { toastApiError } from '@/lib/api-error'
import type { CatalogStatus } from '@/lib/catalog-transitions'
import { indexCategoryTree, toCategoryNodes } from '@/lib/category-tree-adapter'
import {
  useActivateCategoryMutation,
  useArchiveCategoryMutation,
  useCategoriesQuery,
  useCategoryQuery,
  useCategoryTreeQuery,
  useMoveCategoryMutation,
  usePublishCategoryMutation,
  useUnpublishCategoryMutation,
  type Category,
  type CategoryStatus,
  type CategoryTreeNode,
} from '@/api/categories'

const PAGE_SIZE = 20
const STATUS_OPTIONS: CategoryStatus[] = ['DRAFT', 'IN_REVIEW', 'ACTIVE', 'ARCHIVED']

function CategoryDetailPanel({
  node,
  onEdit,
  onAddChild,
}: {
  node: CategoryTreeNode
  onEdit: () => void
  onAddChild: () => void
}) {
  const { has } = usePermissions()
  const canWrite = has('catalog.category.write')
  const canPublish = has('catalog.category.publish')

  const activate = useActivateCategoryMutation()
  const publish = usePublishCategoryMutation()
  const unpublish = useUnpublishCategoryMutation()
  const archive = useArchiveCategoryMutation()

  function runTransition(action: 'activate' | 'publish' | 'unpublish' | 'archive') {
    const mutation = { activate, publish, unpublish, archive }[action]
    return mutation.mutateAsync(node.id!)
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{node.name}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <CatalogStatusBadges status={(node.status ?? 'DRAFT') as CatalogStatus} live={!!node.live} />
        <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
          <dt className="text-muted-foreground">Slug</dt>
          <dd>{node.slug}</dd>
          <dt className="text-muted-foreground">Display order</dt>
          <dd>{node.displayOrder}</dd>
        </dl>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" disabled={!canWrite} onClick={onEdit}>
            <PencilIcon /> Edit
          </Button>
          <Button variant="outline" size="sm" disabled={!canWrite} onClick={onAddChild}>
            <PlusIcon /> Add subcategory
          </Button>
          <TransitionMenu
            status={(node.status ?? 'DRAFT') as CatalogStatus}
            live={!!node.live}
            canPublish={canPublish}
            onTransition={runTransition}
          />
        </div>
      </CardContent>
    </Card>
  )
}

function TreeView() {
  const treeQuery = useCategoryTreeQuery()
  const moveCategory = useMoveCategoryMutation()
  const { has } = usePermissions()
  const canWrite = has('catalog.category.write')

  // Mirrors `treeQuery.data` into local state for optimistic drag-and-drop edits, resetting
  // whenever a fresh fetch lands. Adjusted during render (React's documented pattern for
  // "state derived from a prop that changed") rather than in an effect, which would cause an
  // extra commit.
  const [tree, setTree] = React.useState<{ source?: CategoryTreeNode[]; local: CategoryNode[] }>({
    source: undefined,
    local: [],
  })
  if (treeQuery.data && treeQuery.data !== tree.source) {
    setTree({ source: treeQuery.data, local: toCategoryNodes(treeQuery.data) })
  }
  const localTree = tree.local
  const setLocalTree = (local: CategoryNode[]) => setTree((prev) => ({ ...prev, local }))
  const [selectedId, setSelectedId] = React.useState<string | undefined>(undefined)
  const [formOpen, setFormOpen] = React.useState(false)
  const [creating, setCreating] = React.useState(false)
  const [editingCategoryId, setEditingCategoryId] = React.useState<string | undefined>(undefined)
  const [defaultParentId, setDefaultParentId] = React.useState<string | undefined>(undefined)
  // The tree endpoint's node shape has no description/imageUrl/bannerUrl — an edit dialog
  // opened from here needs the full CategoryResponse, fetched by id, not the tree projection.
  const editingCategoryQuery = useCategoryQuery(editingCategoryId)

  const nodeIndex = React.useMemo(() => indexCategoryTree(treeQuery.data ?? []), [treeQuery.data])
  const selectedNode = selectedId ? nodeIndex.get(selectedId) : undefined

  function handleMove(dragIds: string[], parentId: string | null, previousData: CategoryNode[]) {
    if (!canWrite) {
      setLocalTree(previousData)
      toastApiError(new Error('You do not have permission to move categories'))
      return
    }
    Promise.all(dragIds.map((id) => moveCategory.mutateAsync({ id, newParentId: parentId ?? undefined })))
      .then(() => toast.success('Category moved'))
      .catch((error) => {
        // The optimistic splice already happened in the tree component — roll it back
        // visibly rather than leaving a move the server rejected sitting in the UI.
        setLocalTree(previousData)
        toastApiError(error)
      })
  }

  function openEdit(node: CategoryTreeNode) {
    setCreating(false)
    setEditingCategoryId(node.id)
    setFormOpen(true)
  }
  function openAddChild(node: CategoryTreeNode) {
    setCreating(true)
    setEditingCategoryId(undefined)
    setDefaultParentId(node.id)
    setFormOpen(true)
  }
  function openCreateRoot() {
    setCreating(true)
    setEditingCategoryId(undefined)
    setDefaultParentId(undefined)
    setFormOpen(true)
  }

  // Waits for the full detail fetch before rendering the dialog in edit mode, so it never
  // flashes as a "create" form (empty defaults) while `editingCategoryQuery` is still loading.
  const dialogOpen = formOpen && (creating || !!editingCategoryQuery.data)

  return (
    <div className="flex flex-col gap-4">
      <div className="flex justify-end">
        <Button disabled={!canWrite} onClick={openCreateRoot}>
          <PlusIcon /> New root category
        </Button>
      </div>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="rounded-lg border p-2">
          <CategoryTree
            data={localTree}
            onChange={setLocalTree}
            onMove={handleMove}
            onSelect={(nodes) => setSelectedId(nodes[0]?.data.id)}
            height={520}
          />
        </div>
        {selectedNode ? (
          <CategoryDetailPanel
            node={selectedNode}
            onEdit={() => openEdit(selectedNode)}
            onAddChild={() => openAddChild(selectedNode)}
          />
        ) : (
          <Card>
            <CardContent className="pt-6 text-sm text-muted-foreground">
              Select a category to view and act on it.
            </CardContent>
          </Card>
        )}
      </div>

      <CategoryFormDialog
        open={dialogOpen}
        onOpenChange={setFormOpen}
        category={creating ? undefined : editingCategoryQuery.data}
        defaultParentId={defaultParentId}
      />
    </div>
  )
}

function SearchView() {
  const { has } = usePermissions()
  const canWrite = has('catalog.category.write')
  const canPublish = has('catalog.category.publish')

  const [pageIndex, setPageIndex] = React.useState(0)
  const [status, setStatus] = React.useState<CategoryStatus | 'ALL'>('ALL')
  const [live, setLive] = React.useState<'ALL' | 'true' | 'false'>('ALL')
  const [search, setSearch] = React.useState('')

  const categoriesQuery = useCategoriesQuery({
    page: pageIndex,
    size: PAGE_SIZE,
    status: status === 'ALL' ? undefined : status,
    live: live === 'ALL' ? undefined : live === 'true',
    search,
  })

  const activate = useActivateCategoryMutation()
  const publish = usePublishCategoryMutation()
  const unpublish = useUnpublishCategoryMutation()
  const archive = useArchiveCategoryMutation()

  const [formOpen, setFormOpen] = React.useState(false)
  const [editingCategory, setEditingCategory] = React.useState<Category | undefined>(undefined)

  function openEdit(category: Category) {
    setEditingCategory(category)
    setFormOpen(true)
  }

  function runTransition(category: Category, action: 'activate' | 'publish' | 'unpublish' | 'archive') {
    const mutation = { activate, publish, unpublish, archive }[action]
    return mutation.mutateAsync(category.id!)
  }

  const columns: ColumnDef<Category, unknown>[] = [
    { accessorKey: 'name', header: 'Name' },
    { accessorKey: 'slug', header: 'Slug' },
    {
      id: 'status',
      header: 'Status',
      cell: ({ row }) => (
        <CatalogStatusBadges
          status={row.original.status as CatalogStatus}
          live={!!row.original.live}
        />
      ),
    },
    {
      id: 'actions',
      header: '',
      cell: ({ row }) => (
        <div className="flex items-center justify-end gap-1">
          <Button
            variant="ghost"
            size="icon"
            disabled={!canWrite}
            title="Edit"
            onClick={() => openEdit(row.original)}
          >
            <PencilIcon />
          </Button>
          <TransitionMenu
            status={row.original.status as CatalogStatus}
            live={!!row.original.live}
            canPublish={canPublish}
            onTransition={(action) => runTransition(row.original, action)}
          />
        </div>
      ),
    },
  ]

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <Input
          placeholder="Search name or slug…"
          value={search}
          onChange={(event) => {
            setSearch(event.target.value)
            setPageIndex(0)
          }}
          className="w-64"
        />
        <Select
          value={status}
          onValueChange={(value) => {
            setStatus(value as CategoryStatus | 'ALL')
            setPageIndex(0)
          }}
        >
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All statuses</SelectItem>
            {STATUS_OPTIONS.map((s) => (
              <SelectItem key={s} value={s}>
                {s}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={live}
          onValueChange={(value) => {
            setLive(value as 'ALL' | 'true' | 'false')
            setPageIndex(0)
          }}
        >
          <SelectTrigger className="w-36">
            <SelectValue placeholder="Live" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">Live or not</SelectItem>
            <SelectItem value="true">Live</SelectItem>
            <SelectItem value="false">Not live</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <DataTable
        columns={columns}
        data={categoriesQuery.data?.content ?? []}
        isLoading={categoriesQuery.isLoading}
        emptyMessage="No categories match these filters."
        serverPagination={{
          pageIndex,
          pageSize: PAGE_SIZE,
          pageCount: categoriesQuery.data?.totalPages ?? 0,
          totalElements: categoriesQuery.data?.totalElements ?? 0,
          onPageIndexChange: setPageIndex,
        }}
      />

      <CategoryFormDialog open={formOpen} onOpenChange={setFormOpen} category={editingCategory} />
    </div>
  )
}

function CategoriesPage() {
  useBreadcrumb([{ label: 'Categories' }])
  const [view, setView] = React.useState<'tree' | 'search'>('tree')

  return (
    <div className="flex flex-col gap-4">
      <div className="flex gap-2">
        <Button variant={view === 'tree' ? 'default' : 'outline'} size="sm" onClick={() => setView('tree')}>
          Tree
        </Button>
        <Button
          variant={view === 'search' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setView('search')}
        >
          Search
        </Button>
      </div>
      {view === 'tree' ? <TreeView /> : <SearchView />}
    </div>
  )
}

export default CategoriesPage
