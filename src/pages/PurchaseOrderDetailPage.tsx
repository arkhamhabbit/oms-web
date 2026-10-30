import * as React from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'

import { BackLink, DetailError, Facts, ListError } from '@/components/common/PageParts'
import { PurchaseOrderActionDialog } from '@/components/procurement/PurchaseOrderActionDialog'
import { PurchaseOrderFormDialog } from '@/components/procurement/PurchaseOrderFormDialog'
import { PurchaseOrderStatusBadge } from '@/components/procurement/PurchaseOrderStatusBadge'
import { Button } from '@/components/ui/button'
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
import {
  usePurchaseOrderQuery,
  usePurchaseOrderReceiptsQuery,
  type PurchaseOrderAction,
} from '@/api/procurement'
import { formatDate } from '@/lib/dates'
import { minorToMajorString } from '@/lib/money'
import { formatDateTime } from '@/lib/dates'
import {
  PO_ACTION_LABEL,
  PO_ACTION_PERMISSION,
  poActionsFor,
  remainingOf,
  type PoAction,
} from '@/lib/procurement'

const rupees = (money: { amountMinor?: number } | undefined) =>
  money?.amountMinor === undefined ? '—' : `₹${minorToMajorString(money.amountMinor)}`

type Tab = 'lines' | 'receipts'

