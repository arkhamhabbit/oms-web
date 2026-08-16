import * as React from 'react'
import type { ColumnDef } from '@tanstack/react-table'
import { ArrowDownIcon, ArrowUpIcon, PencilIcon, PlusIcon } from 'lucide-react'

import { DataTable } from '@/components/data-table/DataTable'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { CatalogStatusBadges } from '@/components/catalog/CatalogStatusBadges'
import { TransitionMenu } from '@/components/catalog/TransitionMenu'
import { BrandFormDialog } from '@/components/catalog/BrandFormDialog'
import { useBreadcrumb } from '@/layouts/breadcrumb-context'
import { usePermissions } from '@/auth/usePermissions'
import { toastApiError } from '@/lib/api-error'
import type { CatalogStatus } from '@/lib/catalog-transitions'
import {
  useActivateBrandMutation,
  useArchiveBrandMutation,
  useBrandsQuery,
  usePublishBrandMutation,
  useReorderBrandsMutation,
  useUnpublishBrandMutation,
  type Brand,
  type BrandStatus,
} from '@/api/brands'

const PAGE_SIZE = 20
const STATUS_OPTIONS: BrandStatus[] = ['DRAFT', 'IN_REVIEW', 'ACTIVE', 'ARCHIVED']

function BrandsPage() {
  useBreadcrumb([{ label: 'Brands' }])
  const { has } = usePermissions()
  const canWrite = has('catalog.brand.write')
  const canPublish = has('catalog.brand.publish')

  const [pageIndex, setPageIndex] = React.useState(0)
  const [status, setStatus] = React.useState<BrandStatus | 'ALL'>('ALL')
  const [live, setLive] = React.useState<'ALL' | 'true' | 'false'>('ALL')
  const [search, setSearch] = React.useState('')

  const isFiltered = status !== 'ALL' || live !== 'ALL' || search !== ''

  const brandsQuery = useBrandsQuery({
    page: pageIndex,
    size: PAGE_SIZE,
    status: status === 'ALL' ? undefined : status,
    live: live === 'ALL' ? undefined : live === 'true',
    search,
  })

  const activate = useActivateBrandMutation()
  const publish = usePublishBrandMutation()
  const unpublish = useUnpublishBrandMutation()
  const archive = useArchiveBrandMutation()
  const reorder = useReorderBrandsMutation()

  const [formOpen, setFormOpen] = React.useState(false)
  const [editingBrand, setEditingBrand] = React.useState<Brand | undefined>(undefined)

  function openCreate() {
    setEditingBrand(undefined)
    setFormOpen(true)
  }
  function openEdit(brand: Brand) {
    setEditingBrand(brand)
    setFormOpen(true)
  }

  function runTransition(brand: Brand, action: 'activate' | 'publish' | 'unpublish' | 'archive') {
    const mutation = { activate, publish, unpublish, archive }[action]
    return mutation.mutateAsync(brand.id!)
  }

  const rows = brandsQuery.data?.content ?? []

  function move(index: number, direction: -1 | 1) {
    const target = index + direction
    if (target < 0 || target >= rows.length) {
      return
    }
    const reordered = [...rows]
    ;[reordered[index], reordered[target]] = [reordered[target], reordered[index]]
    reorder
      .mutateAsync({ orderedIds: reordered.map((b) => b.id!) })
      .catch((error) => toastApiError(error))
  }

  const columns: ColumnDef<Brand, unknown>[] = [
    { accessorKey: 'name', header: 'Name' },
    { accessorKey: 'slug', header: 'Slug' },
    {
      id: 'status',
      header: 'Status',
      cell: ({ row }) => (
        <CatalogStatusBadges status={row.original.status as CatalogStatus} live={!!row.original.live} />
      ),
    },
    { accessorKey: 'displayOrder', header: 'Order' },
    {
      id: 'actions',
      header: '',
      cell: ({ row }) => {
        const index = rows.indexOf(row.original)
        return (
          <div className="flex items-center justify-end gap-1">
            {!isFiltered && (
              <>
                <Button
                  variant="ghost"
                  size="icon"
                  disabled={!canWrite || index === 0}
                  title="Move up"
                  onClick={() => move(index, -1)}
                >
                  <ArrowUpIcon />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  disabled={!canWrite || index === rows.length - 1}
                  title="Move down"
                  onClick={() => move(index, 1)}
                >
                  <ArrowDownIcon />
                </Button>
              </>
            )}
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
        )
      },
    },
  ]

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
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
              setStatus(value as BrandStatus | 'ALL')
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
        <Button disabled={!canWrite} onClick={openCreate}>
          <PlusIcon /> New brand
        </Button>
      </div>

      <DataTable
        columns={columns}
        data={rows}
        isLoading={brandsQuery.isLoading}
        emptyMessage="No brands match these filters."
        serverPagination={{
          pageIndex,
          pageSize: PAGE_SIZE,
          pageCount: brandsQuery.data?.totalPages ?? 0,
          totalElements: brandsQuery.data?.totalElements ?? 0,
          onPageIndexChange: setPageIndex,
        }}
      />

      <BrandFormDialog open={formOpen} onOpenChange={setFormOpen} brand={editingBrand} />
    </div>
  )
}

export default BrandsPage
