import * as React from 'react'
import { Link } from 'react-router-dom'
import type { ColumnDef } from '@tanstack/react-table'

import { DataTable } from '@/components/data-table/DataTable'
import { ShippingCallDrawer, SuccessChip } from '@/components/shipping/ShippingCallDrawer'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useBreadcrumb } from '@/layouts/breadcrumb-context'
import {
  useShippingCallsQuery,
  type ShippingCallAction,
  type ShippingCallSummary,
} from '@/api/shipping'
import { isApiError } from '@/lib/api-error'
import { formatDateTime } from '@/lib/dates'
import { istDayStart } from '@/lib/orders'
import { CALL_ACTION_LABEL, CALL_ACTIONS, PROVIDER_CODES, providerLabel } from '@/lib/shipping'

const PAGE_SIZE = 25
const ANY = 'ALL'

/** D13.9: every exchange with a courier, newest first, each readable whole. */
function ShippingLogPage() {
  useBreadcrumb([{ label: 'Orders', to: '/orders' }, { label: 'Shipping log' }])
  const [pageIndex, setPageIndex] = React.useState(0)
  const [provider, setProvider] = React.useState(ANY)
  const [action, setAction] = React.useState<ShippingCallAction | typeof ANY>(ANY)
  const [success, setSuccess] = React.useState<'true' | 'false' | typeof ANY>(ANY)
  const [orderNumber, setOrderNumber] = React.useState('')
  const [awb, setAwb] = React.useState('')
  const [fromDate, setFromDate] = React.useState('')
  const [toDate, setToDate] = React.useState('')
  const [openId, setOpenId] = React.useState<string | undefined>()

  function filter<T>(set: (value: T) => void) {
    return (value: T) => {
      set(value)
      setPageIndex(0)
    }
  }

  const calls = useShippingCallsQuery({
    page: pageIndex,
    size: PAGE_SIZE,
    provider: provider === ANY ? undefined : provider,
    action: action === ANY ? undefined : action,
    success: success === ANY ? undefined : success === 'true',
    orderNumber: orderNumber.trim(),
    awb: awb.trim(),
    from: istDayStart(fromDate),
    to: istDayStart(toDate, 1),
  })
  const failedOnly = success === 'false'

  const columns: ColumnDef<ShippingCallSummary, unknown>[] = [
    { id: 'time', header: 'Time', cell: ({ row }) => formatDateTime(row.original.createdAt) },
    { id: 'provider', header: 'Provider', cell: ({ row }) => providerLabel(row.original.providerCode) },
    {
      id: 'action',
      header: 'Action',
      cell: ({ row }) => (row.original.action ? CALL_ACTION_LABEL[row.original.action] : '—'),
    },
    {
      id: 'direction',
      header: 'Direction',
      cell: ({ row }) => (row.original.direction === 'INBOUND' ? 'In' : 'Out'),
    },
    {
      id: 'order',
      header: 'Order',
      cell: ({ row }) =>
        row.original.orderId && row.original.orderNumber ? (
          <Link
            to={`/orders/${row.original.orderId}`}
            onClick={(e) => e.stopPropagation()}
            className="font-mono underline underline-offset-2"
          >
            {row.original.orderNumber}
          </Link>
        ) : (
          '—'
        ),
    },
    { id: 'awb', header: 'AWB', cell: ({ row }) => <span className="font-mono">{row.original.awb ?? '—'}</span> },
    { id: 'http', header: 'HTTP', cell: ({ row }) => row.original.httpStatus ?? '—' },
    {
      id: 'latency',
      header: 'Latency',
      cell: ({ row }) => (row.original.latencyMs == null ? '—' : `${row.original.latencyMs} ms`),
    },
    { id: 'result', header: 'Result', cell: ({ row }) => <SuccessChip success={row.original.success} /> },
    {
      id: 'sentence',
      header: 'Sentence',
      cell: ({ row }) => (
        <span className="line-clamp-2 max-w-80 whitespace-normal">{row.original.sentence ?? ''}</span>
      ),
    },
  ]

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-xl font-semibold">Shipping log</h1>
        <Button
          variant={failedOnly ? 'default' : 'outline'}
          aria-pressed={failedOnly}
          onClick={() => filter(setSuccess)(failedOnly ? ANY : 'false')}
        >
          Failed only
        </Button>
      </div>
      <p className="max-w-3xl text-sm text-muted-foreground">
        Every exchange with a shipping provider, newest first, kept whole. Open a row to read what
        was sent and what came back; credentials and tokens are masked by the server.
      </p>

      <div className="flex flex-wrap items-end gap-2">
        <Select value={provider} onValueChange={filter(setProvider)}>
          <SelectTrigger className="w-40" aria-label="Provider filter">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ANY}>Any provider</SelectItem>
            {PROVIDER_CODES.map((p) => (
              <SelectItem key={p} value={p}>
                {providerLabel(p)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={action} onValueChange={(v) => filter(setAction)(v as ShippingCallAction)}>
          <SelectTrigger className="w-40" aria-label="Action filter">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ANY}>Any action</SelectItem>
            {CALL_ACTIONS.map((a) => (
              <SelectItem key={a} value={a}>
                {CALL_ACTION_LABEL[a]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={success} onValueChange={(v) => filter(setSuccess)(v as 'true' | 'false')}>
          <SelectTrigger className="w-40" aria-label="Result filter">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ANY}>Any result</SelectItem>
            <SelectItem value="true">Success</SelectItem>
            <SelectItem value="false">Failed</SelectItem>
          </SelectContent>
        </Select>
        <Input
          placeholder="Order number"
          aria-label="Order number"
          value={orderNumber}
          onChange={(e) => filter(setOrderNumber)(e.target.value)}
          className="w-48"
        />
        <Input
          placeholder="AWB"
          aria-label="AWB"
          value={awb}
          onChange={(e) => filter(setAwb)(e.target.value)}
          className="w-44"
        />
        <label className="grid gap-1 text-xs text-muted-foreground">
          From
          <Input type="date" aria-label="From" value={fromDate} onChange={(e) => filter(setFromDate)(e.target.value)} className="w-40" />
        </label>
        <label className="grid gap-1 text-xs text-muted-foreground">
          To (inclusive)
          <Input type="date" aria-label="To" value={toDate} onChange={(e) => filter(setToDate)(e.target.value)} className="w-40" />
        </label>
      </div>

      {calls.isError && (
        <p role="alert" className="text-sm text-destructive">
          {isApiError(calls.error) ? calls.error.message : 'The shipping log could not be loaded.'}
        </p>
      )}

      <DataTable
        columns={columns}
        data={calls.data?.content ?? []}
        isLoading={calls.isLoading}
        emptyMessage="No calls match these filters."
        onRowClick={(c) => setOpenId(c.id)}
        serverPagination={{
          pageIndex,
          pageSize: PAGE_SIZE,
          pageCount: calls.data?.totalPages ?? 0,
          totalElements: calls.data?.totalElements ?? 0,
          onPageIndexChange: setPageIndex,
        }}
      />

      <ShippingCallDrawer callId={openId} onClose={() => setOpenId(undefined)} />
    </div>
  )
}

export default ShippingLogPage
