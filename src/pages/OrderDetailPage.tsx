import * as React from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeftIcon, MoreHorizontalIcon } from 'lucide-react'

import { OrderActionDialog } from '@/components/orders/OrderActionDialog'
import { OrderNotesFeed } from '@/components/orders/OrderNotesFeed'
import { OrderPaymentCard } from '@/components/orders/OrderPaymentCard'
import { OrderPaymentLinkCard } from '@/components/orders/OrderPaymentLinkCard'
import { OrderRefundsCard } from '@/components/orders/OrderRefundsCard'
import { OrderStatusBadge } from '@/components/orders/OrderStatusBadge'
import { OrderTotals } from '@/components/orders/OrderTotals'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
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
import { ACTION_LABEL, ACTION_PERMISSION, actionsFor, rupees } from '@/lib/orders'
import { isCourierProvider } from '@/lib/shipping'
import { BookShipmentsDialog, type OrderToBook } from '@/components/shipping/BookShipmentsDialog'
import { PrintOutcomeDialog, usePrintLabels } from '@/components/shipping/PrintLabels'
import { ShipmentPanel } from '@/components/shipping/ShipmentPanel'
import { useOrderQuery, useOrdersQuery, type FulfilAction, type OrderDetail } from '@/api/orders'
import { formatDateTime } from '@/lib/dates'
import { TierBadge } from '@/components/membership/TierBadge'
import { LineThumb } from '@/components/orders/LineThumb'
import { ConsumerLink } from '@/components/orders/ConsumerLink'

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

const DASH = '—'

function Facts({ rows }: { rows: [string, React.ReactNode][] }) {
  return (
    <dl className="grid gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
      {rows.map(([label, value]) => (
        <div key={label}>
          <dt className="text-muted-foreground">{label}</dt>
          <dd className="font-medium break-words">{value || DASH}</dd>
        </div>
      ))}
    </dl>
  )
}

const PRIMARY: FulfilAction[] = ['ship', 'out-for-delivery', 'deliver']

