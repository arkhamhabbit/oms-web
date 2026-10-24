import * as React from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeftIcon } from 'lucide-react'

import { OrderActionDialog } from '@/components/orders/OrderActionDialog'
import { OrderStatusBadge } from '@/components/orders/OrderStatusBadge'
import { Badge } from '@/components/ui/badge'
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
import { useBreadcrumb } from '@/layouts/breadcrumb-context'
import { usePermissions } from '@/auth/usePermissions'
import { isApiError } from '@/lib/api-error'
import { minorToMajorString } from '@/lib/money'
import {
  ACTION_LABEL,
  ACTION_PERMISSION,
  actionsFor,
  formatDateTime,
  ORDER_STATUS_LABEL,
} from '@/lib/orders'
import { useOrderQuery, type FulfilAction, type OrderDetail } from '@/api/orders'

const rupees = (minor: number | undefined) => `₹${minorToMajorString(minor ?? 0)}`

function BackLink() {
  return (
    <Link
      to="/orders"
      className="inline-flex w-fit items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
    >
      <ArrowLeftIcon className="size-4" /> Orders
    </Link>
  )
}

function Facts({ rows }: { rows: [string, React.ReactNode][] }) {
  return (
    <dl className="grid gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
      {rows.map(([label, value]) => (
        <div key={label}>
          <dt className="text-muted-foreground">{label}</dt>
          <dd className="font-medium break-words">{value || '—'}</dd>
        </div>
      ))}
    </dl>
  )
}

