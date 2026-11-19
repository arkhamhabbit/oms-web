import * as React from 'react'
import { Link } from 'react-router-dom'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  useBookAndPrintMutation,
  useBookingPreviewQuery,
  useBookShipmentsMutation,
  useCurrentShippingSettingsQuery,
  useShippingProvidersQuery,
  type BookAndPrintResult,
  type BookingPreview,
  type BookOrder,
  type BookingResult,
} from '@/api/shipping'
import { usePermissions } from '@/auth/usePermissions'
import { noticeFromError } from '@/components/common/NoticeBanner'
import { isApiError } from '@/lib/api-error'
import { base64ToBlob, box, grams, openPrintTab, providerLabel } from '@/lib/shipping'

/** The delivery pincode with the city and state that will be sent; never blank, never a guess. */
function deliveryLine(p: BookingPreview): string {
  const place = [p.deliveryCity, p.deliveryState].filter(Boolean).join(', ')
  const pin = p.deliveryPincode ? `Deliver to ${p.deliveryPincode}` : 'Deliver to'
  return place ? `${pin}, ${place}` : `${pin} · City and state will be looked up at booking`
}

/** Where the weight or the box came, as the team reads it. */
const SOURCE_LABEL = {
  PRODUCTS: 'from the products',
  FALLBACK: 'fallback package',
  MIXED: 'part from the products, part fallback',
  OVERRIDE: 'typed by hand',
} as const

export interface OrderToBook {
  id: string
  number: string
}

export type BookMode = 'book' | 'book-and-print'

interface Row {
  orderId: string
  number: string
  weight: string
  length: string
  width: string
  height: string
  carrier: string
  tracking: string
}

const intOrUndefined = (text: string) => (/^\d+$/.test(text.trim()) ? Number(text.trim()) : undefined)

function rowProblem(row: Row, manual: boolean): string | undefined {
  const dims = [row.weight, row.length, row.width, row.height]
  if (dims.some((d) => d.trim() !== '' && !/^\d+$/.test(d.trim()))) {
    return 'Weight and box are whole numbers (grams, millimetres), or blank for OMS to work out.'
  }
  const boxGiven = [row.length, row.width, row.height].filter((d) => d.trim() !== '').length
  if (boxGiven !== 0 && boxGiven !== 3) {
    return 'Give all three box sides, or none.'
  }
  if (manual && (!row.carrier.trim() || !row.tracking.trim())) {
    return 'A Manual booking needs the carrier and the tracking reference.'
  }
  return undefined
}

function toBookOrder(row: Row, manual: boolean): BookOrder {
  return {
    orderId: row.orderId,
    weightGrams: intOrUndefined(row.weight),
    lengthMm: intOrUndefined(row.length),
    widthMm: intOrUndefined(row.width),
    heightMm: intOrUndefined(row.height),
    ...(manual ? { carrier: row.carrier.trim(), trackingReference: row.tracking.trim() } : {}),
  }
}

/**
 * Book (or book and print) up to twenty orders in one action (D13.5). The provider is the
 * settings' default, shown and not chosen — unless the member can also change shipping settings.
 * Each order books on its own; the result lists every order Booked or Refused with the server's
 * sentence. Mounted only while open, so its idempotency key is minted once per opening.
 */
function BookShipmentsDialog({
  orders,
  mode,
  onClose,
  onDone,
}: {
  orders: OrderToBook[] | undefined
  mode: BookMode
  onClose: () => void
  /** The request succeeded (whatever each order's outcome): the caller clears its selection. */
  onDone?: () => void
}) {
  return (
    <Dialog open={!!orders} onOpenChange={(open) => !open && onClose()}>
      {orders && <Body orders={orders} mode={mode} onClose={onClose} onDone={onDone} />}
    </Dialog>
  )
}

