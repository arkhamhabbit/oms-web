import * as React from 'react'
import { useNavigate } from 'react-router-dom'
import type { ColumnDef } from '@tanstack/react-table'
import { PlusIcon } from 'lucide-react'

import { DataTable } from '@/components/data-table/DataTable'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { CatalogStatusBadges } from '@/components/catalog/CatalogStatusBadges'
import { ProductFormDialog } from '@/components/catalog/ProductFormDialog'
import { useBreadcrumb } from '@/layouts/breadcrumb-context'
import { usePermissions } from '@/auth/usePermissions'
import type { CatalogStatus } from '@/lib/catalog-transitions'
import { useBrandsQuery } from '@/api/brands'
import {
  useProductsQuery,
  type Product,
  type ProductAudience,
  type ProductStatus,
} from '@/api/products'

const PAGE_SIZE = 20
const STATUS_OPTIONS: ProductStatus[] = ['DRAFT', 'IN_REVIEW', 'ACTIVE', 'ARCHIVED']
const AUDIENCE_OPTIONS: ProductAudience[] = ['PUBLIC', 'TIER_RESTRICTED', 'CUSTOMER_RESTRICTED']

function ProductsPage() {
  useBreadcrumb([{ label: 'Products' }])
  const navigate = useNavigate()
  const { has } = usePermissions()
  const canWrite = has('catalog.product.write')

  const [pageIndex, setPageIndex] = React.useState(0)
  const [status, setStatus] = React.useState<ProductStatus | 'ALL'>('ALL')
  const [live, setLive] = React.useState<'ALL' | 'true' | 'false'>('ALL')
  const [audience, setAudience] = React.useState<ProductAudience | 'ALL'>('ALL')
  const [brandId, setBrandId] = React.useState<string | 'ALL'>('ALL')
  const [search, setSearch] = React.useState('')

  // All brands, for both the filter select and looking up a row's brand name — the list
  // endpoint returns only `brandId` (see the column note below).
  const brandsQuery = useBrandsQuery({ page: 0, size: 200 })
  const brandsById = new Map((brandsQuery.data?.content ?? []).map((b) => [b.id, b]))

  const productsQuery = useProductsQuery({
    page: pageIndex,
    size: PAGE_SIZE,
    status: status === 'ALL' ? undefined : status,
    live: live === 'ALL' ? undefined : live === 'true',
    audience: audience === 'ALL' ? undefined : audience,
    brandId: brandId === 'ALL' ? undefined : brandId,
    search,
  })

  const [formOpen, setFormOpen] = React.useState(false)
  const rows = productsQuery.data?.content ?? []

  const columns: ColumnDef<Product, unknown>[] = [
    { accessorKey: 'name', header: 'Name' },
    {
      id: 'brand',
      header: 'Brand',
      cell: ({ row }) => brandsById.get(row.original.brandId)?.name ?? '—',
    },
    {
      id: 'primaryCategory',
      header: 'Primary category',
      // Contract gap (flagged in the task's Status block): `ProductResponse` (the list shape)
      // carries no category information at all — only `ProductDetailResponse` (a per-product
      // single-get) does. Showing this column accurately for every row of a list would mean one
      // extra request per row, which this list does not do. Open the product to see it.
      cell: () => <span className="text-muted-foreground">—</span>,
    },
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
      id: 'variantCount',
      header: 'Variants',
      // Same contract gap as primary category — not on the list shape.
      cell: () => <span className="text-muted-foreground">—</span>,
    },
    { accessorKey: 'audience', header: 'Audience' },
  ]

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <Input
            placeholder="Search name, slug or SKU…"
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
              setStatus(value as ProductStatus | 'ALL')
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
          <Select
            value={brandId}
            onValueChange={(value) => {
              setBrandId(value)
              setPageIndex(0)
            }}
          >
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Brand" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All brands</SelectItem>
              {(brandsQuery.data?.content ?? []).map((brand) => (
                <SelectItem key={brand.id} value={brand.id!}>
                  {brand.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={audience}
            onValueChange={(value) => {
              setAudience(value as ProductAudience | 'ALL')
              setPageIndex(0)
            }}
          >
            <SelectTrigger className="w-44">
              <SelectValue placeholder="Audience" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All audiences</SelectItem>
              {AUDIENCE_OPTIONS.map((a) => (
                <SelectItem key={a} value={a}>
                  {a}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button disabled={!canWrite} onClick={() => setFormOpen(true)}>
          <PlusIcon /> New product
        </Button>
      </div>

      <DataTable
        columns={columns}
        data={rows}
        isLoading={productsQuery.isLoading}
        emptyMessage="No products match these filters."
        onRowClick={(product) => navigate(`/products/${product.id}`)}
        serverPagination={{
          pageIndex,
          pageSize: PAGE_SIZE,
          pageCount: productsQuery.data?.totalPages ?? 0,
          totalElements: productsQuery.data?.totalElements ?? 0,
          onPageIndexChange: setPageIndex,
        }}
      />

      <ProductFormDialog open={formOpen} onOpenChange={setFormOpen} />
    </div>
  )
}

export default ProductsPage