function OrderDetailPage() {
  const { id = '' } = useParams()
  const { has } = usePermissions()
  const orderQuery = useOrderQuery(id)
  const order = orderQuery.data
  // "N orders" for this customer: the list filtered by them, one row asked for, the total read.
  const customerOrders = useOrdersQuery(
    { page: 0, size: 1, consumerId: order?.consumerId },
    !!order?.consumerId
  )

  useBreadcrumb([{ label: 'Orders', to: '/orders' }, { label: order?.number ?? 'Order' }])

  const [action, setAction] = React.useState<FulfilAction | undefined>()
  const [booking, setBooking] = React.useState<OrderToBook[] | undefined>()
  const printer = usePrintLabels()

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

  // A courier's shipment is moved by its own events: the hand steps are hidden (D13.6).
  const courier = isCourierProvider(order.shipment?.providerCode)
  const actions = actionsFor(order.status, courier)
  // The header's primary action is Book or Print label when the shipment state calls for one.
  const shippingPrimary: 'book' | 'print' | undefined =
    order.status === 'CONFIRMED' && !order.shipment
      ? 'book'
      : order.status === 'PACKED' && courier && !order.labelPrinted && order.shipment
        ? 'print'
        : undefined
  const primary = shippingPrimary ? undefined : actions.find((a) => PRIMARY.includes(a))
  const overflow = actions.filter((a) => a !== primary)
  const owed = order.refundState === 'OWED'
  const canBook = has('shipping.book')
  const book = () => setBooking([{ id: order.id!, number: order.number! }])
  const print = (shipmentId: string) => void printer.run({ shipmentIds: [shipmentId] })
  const orderCount = order.consumerId ? customerOrders.data?.totalElements : undefined

  return (
    <div className="flex flex-col gap-4">
      <BackLink />
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="font-mono text-xl font-semibold">{order.number}</h1>
        <OrderStatusBadge status={order.status} />
        <TierBadge code={order.tierCode} />
        {order.source === 'ADMIN' && (
          <Badge variant="secondary" data-testid="placed-by-team">
            Placed by the team{order.createdBy?.displayName ? ` · ${order.createdBy.displayName}` : ''}
          </Badge>
        )}
        {order.priceHonoured && (
          <Badge variant="outline">Price honoured (pricing moved after the quote)</Badge>
        )}
        <span className="text-sm text-muted-foreground">Placed {formatDateTime(order.placedAt)}</span>
        <div className="ml-auto flex items-center gap-2">
          {shippingPrimary && (
            <Button
              disabled={!canBook || printer.pending}
              title={canBook ? undefined : 'Needs shipping.book'}
              onClick={() =>
                shippingPrimary === 'book' ? book() : print(order.shipment!.id!)
              }
            >
              {shippingPrimary === 'book' ? 'Book shipment' : 'Print label'}
            </Button>
          )}
          {primary && (
            <Button
              disabled={!has(ACTION_PERMISSION[primary])}
              title={has(ACTION_PERMISSION[primary]) ? undefined : `Needs ${ACTION_PERMISSION[primary]}`}
              onClick={() => setAction(primary)}
            >
              {ACTION_LABEL[primary]}
            </Button>
          )}
          {overflow.length > 0 && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="icon" aria-label="More order actions">
                  <MoreHorizontalIcon />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {overflow.map((a) => (
                  <DropdownMenuItem
                    key={a}
                    disabled={!has(ACTION_PERMISSION[a])}
                    onSelect={() => setAction(a)}
                  >
                    {ACTION_LABEL[a]}
                    {!has(ACTION_PERMISSION[a]) && ` (needs ${ACTION_PERMISSION[a]})`}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </div>

      <div className="grid items-start gap-4 xl:grid-cols-3">
        <div className="flex min-w-0 flex-col gap-4 xl:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Customer and addresses</CardTitle>
              <CardDescription>Addresses are a snapshot at order time.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-6 md:grid-cols-3">
              <section aria-label="Customer" className="flex flex-col gap-1 text-sm">
                <h3 className="font-medium">Customer</h3>
                <ConsumerLink
                  consumerId={order.consumerId}
                  name={order.consumerName}
                  mobile={order.consumerMobile}
                />
                {order.consumerEmail && (
                  <a
                    href={`mailto:${order.consumerEmail}`}
                    className="w-fit text-xs break-all text-muted-foreground underline-offset-2 hover:underline"
                  >
                    {order.consumerEmail}
                  </a>
                )}
                <div>
                  <TierBadge code={order.tierCode} />
                </div>
                {order.consumerId && (
                  <Link
                    to={`/orders?consumerId=${order.consumerId}`}
                    className="w-fit text-muted-foreground underline underline-offset-2 hover:text-foreground"
                  >
                    {orderCount === undefined
                      ? 'All orders'
                      : `${orderCount} ${orderCount === 1 ? 'order' : 'orders'}`}
                  </Link>
                )}
              </section>
              <section aria-label="Shipping address" className="flex flex-col gap-1 text-sm">
                <h3 className="font-medium">Shipping address</h3>
                <AddressBlock order={order} />
              </section>
              <section aria-label="Billing and GST" className="flex flex-col gap-1 text-sm">
                <h3 className="font-medium">Billing / GST</h3>
                <p className="text-muted-foreground">
                  No separate billing or GSTIN is recorded on this order; the invoice uses the
                  shipping address.
                </p>
              </section>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Items</CardTitle>
              <CardDescription>
                As sold: the order keeps these even if the catalog moves.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <Table className="[&_td]:px-2 [&_td]:whitespace-normal [&_th]:px-2">
                <TableHeader>
                  <TableRow>
                    <TableHead>Item</TableHead>
                    <TableHead>SKU</TableHead>
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
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <LineThumb image={line.primaryImage} alt={line.productName ?? 'Product'} />
                          <div>
                            <div>{line.productName}</div>
                            <div className="text-xs text-muted-foreground">
                              {[line.variantName, ...(line.optionLabels ?? [])]
                                .filter(Boolean)
                                .join(' · ')}
                            </div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="font-mono text-xs">{line.skuCode}</TableCell>
                      <TableCell className="text-right">{line.quantity}</TableCell>
                      <TableCell className="text-right">{rupees(line.unitPriceMinor)}</TableCell>
                      <TableCell className="text-right">
                        {line.paidWithBits
                          ? `${(line.lineBits ?? 0).toLocaleString('en-IN')} Bits (${(line.bitsPerUnit ?? 0).toLocaleString('en-IN')} each)`
                          : 'No'}
                      </TableCell>
                      <TableCell className="text-right">{line.gstRate ?? 0}%</TableCell>
                      <TableCell className="text-right">{rupees(line.lineTotalMinor)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <OrderTotals order={order} />
            </CardContent>
          </Card>

          <OrderPaymentLinkCard order={order} onStale={() => void orderQuery.refetch()} />

          <OrderPaymentCard order={order} onStale={() => void orderQuery.refetch()} />

          <OrderRefundsCard order={order} onStale={() => void orderQuery.refetch()} />

          <ShipmentPanel
            order={order}
            onBook={book}
            onPrint={print}
            printing={printer.pending}
          />

          <Card>
            <CardHeader>
              <CardTitle>Earns</CardTitle>
              <CardDescription>What this order earns the shopper.</CardDescription>
            </CardHeader>
            <CardContent>
              <Facts
                rows={[
                  ['Bits', `${(order.earnPoints ?? 0).toLocaleString('en-IN')} Bits`],
                  ['Carrots', rupees(order.earnCarrotsMinor)],
                  ['Posted', earnsState(order)],
                  ['First order', order.firstOrder ? 'Yes' : 'No'],
                ]}
              />
            </CardContent>
          </Card>
        </div>

        <aside className="flex min-w-0 flex-col gap-4 xl:sticky xl:top-4">
          <Card>
            <CardHeader>
              <CardTitle>Order actions</CardTitle>
              <CardDescription>
                Each one asks to confirm first. The server decides whether the order may take it.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-2">
              {actions.length === 0 && (
                <p className="text-sm text-muted-foreground">
                  No action applies to an order that is {order.status?.toLowerCase().replace(/_/g, ' ')}.
                </p>
              )}
              {actions.map((a) => {
                const allowed = has(ACTION_PERMISSION[a])
                return (
                  <div key={a} className="flex items-center justify-between gap-2 text-sm">
                    <Button
                      size="sm"
                      variant={a === primary ? 'default' : 'outline'}
                      disabled={!allowed}
                      onClick={() => setAction(a)}
                    >
                      {ACTION_LABEL[a]}
                    </Button>
                    {!allowed && (
                      <span className="text-xs text-muted-foreground">
                        Needs {ACTION_PERMISSION[a]}
                      </span>
                    )}
                  </div>
                )
              })}
              {owed && (
                <a
                  href="#refunds"
                  className="text-sm font-medium text-destructive underline underline-offset-2"
                >
                  Refunds owed: go to the refund
                </a>
              )}
            </CardContent>
          </Card>
          <OrderNotesFeed order={order} />
        </aside>
      </div>

      <OrderActionDialog
        order={order}
        action={action}
        onClose={() => setAction(undefined)}
        onStale={() => void orderQuery.refetch()}
      />
      <BookShipmentsDialog orders={booking} mode="book" onClose={() => setBooking(undefined)} />
      <PrintOutcomeDialog outcome={printer.outcome} onClose={printer.clear} />
    </div>
  )
}

function earnsState(order: OrderDetail): string {
  if (order.status === 'CANCELLED' || order.status === 'REFUNDED') {
    return 'Reversed (order cancelled)'
  }
  if (order.earnsPostedAt) {
    return formatDateTime(order.earnsPostedAt)
  }
  const earned = ['CONFIRMED', 'PACKED', 'SHIPPED', 'OUT_FOR_DELIVERY', 'DELIVERED']
  return earned.includes(order.status ?? '') ? 'Owed — the repair sweep posts it' : 'Not earned'
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
      {!a.addressId && (
        <div className="mt-1 text-xs text-muted-foreground">
          Typed for this order; not in the member’s address book.
        </div>
      )}
    </address>
  )
}

export default OrderDetailPage
