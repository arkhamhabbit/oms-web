import * as React from 'react'
import { Link, useNavigate } from 'react-router-dom'
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
import { minorToMajorString } from '@/lib/money'
import {
  formatDateTime,
  isUuid,
  istDayStart,
  ORDER_STATUSES,
  ORDER_STATUS_LABEL,
} from '@/lib/orders'
import {
  useCurrentOrderSettingsQuery,
  useOrdersQuery,
  type OrderStatus,
  type OrderSummary,
} from '@/api/orders'

const PAGE_SIZE = 20

const rupees = (minor: number | undefined) => `₹${minorToMajorString(minor ?? 0)}`

function OrdersPage() {
  useBreadcrumb([{ label: 'Orders' }])
  const navigate = useNavigate()

  const [pageIndex, setPageIndex] = React.useState(0)
  const [status, setStatus] = React.useState<OrderStatus | 'ALL'>('ALL')
  const [number, setNumber] = React.useState('')
  const [consumerId, setConsumerId] = React.useState('')
  const [fromDate, setFromDate] = React.useState('')
  const [toDate, setToDate] = React.useState('')

  const consumerValid = consumerId.trim() === '' || isUuid(consumerId)

  const orders = useOrdersQuery({
    page: pageIndex,
    size: PAGE_SIZE,
    status: status === 'ALL' ? undefined : status,
    number: number.trim(),
    consumerId: consumerValid ? consumerId.trim() : undefined,
    from: istDayStart(fromDate),
    // The date box names the last day wanted; the server's `to` is exclusive.
    to: istDayStart(toDate, 1),
  })
  const settings = useCurrentOrderSettingsQuery()

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
      id: 'status',
      header: 'Status',
      cell: ({ row }) => <OrderStatusBadge status={row.original.status} />,
    },
    {
      id: 'consumer',
      header: 'Consumer',
      cell: ({ row }) =>
        row.original.consumerId ? (
          <Link
            to={`/users/${row.original.consumerId}`}
            onClick={(e) => e.stopPropagation()}
            className="font-mono text-xs underline"
          >
            {row.original.consumerId.slice(0, 8)}…
          </Link>
        ) : (
          ''
        ),
    },
    {
      id: 'payable',
      header: 'Payable',
      cell: ({ row }) => rupees(row.original.payableMinor),
    },
    { id: 'tier', header: 'Tier', cell: ({ row }) => row.original.tierCode ?? '' },
    {
      id: 'placedAt',
      header: 'Placed',
      cell: ({ row }) => formatDateTime(row.original.placedAt),
    },
  ]

  return (
    <div className="flex flex-col gap-4">
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
            <SelectItem value="ALL">All statuses</SelectItem>
            {ORDER_STATUSES.map((s) => (
              <SelectItem key={s} value={s}>
                {ORDER_STATUS_LABEL[s]}
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
