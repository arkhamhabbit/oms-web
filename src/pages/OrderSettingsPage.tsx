import * as React from 'react'
import { Link } from 'react-router-dom'
import type { ColumnDef } from '@tanstack/react-table'
import { ArrowLeftIcon } from 'lucide-react'
import { toast } from 'sonner'

import { ConfirmDialog } from '@/components/common/ConfirmDialog'
import { DataTable } from '@/components/data-table/DataTable'
import { MoneyInput } from '@/components/form/MoneyInput'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useBreadcrumb } from '@/layouts/breadcrumb-context'
import { usePermissions } from '@/auth/usePermissions'
import { isApiError, type ApiFieldError } from '@/lib/api-error'
import { describeFieldError, ORDER_SETTINGS_LABELS } from '@/lib/field-labels'
import { minorToMajorString } from '@/lib/money'
import { formatDateTime } from '@/lib/dates'
import {
  useCurrentOrderSettingsQuery,
  useOrderSettingsVersionsQuery,
  usePublishOrderSettingsMutation,
  type CancelUntil,
  type OrderSettings,
} from '@/api/orders'

const PAGE_SIZE = 20
const TIMEOUT_MIN = 5
const TIMEOUT_MAX = 15
/** Field errors that sit beside their own control; the rest are listed in the banner. */
const PLACED_FIELDS = ['shippingFeeMinor', 'paymentTimeoutMinutes']

const rupees = (minor: number | undefined) => `₹${minorToMajorString(minor ?? 0)}`

const CANCEL_UNTIL_LABEL: Record<CancelUntil, string> = {
  SHIPPED: 'Until it ships (confirmed or packed)',
  PACKED: 'Until it is packed (confirmed only)',
}

function OrderSettingsPage() {
  useBreadcrumb([{ label: 'Orders', to: '/orders' }, { label: 'Settings' }])
  const { has } = usePermissions()
  const canWrite = has('orders.write')
  const [pageIndex, setPageIndex] = React.useState(0)
  const current = useCurrentOrderSettingsQuery()
  const versions = useOrderSettingsVersionsQuery(pageIndex, PAGE_SIZE)

  const columns: ColumnDef<OrderSettings, unknown>[] = [
    {
      id: 'effectiveFrom',
      header: 'Effective from',
      cell: ({ row }) => formatDateTime(row.original.effectiveFrom),
    },
    {
      id: 'shipping',
      header: 'Shipping',
      cell: ({ row }) => rupees(row.original.shippingFeeMinor),
    },
    {
      id: 'timeout',
      header: 'Payment timeout',
      cell: ({ row }) => `${row.original.paymentTimeoutMinutes} min`,
    },
    {
      id: 'cancelUntil',
      header: 'Cancel window',
      cell: ({ row }) =>
        row.original.cancelUntil ? `Until ${row.original.cancelUntil.toLowerCase()}` : '',
    },
    { id: 'notes', header: 'Notes', cell: ({ row }) => row.original.notes ?? '' },
    {
      id: 'current',
      header: '',
      cell: ({ row }) =>
        row.original.versionId && row.original.versionId === current.data?.versionId
          ? 'In effect'
          : '',
    },
  ]

  return (
    <div className="flex max-w-4xl flex-col gap-4">
      <Link
        to="/orders"
        className="inline-flex w-fit items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeftIcon className="size-4" /> Orders
      </Link>
      <p className="max-w-3xl text-sm text-muted-foreground">
        Order settings are versions. A new version takes effect the moment it is published; earlier
        ones stay as the record of what each order was placed under. A quote already given keeps the
        shipping it showed. Free shipping is a tier benefit, set on the membership version.
      </p>

      {current.isError && (
        <p role="alert" className="text-sm text-destructive">
          {isApiError(current.error)
            ? current.error.message
            : 'The order settings could not be loaded.'}
        </p>
      )}

      {current.data && (
        // keyed on the version in effect so a publish hands the form the new values
        <NewVersionForm key={current.data.versionId} current={current.data} canWrite={canWrite} />
      )}

      <h2 className="text-base font-semibold">Versions</h2>
      <DataTable
        columns={columns}
        data={versions.data?.content ?? []}
        isLoading={versions.isLoading}
        emptyMessage="No order settings versions."
        serverPagination={{
          pageIndex,
          pageSize: PAGE_SIZE,
          pageCount: versions.data?.totalPages ?? 0,
          totalElements: versions.data?.totalElements ?? 0,
          onPageIndexChange: setPageIndex,
        }}
      />
    </div>
  )
}