function Body({
  orders,
  mode,
  onClose,
  onDone,
}: {
  orders: OrderToBook[]
  mode: BookMode
  onClose: () => void
  onDone?: () => void
}) {
  const { has } = usePermissions()
  const canChoose = has('shipping.settings')
  const settings = useCurrentShippingSettingsQuery()
  const providers = useShippingProvidersQuery(canChoose)
  const book = useBookShipmentsMutation()
  const bookAndPrint = useBookAndPrintMutation()
  const pending = book.isPending || bookAndPrint.isPending

  const [chosen, setChosen] = React.useState<string | undefined>()
  const provider = chosen ?? settings.data?.defaultProviderCode
  const manual = provider === 'MANUAL'
  const [result, setResult] = React.useState<BookAndPrintResult | undefined>()
  // What each order would send, asked before anything is booked: nothing is called or written.
  // Not asked again once the booking is done.
  const preview = useBookingPreviewQuery(
    orders.map((o) => o.number),
    chosen,
    !result
  )
  const previews = new Map<string, BookingPreview>(
    (preview.data?.results ?? []).map((p) => [p.orderNumber!, p])
  )
  const [rows, setRows] = React.useState<Row[]>(() =>
    orders.map((o) => ({
      orderId: o.id,
      number: o.number,
      weight: '',
      length: '',
      width: '',
      height: '',
      carrier: '',
      tracking: '',
    }))
  )
  const [key, setKey] = React.useState(() => crypto.randomUUID())
  const [refusal, setRefusal] = React.useState<string | undefined>()
  const [labelsUrl, setLabelsUrl] = React.useState<string | undefined>()

  // An order the preview refuses is shown with the server's sentence and left out of the booking.
  const included = rows.filter((r) => previews.get(r.number)?.bookable === true)
  const excluded = rows.filter((r) => previews.has(r.number) && !previews.get(r.number)!.bookable)
  const problems = rows.map((r) => rowProblem(r, manual))
  const ready =
    !!provider &&
    preview.isSuccess &&
    included.length > 0 &&
    rows.every((r, i) => !included.includes(r) || problems[i] === undefined)

  function update(index: number, patch: Partial<Row>) {
    setRows((prev) => prev.map((r, i) => (i === index ? { ...r, ...patch } : r)))
  }

  function submit() {
    setRefusal(undefined)
    const body = {
      orders: included.map((r) => toBookOrder(r, manual)),
      // Shown, not chosen: the server's default is used unless a settings admin picked another.
      providerCode: chosen,
    }
    const tab = mode === 'book-and-print' ? openPrintTab() : undefined
    const call =
      mode === 'book'
        ? book.mutateAsync({ body, idempotencyKey: key })
        : bookAndPrint.mutateAsync({ body, idempotencyKey: key })
    call
      .then((answer) => {
        const labels = (answer as BookAndPrintResult).labels
        if (tab && labels?.contentBase64) {
          setLabelsUrl(tab.show(base64ToBlob(labels.contentBase64, labels.contentType)))
        } else {
          tab?.close()
        }
        setResult(answer)
        onDone?.()
      })
      .catch((error) => {
        tab?.close()
        setRefusal(noticeFromError(error, 'This booking').text)
        if (isApiError(error) && error.code !== 'NETWORK_ERROR') {
          setKey(crypto.randomUUID())
        }
      })
  }

  const title = mode === 'book' ? 'Book shipments' : 'Book and print'

  if (result) {
    return (
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>{title}: result</DialogTitle>
          <DialogDescription>
            {result.booked ?? 0} booked, {result.refused ?? 0} refused. Each order books on its
            own: a refusal never undoes another booking.
          </DialogDescription>
        </DialogHeader>
        <BookingResults results={result.results ?? []} />
        {mode === 'book-and-print' && (
          <div className="text-sm">
            {result.labels ? (
              <p>
                Labels: {result.labels.fileName} ({result.labels.labels} labels,{' '}
                {result.labels.pages} pages), opened in a new tab.{' '}
                {labelsUrl && (
                  <a
                    href={labelsUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="underline underline-offset-2"
                  >
                    Open the labels again
                  </a>
                )}
              </p>
            ) : (
              <p role="alert" className="text-destructive">
                {result.labelsError ??
                  (result.booked ? 'No label file came back.' : 'Nothing was booked, so there is nothing to print.')}
              </p>
            )}
          </div>
        )}
        <DialogFooter>
          <Button onClick={onClose}>Done</Button>
        </DialogFooter>
      </DialogContent>
    )
  }

  return (
    <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-4xl">
      <DialogHeader>
        <DialogTitle>{title}</DialogTitle>
        <DialogDescription>
          {orders.length} {orders.length === 1 ? 'order' : 'orders'}, prepaid, each booked on its
          own.{mode === 'book-and-print' && ' The labels of those booked open as one file.'}
        </DialogDescription>
      </DialogHeader>

      <div className="flex flex-wrap items-center gap-3 text-sm">
        <span className="text-muted-foreground">Provider</span>
        {canChoose && providers.data ? (
          <Select value={provider} onValueChange={setChosen}>
            <SelectTrigger className="w-64" aria-label="Provider">
              <SelectValue placeholder="Provider" />
            </SelectTrigger>
            <SelectContent>
              {providers.data.map((p) => (
                <SelectItem key={p.code} value={p.code!} disabled={!p.configured}>
                  {p.name ?? providerLabel(p.code)}
                  {p.isDefault ? ' (default)' : ''}
                  {!p.configured ? ' — not configured' : ''}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : (
          <span className="font-medium" data-testid="booking-provider">
            {settings.isLoading ? '…' : `${providerLabel(provider)} (the default)`}
          </span>
        )}
      </div>
      {settings.isError && (
        <p role="alert" className="text-sm text-destructive">
          {isApiError(settings.error) ? settings.error.message : 'The shipping settings could not be read.'}
        </p>
      )}
      <p className="text-xs text-muted-foreground">
        What each order would send is read first and nothing is booked yet. A weight or box typed
        below replaces it; left blank, what is shown is sent.
        {manual && ' A Manual booking needs the carrier and the tracking reference for every order.'}
      </p>
      {preview.isLoading && <p className="text-sm text-muted-foreground">Reading what would be sent…</p>}
      {preview.isError && (
        <p role="alert" className="text-sm text-destructive">
          {noticeFromError(preview.error, 'This booking').text}
        </p>
      )}
      {excluded.length > 0 && (
        <p className="text-sm" data-testid="preview-excluded">
          {excluded.length} {excluded.length === 1 ? 'order' : 'orders'} cannot be booked and{' '}
          {excluded.length === 1 ? 'is' : 'are'} left out.
        </p>
      )}

      <Table className="[&_td]:px-1.5 [&_td]:align-top [&_th]:px-1.5">
        <TableHeader>
          <TableRow>
            <TableHead>Order</TableHead>
            <TableHead>Weight (g)</TableHead>
            <TableHead>Box L × W × H (mm)</TableHead>
            {manual && <TableHead>Carrier</TableHead>}
            {manual && <TableHead>Tracking reference</TableHead>}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row, i) => {
            const p = previews.get(row.number)
            if (p && !p.bookable) {
              return (
                <TableRow key={row.orderId} data-testid={`preview-${row.number}`} data-bookable="false">
                  <TableCell className="font-mono">{row.number}</TableCell>
                  <TableCell colSpan={manual ? 4 : 2} className="text-sm whitespace-normal">
                    <Badge variant="destructive">Left out</Badge>{' '}
                    <span role="note">{p.sentence ?? 'This order cannot be booked.'}</span>
                  </TableCell>
                </TableRow>
              )
            }
            return (
              <TableRow key={row.orderId} data-testid={`preview-${row.number}`} data-bookable="true">
                <TableCell className="font-mono">
                  {row.number}
                  {p && (
                    <p className="mt-1 max-w-56 font-sans text-xs whitespace-normal text-muted-foreground">
                      {providerLabel(p.providerCode)}
                      {p.pickupWarehouse ? ` · from ${p.pickupWarehouse.code}` : ' · no pickup warehouse'}
                    </p>
                  )}
                  {p && (
                    <p
                      className="mt-1 max-w-56 font-sans text-xs whitespace-normal text-muted-foreground"
                      data-testid={`preview-destination-${row.number}`}
                    >
                      {deliveryLine(p)}
                    </p>
                  )}
                  {problems[i] && (
                    <p className="mt-1 max-w-48 font-sans text-xs whitespace-normal text-destructive">
                      {problems[i]}
                    </p>
                  )}
                </TableCell>
                <TableCell>
                  <Input
                    aria-label={`Weight for ${row.number}`}
                    inputMode="numeric"
                    placeholder={p?.weightGrams == null ? 'auto' : String(p.weightGrams)}
                    className="w-24"
                    value={row.weight}
                    onChange={(e) => update(i, { weight: e.target.value })}
                  />
                  {p && (
                    <p className="mt-1 text-xs whitespace-normal text-muted-foreground">
                      {grams(p.weightGrams)} {p.weightSource ? SOURCE_LABEL[p.weightSource] : ''}
                    </p>
                  )}
                </TableCell>
                <TableCell>
                  <div className="flex gap-1">
                    {(['length', 'width', 'height'] as const).map((side) => (
                      <Input
                        key={side}
                        aria-label={`Box ${side} for ${row.number}`}
                        inputMode="numeric"
                        placeholder={
                          p?.[`${side}Mm` as const] == null
                            ? side[0].toUpperCase()
                            : String(p[`${side}Mm` as const])
                        }
                        className="w-16"
                        value={row[side]}
                        onChange={(e) => update(i, { [side]: e.target.value })}
                      />
                    ))}
                  </div>
                  {p && (
                    <p className="mt-1 text-xs whitespace-normal text-muted-foreground">
                      {box(p.lengthMm, p.widthMm, p.heightMm)} {p.boxSource ? SOURCE_LABEL[p.boxSource] : ''}
                    </p>
                  )}
                </TableCell>
                {manual && (
                  <TableCell>
                    <Input
                      aria-label={`Carrier for ${row.number}`}
                      placeholder="Delhivery"
                      className="w-36"
                      value={row.carrier}
                      onChange={(e) => update(i, { carrier: e.target.value })}
                    />
                  </TableCell>
                )}
                {manual && (
                  <TableCell>
                    <Input
                      aria-label={`Tracking reference for ${row.number}`}
                      className="w-40"
                      value={row.tracking}
                      onChange={(e) => update(i, { tracking: e.target.value })}
                    />
                  </TableCell>
                )}
              </TableRow>
            )
          })}
        </TableBody>
      </Table>

      {refusal && (
        <p role="alert" className="text-sm text-destructive">
          {refusal}
        </p>
      )}

      <DialogFooter>
        <Button variant="outline" onClick={onClose} disabled={pending}>
          Cancel
        </Button>
        <Button onClick={submit} disabled={!ready || pending}>
          {mode === 'book' ? `Book ${included.length}` : `Book and print ${included.length}`}
        </Button>
      </DialogFooter>
    </DialogContent>
  )
}

/** Each order's outcome: Booked with its courier and AWB (both on the result), or Refused with the sentence. */
function BookingResults({ results }: { results: BookingResult[] }) {
  return (
    <Table aria-label="Booking results" className="[&_td]:whitespace-normal">
      <TableHeader>
        <TableRow>
          <TableHead>Order</TableHead>
          <TableHead>Outcome</TableHead>
          <TableHead>Courier</TableHead>
          <TableHead>AWB</TableHead>
          <TableHead>Why</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {results.map((r) => {
          return (
            <TableRow key={r.orderId} data-outcome={r.outcome}>
              <TableCell className="font-mono">
                {r.orderNumber ? <Link to={`/orders/${r.orderId}`}>{r.orderNumber}</Link> : r.orderId}
              </TableCell>
              <TableCell>
                {r.outcome === 'BOOKED' ? (
                  <Badge>Booked</Badge>
                ) : (
                  <Badge variant="destructive">Refused</Badge>
                )}
              </TableCell>
              <TableCell>{r.outcome === 'BOOKED' ? (r.courierName ?? '—') : '—'}</TableCell>
              <TableCell className="font-mono">
                {r.outcome === 'BOOKED' ? (r.awb ?? '—') : '—'}
              </TableCell>
              <TableCell className="text-sm">{r.outcome === 'REFUSED' ? r.sentence : ''}</TableCell>
            </TableRow>
          )
        })}
      </TableBody>
    </Table>
  )
}

export { BookShipmentsDialog, BookingResults }
