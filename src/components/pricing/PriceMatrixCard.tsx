import type { ColumnDef } from '@tanstack/react-table'

import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { DataTable } from '@/components/data-table/DataTable'
import { isApiError } from '@/lib/api-error'
import { formatMoney } from '@/lib/money'
import { usePriceMatrixQuery, type TierPrice } from '@/api/pricing'

const SOURCE_COPY: Record<NonNullable<TierPrice['source']>, string> = {
  TIER_PRICE: 'Tier price',
  BASE_SELLING_PRICE: 'Base selling price',
  CAPPED_AT_BASE: 'Capped at base',
}

/**
 * What every tier actually pays for one variant at `at` (now when omitted) — the resolution the
 * storefront and checkout use (D7.2), including a price capped at a base the catalog has since
 * lowered (D7.12). Always the *published* versions in effect at that instant; a draft governs
 * nothing, so it never appears here.
 */
function PriceMatrixCard({
  variantId,
  at,
  label,
}: {
  variantId: string
  at?: string
  label: string
}) {
  const matrix = usePriceMatrixQuery(variantId, at)

  const columns: ColumnDef<TierPrice, unknown>[] = [
    {
      id: 'tier',
      header: 'Tier',
      cell: ({ row }) => `${row.original.tierName} (${row.original.tierCode})`,
    },
    { id: 'level', header: 'Level', cell: ({ row }) => row.original.pricingLevel },
    { id: 'price', header: 'Pays', cell: ({ row }) => formatMoney(row.original.price) },
    {
      id: 'source',
      header: 'From',
      cell: ({ row }) => {
        const source = row.original.source
        if (!source) {
          return ''
        }
        return (
          <span className="flex items-center gap-1.5">
            <Badge variant={source === 'CAPPED_AT_BASE' ? 'destructive' : 'outline'}>
              {SOURCE_COPY[source]}
            </Badge>
            {row.original.sourceLevel && row.original.sourceLevel !== row.original.pricingLevel && (
              <span className="text-xs text-muted-foreground">
                via {row.original.sourceLevel.toLowerCase()} price
              </span>
            )}
          </span>
        )
      },
    },
  ]

  return (
    <Card>
      <CardHeader>
        <CardTitle>Price matrix — {label}</CardTitle>
        {matrix.data && (
          <CardDescription>
            <span className="font-mono">{matrix.data.skuCode}</span> · MRP{' '}
            {formatMoney(matrix.data.mrp)} · base {formatMoney(matrix.data.baseSellingPrice)} ·
            resolved {new Date(matrix.data.resolvedAt!).toLocaleString()}
            {matrix.data.validUntil &&
              ` · changes ${new Date(matrix.data.validUntil).toLocaleString()} when a scheduled version takes over`}
          </CardDescription>
        )}
      </CardHeader>
      <CardContent>
        {matrix.isError ? (
          <p role="alert" className="text-sm text-destructive">
            {isApiError(matrix.error) ? matrix.error.message : 'The matrix could not be loaded.'}
          </p>
        ) : (
          <DataTable
            columns={columns}
            data={matrix.data?.tiers ?? []}
            isLoading={matrix.isLoading}
            emptyMessage="No tiers in the ladder in effect."
          />
        )}
      </CardContent>
    </Card>
  )
}

export { PriceMatrixCard }