function NewVersionForm({ current, canWrite }: { current: OrderSettings; canWrite: boolean }) {
  const publish = usePublishOrderSettingsMutation()
  const [shippingMinor, setShippingMinor] = React.useState<number | null>(
    current.shippingFeeMinor ?? 0
  )
  const [timeoutText, setTimeoutText] = React.useState(String(current.paymentTimeoutMinutes ?? ''))
  const [cancelUntil, setCancelUntil] = React.useState<CancelUntil>(
    current.cancelUntil ?? 'SHIPPED'
  )
  const [notes, setNotes] = React.useState('')
  const [confirmOpen, setConfirmOpen] = React.useState(false)
  const [refusal, setRefusal] = React.useState<string | undefined>()
  const [fieldErrors, setFieldErrors] = React.useState<ApiFieldError[]>([])

  const timeout = /^\d+$/.test(timeoutText.trim()) ? Number.parseInt(timeoutText.trim(), 10) : null
  // The server's 5-15 rule stays authoritative; this only spares a confirm dialog and a round trip.
  const timeoutProblem =
    timeout === null || timeout < TIMEOUT_MIN || timeout > TIMEOUT_MAX
      ? `Enter a whole number of minutes from ${TIMEOUT_MIN} to ${TIMEOUT_MAX}.`
      : undefined
  const ready = shippingMinor !== null && timeout !== null && !timeoutProblem

  function submit() {
    if (!ready) {
      return
    }
    setRefusal(undefined)
    setFieldErrors([])
    publish
      .mutateAsync({
        shippingFeeMinor: shippingMinor,
        paymentTimeoutMinutes: timeout,
        cancelUntil,
        notes: notes.trim() || undefined,
      })
      .then(() => {
        toast.success('Order settings published')
        setConfirmOpen(false)
      })
      .catch((error) => {
        setConfirmOpen(false)
        if (isApiError(error)) {
          setRefusal(error.message)
          setFieldErrors(error.fieldErrors)
        } else {
          setRefusal('The settings could not be published.')
        }
      })
  }

  const fieldError = (field: string) => fieldErrors.filter((e) => e.field === field)

  return (
    <Card>
      <CardHeader>
        <CardTitle>New version</CardTitle>
        <CardDescription>
          Starts from the version in effect. Publishing it takes effect at once.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form
          className="flex flex-col gap-4"
          onSubmit={(event) => {
            event.preventDefault()
            setConfirmOpen(true)
          }}
        >
          <div className="grid max-w-sm gap-1.5">
            <Label htmlFor="shippingFee">Flat shipping fee</Label>
            <MoneyInput
              id="shippingFee"
              valueMinor={shippingMinor}
              onValueMinorChange={setShippingMinor}
              disabled={!canWrite}
            />
            <p className="text-xs text-muted-foreground">
              Charged to a tier without free shipping. ₹0 or more.
            </p>
            {fieldError('shippingFeeMinor').map((e) => (
              <p key={e.message} className="text-sm text-destructive">
                {e.message}
              </p>
            ))}
          </div>
          <div className="grid max-w-sm gap-1.5">
            <Label htmlFor="paymentTimeout">Payment timeout (minutes)</Label>
            <Input
              id="paymentTimeout"
              inputMode="numeric"
              value={timeoutText}
              onChange={(e) => setTimeoutText(e.target.value)}
              disabled={!canWrite}
              aria-invalid={timeoutProblem ? true : undefined}
              aria-describedby="paymentTimeout-problem"
            />
            {timeoutProblem && (
              <p id="paymentTimeout-problem" className="text-sm text-destructive">
                {timeoutProblem}
              </p>
            )}
            <p className="text-xs text-muted-foreground">
              How long a placed order waits for payment before it expires: 5 to 15 minutes — never
              longer than a stock hold lasts once extended.
            </p>
            {fieldError('paymentTimeoutMinutes').map((e) => (
              <p key={e.message} className="text-sm text-destructive">
                {e.message}
              </p>
            ))}
          </div>
          <div className="grid max-w-sm gap-1.5">
            <Label htmlFor="cancelUntil">Cancel window</Label>
            <Select
              value={cancelUntil}
              onValueChange={(v) => setCancelUntil(v as CancelUntil)}
              disabled={!canWrite}
            >
              <SelectTrigger id="cancelUntil" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(CANCEL_UNTIL_LABEL) as CancelUntil[]).map((k) => (
                  <SelectItem key={k} value={k}>
                    {CANCEL_UNTIL_LABEL[k]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Past the window an order can only be refunded, not cancelled.
            </p>
          </div>
          <div className="grid max-w-sm gap-1.5">
            <Label htmlFor="settingsNotes">Notes (optional)</Label>
            <Input
              id="settingsNotes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              disabled={!canWrite}
            />
          </div>

          {refusal && (
            <div
              role="alert"
              className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm"
            >
              <p>{refusal}</p>
              {fieldErrors
                .filter((e) => !PLACED_FIELDS.includes(e.field))
                .map((e) => (
                  <p key={`${e.field}-${e.message}`}>{describeFieldError(e, ORDER_SETTINGS_LABELS)}</p>
                ))}
            </div>
          )}

          <div>
            <Button type="submit" disabled={!canWrite || !ready || publish.isPending}>
              Publish
            </Button>
            {!canWrite && (
              <p className="mt-1 text-xs text-muted-foreground">
                Publishing needs <code>orders.write</code>
              </p>
            )}
          </div>
        </form>

        <ConfirmDialog
          open={confirmOpen}
          onOpenChange={setConfirmOpen}
          title="Publish order settings"
          confirmLabel="Publish"
          pending={publish.isPending}
          onConfirm={submit}
        >
          <p>
            Shipping {shippingMinor === null ? '—' : rupees(shippingMinor)}, payment timeout{' '}
            {timeout ?? '—'} min, cancel{' '}
            {cancelUntil === 'SHIPPED' ? 'until shipped' : 'until packed'}. New quotes use these the
            moment this is published.
          </p>
        </ConfirmDialog>
      </CardContent>
    </Card>
  )
}

export default OrderSettingsPage