function PurchaseOrderDetailPage() {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const { has } = usePermissions()
  const query = usePurchaseOrderQuery(id)
  const order = query.data
  const canSeeReceipts = has('procurement.grn.read')
  const receipts = usePurchaseOrderReceiptsQuery(id, canSeeReceipts)

  useBreadcrumb([
    { label: 'Procurement' },
    { label: 'Purchase orders', to: '/procurement/purchase-orders' },
    { label: order?.poNumber ?? 'Purchase order' },
  ])

  const [tab, setTab] = React.useState<Tab>('lines')
  const [action, setAction] = React.useState<PurchaseOrderAction | undefined>()
  const [editing, setEditing] = React.useState(false)

  if (query.isLoading) {
    return <p className="text-sm text-muted-foreground">Loading…</p>
  }
  if (query.isError || !order) {
    return (
      <DetailError
        error={query.error}
        noun="purchase order"
        back={{ to: '/procurement/purchase-orders', label: 'Purchase orders' }}
        permission="procurement.po.read"
      />
    )
  }

  const actions = poActionsFor(order.status)

  function run(a: PoAction) {
    if (a === 'edit') {
      setEditing(true)
    } else if (a === 'receive') {
      navigate(`/procurement/goods-receipts/new?po=${order!.id}`)
    } else {
      setAction(a)
    }
  }

  return (
    <div className="flex max-w-5xl flex-col gap-4">
      <BackLink to="/procurement/purchase-orders" label="Purchase orders" />
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="font-mono text-xl font-semibold">{order.poNumber}</h1>
        <PurchaseOrderStatusBadge status={order.status} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Order</CardTitle>
        </CardHeader>
        <CardContent>
          <Facts
            rows={[
              [
                'Supplier',
                <Link className="underline" to={`/procurement/suppliers/${order.supplierId}`}>
                  {order.supplierCode} · {order.supplierName}
                </Link>,
              ],
              [
                'Destination',
                <Link className="underline" to={`/inventory/warehouses/${order.warehouseId}`}>
                  {order.warehouseCode} · {order.warehouseName}
                </Link>,
              ],
              ['Expected', formatDate(order.expectedOn)],
              ['Notes', order.notes],
              ['Ordered', String(order.quantityOrdered ?? 0)],
              ['Received', String(order.quantityReceived ?? 0)],
              ['Remaining', String(order.quantityOutstanding ?? 0)],
              ['Cost', rupees(order.totalCost)],
              ['GST', rupees(order.totalTax)],
              ['Currency', order.currency],
            ]}
          />
        </CardContent>
      </Card>

      {actions.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Actions</CardTitle>
            <CardDescription>
              Each one asks to confirm first. The server decides whether the order may take it.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap items-center gap-2">
            {actions.map((a) => {
              const allowed = has(PO_ACTION_PERMISSION[a])
              return (
                <Button
                  key={a}
                  variant={a === 'cancel' || a === 'edit' ? 'outline' : 'default'}
                  disabled={!allowed}
                  title={allowed ? undefined : `Needs ${PO_ACTION_PERMISSION[a]}`}
                  onClick={() => run(a)}
                >
                  {PO_ACTION_LABEL[a]}
                </Button>
              )
            })}
          </CardContent>
        </Card>
      )}

      <div role="tablist" aria-label="Order views" className="flex gap-1 border-b pb-2">
        {(
          [
            ['lines', 'Lines'],
            ['receipts', 'Receipts'],
          ] as const
        ).map(([key, label]) => (
          <Button
            key={key}
            role="tab"
            aria-selected={tab === key}
            size="sm"
            variant={tab === key ? 'default' : 'ghost'}
            onClick={() => setTab(key)}
          >
            {label}
          </Button>
        ))}
      </div>

      {tab === 'lines' && (
        <Card>
          <CardContent className="pt-6">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>#</TableHead>
                  <TableHead>SKU</TableHead>
                  <TableHead>Item</TableHead>
                  <TableHead className="text-right">Ordered</TableHead>
                  <TableHead className="text-right">Received</TableHead>
                  <TableHead className="text-right">Remaining</TableHead>
                  <TableHead className="text-right">Unit cost</TableHead>
                  <TableHead className="text-right">GST</TableHead>
                  <TableHead className="text-right">Line total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(order.lines ?? []).map((line) => (
                  <TableRow key={line.id}>
                    <TableCell>{line.lineNumber}</TableCell>
                    <TableCell className="font-mono">{line.skuCode}</TableCell>
                    <TableCell>
                      <div>{line.productName}</div>
                      <div className="text-xs text-muted-foreground">
                        {line.variantName}
                        {line.batchTracked ? ' · batch-tracked' : ''}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">{line.quantityOrdered}</TableCell>
                    <TableCell className="text-right">{line.quantityReceived}</TableCell>
                    <TableCell className="text-right font-medium">{remainingOf(line)}</TableCell>
                    <TableCell className="text-right">{rupees(line.unitCost)}</TableCell>
                    <TableCell className="text-right">
                      {line.taxRate}% · {rupees(line.lineTax)}
                    </TableCell>
                    <TableCell className="text-right">{rupees(line.lineCost)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {tab === 'receipts' && (
        <Card>
          <CardContent className="pt-6">
            {!canSeeReceipts ? (
              <p className="text-sm text-muted-foreground">
                Receipt history needs <code className="font-mono">procurement.grn.read</code>.
              </p>
            ) : receipts.isError ? (
              <ListError error={receipts.error} what="The receipts" />
            ) : receipts.isLoading ? (
              <p className="text-sm text-muted-foreground">Loading…</p>
            ) : (receipts.data ?? []).length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Nothing has been received against this order.
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Receipt</TableHead>
                    <TableHead>Received on</TableHead>
                    <TableHead>Invoice</TableHead>
                    <TableHead className="text-right">Accepted</TableHead>
                    <TableHead className="text-right">Rejected</TableHead>
                    <TableHead className="text-right">Cost</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(receipts.data ?? []).map((g) => (
                    <TableRow key={g.id}>
                      <TableCell>
                        <Link
                          className="font-mono underline"
                          to={`/procurement/goods-receipts/${g.id}`}
                        >
                          {g.grnNumber}
                        </Link>
                      </TableCell>
                      <TableCell>{formatDate(g.receivedOn)}</TableCell>
                      <TableCell>{g.supplierInvoiceNumber}</TableCell>
                      <TableCell className="text-right">{g.quantityReceived}</TableCell>
                      <TableCell className="text-right">{g.quantityRejected}</TableCell>
                      <TableCell className="text-right">{rupees(g.totalCost)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>History</CardTitle>
          <CardDescription>The dates the order has on record.</CardDescription>
        </CardHeader>
        <CardContent>
          <ol className="flex flex-col gap-3 border-l pl-4 text-sm">
            <li>
              <div className="font-medium">Raised as a draft</div>
              <div className="text-xs text-muted-foreground">{formatDateTime(order.createdAt)}</div>
            </li>
            {order.approvedAt && (
              <li>
                <div className="font-medium">Approved</div>
                <div className="text-xs text-muted-foreground">
                  {formatDateTime(order.approvedAt)}
                </div>
              </li>
            )}
            {order.cancelledAt && (
              <li>
                <div className="font-medium">Cancelled</div>
                <div className="text-xs text-muted-foreground">
                  {formatDateTime(order.cancelledAt)}
                </div>
              </li>
            )}
          </ol>
        </CardContent>
      </Card>

      <PurchaseOrderActionDialog
        order={order}
        action={action}
        onClose={() => setAction(undefined)}
      />
      <PurchaseOrderFormDialog open={editing} onOpenChange={setEditing} order={order} />
    </div>
  )
}

export default PurchaseOrderDetailPage
