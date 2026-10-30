import { Link, useParams } from 'react-router-dom'

import { BackLink, DetailError, Facts } from '@/components/common/PageParts'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { usePermissions } from '@/auth/usePermissions'
import { useBreadcrumb } from '@/layouts/breadcrumb-context'
import { useGoodsReceiptQuery } from '@/api/procurement'
import { formatDate } from '@/lib/dates'
import { minorToMajorString } from '@/lib/money'
import { formatDateTime } from '@/lib/dates'

const rupees = (money: { amountMinor?: number } | undefined) =>
  money?.amountMinor === undefined ? '—' : `₹${minorToMajorString(money.amountMinor)}`

function GoodsReceiptDetailPage() {
  const { id = '' } = useParams()
  const { has } = usePermissions()
  const query = useGoodsReceiptQuery(id)
  const receipt = query.data

  useBreadcrumb([
    { label: 'Procurement' },
    { label: 'Goods receipts', to: '/procurement/goods-receipts' },
    { label: receipt?.grnNumber ?? 'Receipt' },
  ])

  if (query.isLoading) {
    return <p className="text-sm text-muted-foreground">Loading…</p>
  }
  if (query.isError || !receipt) {
    return (
      <DetailError
        error={query.error}
        noun="goods receipt"
        back={{ to: '/procurement/goods-receipts', label: 'Goods receipts' }}
        permission="procurement.grn.read"
      />
    )
  }

  return (
    <div className="flex max-w-5xl flex-col gap-4">
      <BackLink to="/procurement/goods-receipts" label="Goods receipts" />
      <h1 className="font-mono text-xl font-semibold">{receipt.grnNumber}</h1>

      <Card>
        <CardHeader>
          <CardTitle>Receipt</CardTitle>
          <CardDescription>A posted receipt cannot be edited.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          <Facts
            rows={[
              [
                'Purchase order',
                <Link
                  className="font-mono underline"
                  to={`/procurement/purchase-orders/${receipt.purchaseOrderId}`}
                >
                  {receipt.poNumber}
                </Link>,
              ],
              ['Warehouse', <span className="font-mono">{receipt.warehouseCode}</span>],
              ['Received on', formatDate(receipt.receivedOn)],
              ['Supplier’s invoice', receipt.supplierInvoiceNumber],
              ['Accepted', String(receipt.quantityReceived ?? 0)],
              ['Rejected', String(receipt.quantityRejected ?? 0)],
              ['Cost', rupees(receipt.totalCost)],
              ['Notes', receipt.notes],
              ['Posted', formatDateTime(receipt.createdAt)],
            ]}
          />
          {has('inventory.read') && (
            <p className="text-sm">
              <Link className="underline" to="/inventory/stock">
                See the stock totals
              </Link>{' '}
              ·{' '}
              <Link
                className="underline"
                to={`/inventory/stock?tab=movements&warehouse=${receipt.warehouseId}`}
              >
                Movements in {receipt.warehouseCode}
              </Link>
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Lines</CardTitle>
          <CardDescription>
            Each accepted line is one stock movement referencing {receipt.poNumber}.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>SKU</TableHead>
                <TableHead>Item</TableHead>
                <TableHead>Batch</TableHead>
                <TableHead className="text-right">Accepted</TableHead>
                <TableHead className="text-right">Rejected</TableHead>
                <TableHead className="text-right">Unit cost</TableHead>
                <TableHead className="text-right">Line cost</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(receipt.lines ?? []).map((line) => (
                <TableRow key={line.id}>
                  <TableCell className="font-mono">{line.skuCode}</TableCell>
                  <TableCell>{line.variantName}</TableCell>
                  <TableCell className="font-mono">{line.batchNumber ?? ''}</TableCell>
                  <TableCell className="text-right">{line.quantityReceived}</TableCell>
                  <TableCell className="text-right">{line.quantityRejected}</TableCell>
                  <TableCell className="text-right">{rupees(line.unitCost)}</TableCell>
                  <TableCell className="text-right">{rupees(line.lineCost)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}

export default GoodsReceiptDetailPage
