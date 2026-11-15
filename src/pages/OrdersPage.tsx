import * as React from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import type { ColumnDef } from '@tanstack/react-table'
import { SettingsIcon } from 'lucide-react'

import { DataTable } from '@/components/data-table/DataTable'
import { OrderStatusBadge } from '@/components/orders/OrderStatusBadge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useBreadcrumb } from '@/layouts/breadcrumb-context'
import { isApiError } from '@/lib/api-error'
import { isUuid, istDayStart, ORDER_STATUSES, paymentCapturedLabel, rupees } from '@/lib/orders'
import {
  useCurrentOrderSettingsQuery,
  useOrdersQuery,
  type OrderStatus,
  type OrderSummary,
  type RefundState,
} from '@/api/orders'
import { formatDateTime } from '@/lib/dates'
import { ANY_STATUS, ORDER_STATUS_LABEL, REFUND_STATE_LABEL } from '@/lib/labels'
import { Badge } from '@/components/ui/badge'
import { TierBadge } from '@/components/membership/TierBadge'
import { ConsumerLink } from '@/components/orders/ConsumerLink'

const PAGE_SIZE = 20

function OrdersPage() {
  useBreadcrumb([{ label: 'Orders' }])
  const navigate = useNavigate()
  const [search] = useSearchParams()

  const [pageIndex, setPageIndex] = React.useState(0)
  const [status, setStatus] = React.useState<OrderStatus | 'ALL'>('ALL')
  const [number, setNumber] = React.useState('')
  const [consumerId, setConsumerId] = React.useState(search.get('consumerId') ?? '')
  const initialRefund = search.get('refundState')
  const [refundState, setRefundState] = React.useState<RefundState | 'ALL'>(
    initialRefund && initialRefund in REFUND_STATE_LABEL ? (initialRefund as RefundState) : 'ALL'
  )
  const [fromDate, setFromDate] = React.useState('')
  const [toDate, setToDate] = React.useState('')

  const consumerValid = consumerId.trim() === '' || isUuid(consumerId)

  const orders = useOrdersQuery({
    page: pageIndex,
    size: PAGE_SIZE,
    status: status === 'ALL' ? undefined : status,
    number: number.trim(),
    consumerId: consumerValid ? consumerId.trim() : undefined,
    refundState: refundState === 'ALL' ? undefined : refundState,
    from: istDayStart(fromDate),
    // The date box names the last day wanted; the server's `to` is exclusive.
    to: istDayStart(toDate, 1),
  })
  const settings = useCurrentOrderSettingsQuery()
  // D9.8: money waiting for a person. Counted on its own, so the number shows whatever the filters say.
  const owed = useOrdersQuery({ page: 0, size: 1, refundState: 'OWED' })
  const owedCount = owed.data?.totalElements
  const owedActive = refundState === 'OWED'

  function filter<T>(set: (value: T) => void) {
    return (value: T) => {
      set(value)
      setPageIndex(0)
    }
  }

  const columns: ColumnDef<OrderSummary, unknown>[] = [
    {
      id: 'number',
      header: 'Order',
      cell: ({ row }) => <span className="font-mono">{row.original.number}</span>,
    },
    {
      id: 'placedAt',
      header: 'Placed',
      cell: ({ row }) => formatDateTime(row.original.placedAt),
    },
    {
      id: 'consumer',
      header: 'Customer',
      cell: ({ row }) => (
        <ConsumerLink
          consumerId={row.original.consumerId}
          name={row.original.consumerName}
          mobile={row.original.consumerMobile}
          stopPropagation
        />
      ),
    },
    {
      id: 'status',
      header: 'Status',
      cell: ({ row }) => <OrderStatusBadge status={row.original.status} />,
    },
    {
      id: 'payment',
      header: 'Payment',
      cell: ({ row }) => (
        <div className="leading-tight">
          <div>{row.original.paymentMethod ?? '—'}</div>
          <div className="text-xs text-muted-foreground">{paymentCapturedLabel(row.original)}</div>
        </div>
      ),
    },
    {
      id: 'refund',
      header: 'Refund',
      cell: ({ row }) => {
        const state = row.original.refundState ?? 'NONE'
        return state === 'NONE' ? (
          <span className="text-muted-foreground">{'—'}</span>
        ) : (
          <Badge variant={state === 'OWED' ? 'destructive' : 'outline'}>
            {REFUND_STATE_LABEL[state]}
          </Badge>
        )
      },
    },
    {
      id: 'payable',
      header: 'Total',
      cell: ({ row }) => rupees(row.original.payableMinor),
    },
    { id: 'tier', header: 'Tier', cell: ({ row }) => <TierBadge code={row.original.tierCode} /> },
  ]

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-xl font-semibold">Orders</h1>
        <Button
          variant={owedActive ? 'default' : 'outline'}
          aria-pressed={owedActive}
          className={owedCount ? 'border-destructive/50 text-destructive' : undefined}
          onClick={() => filter(setRefundState)(owedActive ? 'ALL' : 'OWED')}
        >
          Refunds owed
          <Badge variant={owedCount ? 'destructive' : 'secondary'} aria-label="Refunds owed count">
            {owedCount ?? '…'}
          </Badge>
        </Button>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Order settings in effect</CardTitle>
          <CardDescription>
            What new quotes use today. Orders already placed keep the settings they were placed
            under.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap items-end justify-between gap-4">
          {settings.isError ? (
            <p role="alert" className="text-sm text-destructive">
              {isApiError(settings.error)
                ? settings.error.message
                : 'The order settings could not be loaded.'}
            </p>
          ) : (
            <dl className="grid gap-x-8 gap-y-2 text-sm sm:grid-cols-3">
              <div>
                <dt className="text-muted-foreground">Flat shipping</dt>
                <dd className="font-medium">{rupees(settings.data?.shippingFeeMinor)}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Payment timeout</dt>
                <dd className="font-medium">{settings.data?.paymentTimeoutMinutes ?? '—'} min</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Cancel window</dt>
                <dd className="font-medium">
                  {settings.data?.cancelUntil
                    ? `Until ${settings.data.cancelUntil.toLowerCase()}`
                    : '—'}
                </dd>
              </div>
            </dl>
          )}
          <Button variant="outline" asChild>
            <Link to="/orders/settings">
              <SettingsIcon /> Order settings
            </Link>
          </Button>
        </CardContent>
      </Card>

      <div className="flex flex-wrap items-end gap-2">
        <Input
          placeholder="Order number, e.g. HBT_10000001"
          aria-label="Order number"
          value={number}
          onChange={(e) => filter(setNumber)(e.target.value)}
          className="w-64"
        />
        <Select
          value={status}
          onValueChange={(value) => filter(setStatus)(value as OrderStatus | 'ALL')}
        >
          <SelectTrigger className="w-48" aria-label="Status filter">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">{ANY_STATUS}</SelectItem>
            {ORDER_STATUSES.map((s) => (
              <SelectItem key={s} value={s}>
                {ORDER_STATUS_LABEL[s]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={refundState}
          onValueChange={(value) => filter(setRefundState)(value as RefundState | 'ALL')}
        >
          <SelectTrigger className="w-48" aria-label="Refund state filter">
            <SelectValue placeholder="Refund state" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">Any refund state</SelectItem>
            {(['OWED', 'INITIATED', 'REFUNDED', 'VOIDED'] as const).map((s) => (
              <SelectItem key={s} value={s}>
                {REFUND_STATE_LABEL[s]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div>
          <Input
            placeholder="Consumer id"
            aria-label="Consumer id"
            aria-invalid={!consumerValid}
            value={consumerId}
            onChange={(e) => filter(setConsumerId)(e.target.value)}
            className="w-80 font-mono text-xs"
          />
          {!consumerValid && (
            <p className="mt-1 text-xs text-destructive">A consumer id is a UUID.</p>
          )}
        </div>
        <label className="grid gap-1 text-xs text-muted-foreground">
          Placed from
          <Input
            type="date"
            aria-label="Placed from"
            value={fromDate}
            onChange={(e) => filter(setFromDate)(e.target.value)}
            className="w-40"
          />
        </label>
        <label className="grid gap-1 text-xs text-muted-foreground">
          Placed to (inclusive)
          <Input
            type="date"
            aria-label="Placed to"
            value={toDate}
            onChange={(e) => filter(setToDate)(e.target.value)}
            className="w-40"
          />
        </label>
      </div>

      {orders.isError && (
        <p role="alert" className="text-sm text-destructive">
          {isApiError(orders.error) ? orders.error.message : 'Orders could not be loaded.'}
        </p>
      )}

      <DataTable
        columns={columns}
        data={orders.data?.content ?? []}
        isLoading={orders.isLoading}
        emptyMessage="No orders match these filters."
        onRowClick={(order) => navigate(`/orders/${order.id}`)}
        serverPagination={{
          pageIndex,
          pageSize: PAGE_SIZE,
          pageCount: orders.data?.totalPages ?? 0,
          totalElements: orders.data?.totalElements ?? 0,
          onPageIndexChange: setPageIndex,
        }}
      />
    </div>
  )
}

export default OrdersPage
