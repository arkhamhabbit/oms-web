import { useMemo } from 'react'
import type { ColumnDef } from '@tanstack/react-table'

import { DataTable } from '@/components/data-table/DataTable'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { useBreadcrumb } from '@/layouts/breadcrumb-context'
import { productsFixture, type Product } from '@/fixtures/products'
import { minorToMajorString } from '@/lib/money'

const columns: ColumnDef<Product, unknown>[] = [
  { accessorKey: 'name', header: 'Product' },
  { accessorKey: 'brand', header: 'Brand' },
  { accessorKey: 'category', header: 'Category' },
  {
    accessorKey: 'status',
    header: 'Status',
    cell: ({ row }) => <Badge variant="outline">{row.original.status}</Badge>,
  },
  {
    id: 'variants',
    header: 'Variants',
    accessorFn: (row) => row.variants.length,
  },
]

function VariantsSubRow({ product }: { product: Product }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>SKU</TableHead>
          <TableHead>Options</TableHead>
          <TableHead>MRP</TableHead>
          <TableHead>Selling price</TableHead>
          <TableHead>Batch tracked</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {product.variants.map((variant) => (
          <TableRow key={variant.id}>
            <TableCell className="font-mono text-xs">{variant.skuCode}</TableCell>
            <TableCell>{variant.optionSignature}</TableCell>
            <TableCell>
              {variant.currency} {minorToMajorString(variant.mrpMinor)}
            </TableCell>
            <TableCell>
              {variant.currency} {minorToMajorString(variant.basePriceMinor)}
            </TableCell>
            <TableCell>{variant.batchTracked ? 'Yes' : 'No'}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}

function ProductsPage() {
  useBreadcrumb([{ label: 'Products' }])
  const data = useMemo(() => productsFixture, [])

  return (
    <DataTable
      columns={columns}
      data={data}
      renderSubRow={(product) => <VariantsSubRow product={product} />}
      pageSize={5}
    />
  )
}

export default ProductsPage