function OrderDetailPage() {
  const { id = '' } = useParams()
  const { has } = usePermissions()
  const orderQuery = useOrderQuery(id)
  const order = orderQuery.data

  useBreadcrumb([{ label: 'Orders', to: '/orders' }, { label: order?.number ?? 'Order' }])

  const [action, setAction] = React.useState<FulfilAction | undefined>()

  if (orderQuery.isLoading) {
    return <p className="text-sm text-muted-foreground">Loading…</p>
  }
  if (orderQuery.isError || !order) {
    return (
      <div className="flex flex-col gap-3">
        <BackLink />
        <p className="text-sm">
          {isApiError(orderQuery.error)
            ? orderQuery.error.message
            : 'This order could not be loaded.'}
        </p>
      </div>
    )
  }

  const actions = actionsFor(order.status)

  return (
    <div className="flex max-w-4xl flex-col gap-4">
      <BackLink />
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="font-mono text-xl font-semibold">{order.number}</h1>
        <OrderStatusBadge status={order.status} />
        {order.priceHonoured && (
          <Badge variant="outline">Price honoured (pricing moved after the quote)</Badge>
        )}
      </div>
      <p className="-mt-2 text-sm text-muted-foreground">
        Placed {formatDateTime(order.placedAt)} · Consumer{' '}
        <Link to={`/users/${order.consumerId}`} className="font-mono text-xs underline">
          {order.consumerId}
        </Link>
        {order.tierCode ? ` · Tier ${order.tierCode}` : ''}
      </p>

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
              const allowed = has(ACTION_PERMISSION[a])
              return (
                <Button
                  key={a}
                  variant={a === 'cancel' || a === 'refund' ? 'outline' : 'default'}
                  disabled={!allowed}
                  title={allowed ? undefined : `Needs ${ACTION_PERMISSION[a]}`}
                  onClick={() => setAction(a)}
                >
                  {ACTION_LABEL[a]}
                </Button>
              )
            })}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Lines</CardTitle>
          <CardDescription>
            As sold: the order keeps these even if the catalog moves.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>SKU</TableHead>
                <TableHead>Item</TableHead>
                <TableHead className="text-right">Qty</TableHead>
                <TableHead className="text-right">Unit price</TableHead>
                <TableHead className="text-right">Paid with Bits</TableHead>
                <TableHead className="text-right">GST</TableHead>
                <TableHead className="text-right">Line total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(order.lines ?? []).map((line) => (
                <TableRow key={line.lineNumber}>
                  <TableCell className="font-mono">{line.skuCode}</TableCell>
                  <TableCell>
                    <div>{line.productName}</div>
                    <div className="text-xs text-muted-foreground">
                      {[line.variantName, ...(line.optionLabels ?? [])].filter(Boolean).join(' · ')}
                    </div>
                  </TableCell>
                  <TableCell className="text-right">{line.quantity}</TableCell>
                  <TableCell className="text-right">
                    {rupees(line.unitPriceMinor)}
                    {line.paidWithBits && line.bitsPerUnit
                      ? ` + ${line.bitsPerUnit.toLocaleString('en-IN')} Bits`
                      : ''}
                  </TableCell>
                  <TableCell className="text-right">
                    {line.paidWithBits
                      ? `${(line.lineBits ?? 0).toLocaleString('en-IN')} Bits`
                      : 'No'}
                  </TableCell>
                  <TableCell className="text-right">{line.gstRate ?? 0}%</TableCell>
                  <TableCell className="text-right">{rupees(line.lineTotalMinor)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Totals</CardTitle>
            <CardDescription>GST is included in the prices.</CardDescription>
          </CardHeader>
          <CardContent>
            <Facts
              rows={[
                ['Items (MRP)', rupees(order.mrpTotalMinor)],
                ['Items', rupees(order.itemTotalMinor)],
                ['Shipping', order.freeShipping ? 'Free (tier)' : rupees(order.shippingMinor)],
                ['Carrots redeemed', `− ${rupees(order.carrotsRedeemedMinor)}`],
                ['Bits spent', `${(order.bitsSpent ?? 0).toLocaleString('en-IN')} Bits`],
                ['Payable', rupees(order.payableMinor)],
                ['GST included', rupees(order.gstMinor)],
              ]}
            />
            {(order.gstBreakdown ?? []).length > 0 && (
              <ul className="mt-3 text-xs text-muted-foreground">
                {order.gstBreakdown!.map((g) => (
                  <li key={g.rate}>
                    {g.rate}%: taxable {rupees(g.taxableMinor)}, tax {rupees(g.taxMinor)}
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Delivery address</CardTitle>
            <CardDescription>As placed.</CardDescription>
          </CardHeader>
          <CardContent>
            <AddressBlock order={order} />
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Payment</CardTitle>
          </CardHeader>
          <CardContent>
            <Facts
              rows={[
                ['Status', order.payment?.status],
                ['Method', order.payment?.method ?? order.paymentMethod],
                ['Amount', rupees(order.payment?.amountMinor)],
                ['Gateway', order.payment?.gateway],
                ['Gateway order', order.payment?.gatewayOrderId],
                ['Gateway payment', order.payment?.gatewayPaymentId],
                ['Captured', formatDateTime(order.payment?.capturedAt)],
                ['Refund', order.payment?.gatewayRefundId],
                ['Refund requested', formatDateTime(order.payment?.refundRequestedAt)],
                ['Refunded', formatDateTime(order.payment?.refundedAt)],
                ['Last refund error', order.payment?.lastRefundError],
              ]}
            />
          </CardContent>
        </Card>

        <div className="flex flex-col gap-4">
          <Card>
            <CardHeader>
              <CardTitle>Invoice</CardTitle>
            </CardHeader>
            <CardContent>
              {order.invoice ? (
                <Facts
                  rows={[
                    ['Number', <span className="font-mono">{order.invoice.number}</span>],
                    ['Issued', formatDateTime(order.invoice.issuedAt)],
                    ['Financial year', order.invoice.financialYear],
                    ['Taxable value', rupees(order.invoice.taxableMinor)],
                  ]}
                />
              ) : (
                <p className="text-sm text-muted-foreground">
                  Numbered when the order is confirmed.
                </p>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Earn summary</CardTitle>
              <CardDescription>What this order earns the shopper.</CardDescription>
            </CardHeader>
            <CardContent>
              <Facts
                rows={[
                  ['Bits', `${(order.earnPoints ?? 0).toLocaleString('en-IN')} Bits`],
                  ['Carrots', rupees(order.earnCarrotsMinor)],
                  [
                    'Posted',
                    order.earnsPostedAt
                      ? formatDateTime(order.earnsPostedAt)
                      : order.status === 'CONFIRMED' ||
                          order.status === 'PACKED' ||
                          order.status === 'SHIPPED' ||
                          order.status === 'OUT_FOR_DELIVERY' ||
                          order.status === 'DELIVERED'
                        ? 'Owed — the repair sweep posts it'
                        : 'Not earned',
                  ],
                  ['First order', order.firstOrder ? 'Yes' : 'No'],
                ]}
              />
            </CardContent>
          </Card>
        </div>
      </div>

      {(order.carrier || order.trackingReference) && (
        <Card>
          <CardHeader>
            <CardTitle>Shipment</CardTitle>
          </CardHeader>
          <CardContent>
            <Facts
              rows={[
                ['Carrier', order.carrier],
                ['Tracking reference', order.trackingReference],
              ]}
            />
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Timeline</CardTitle>
          <CardDescription>Every status change, oldest first.</CardDescription>
        </CardHeader>
        <CardContent>
          <ol className="flex flex-col gap-3 border-l pl-4">
            {(order.events ?? []).map((event) => (
              <li key={event.id} className="text-sm">
                <div className="font-medium">
                  {event.fromStatus
                    ? `${ORDER_STATUS_LABEL[event.fromStatus]} → ${ORDER_STATUS_LABEL[event.toStatus!]}`
                    : `Placed (${ORDER_STATUS_LABEL[event.toStatus!]})`}
                </div>
                <div className="text-xs text-muted-foreground">
                  {formatDateTime(event.occurredAt)} · {event.actorKind?.toLowerCase()}
                  {event.note ? ` · ${event.note}` : ''}
                </div>
              </li>
            ))}
          </ol>
        </CardContent>
      </Card>

      <OrderActionDialog
        order={order}
        action={action}
        onClose={() => setAction(undefined)}
        onStale={() => void orderQuery.refetch()}
      />
    </div>
  )
}

function AddressBlock({ order }: { order: OrderDetail }) {
  const a = order.address
  if (!a) {
    return <p className="text-sm text-muted-foreground">No address on this order.</p>
  }
  return (
    <address className="text-sm not-italic">
      {a.label && <div className="font-medium">{a.label}</div>}
      <div>{a.line1}</div>
      {a.landmark && <div>{a.landmark}</div>}
      <div>{a.pincode}</div>
      <div className="text-muted-foreground">{a.deliveryMobile}</div>
    </address>
  )
}

export default OrderDetailPage
