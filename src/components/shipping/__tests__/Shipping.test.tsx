import { calls, json, refusal, resetFetch, respondWith, type RecordedCall } from '@/test/fake-fetch'
import { installRadixPolyfills } from '@/test/polyfills'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render as rtlRender, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { OrderDetail, OrderSummary } from '@/api/orders'
import { WarehouseFormDialog } from '@/components/inventory/WarehouseFormDialog'
import { BreadcrumbProvider } from '@/layouts/breadcrumb-context'
import {
  actionBlockedReason,
  canBookRow,
  canPrintRow,
  canSelectRow,
  SELECTION_CAP,
  SELECTION_CAP_HINT,
  SHIPPING_PRESETS,
  selectionBlocked,
  togglePage,
  toggleSelected,
} from '@/lib/shipping'
import OrderDetailPage from '@/pages/OrderDetailPage'
import OrdersPage from '@/pages/OrdersPage'
import ShippingSettingsPage from '@/pages/ShippingSettingsPage'

installRadixPolyfills()

const ALL = ['orders.read', 'orders.write', 'orders.fulfil', 'shipping.read', 'shipping.book', 'warehouse.read']

function summary(n: number, extra: Partial<OrderSummary> = {}): OrderSummary {
  return {
    id: `o-${n}`,
    number: `HBT_${10000000 + n}`,
    status: 'CONFIRMED',
    refundState: 'NONE',
    shipmentState: 'NONE',
    bookable: true,
    labelPrinted: false,
    itemCount: 3,
    paymentStatus: 'CAPTURED',
    payableMinor: 84800,
    paymentMethod: 'CARD',
    confirmedAt: '2026-11-18T08:00:00Z',
    ...extra,
  }
}

const SETTINGS = {
  versionId: 'v-5',
  defaultProviderCode: 'MANUAL',
  defaultPickupWarehouseId: 'w-1',
  autoBookEnabled: false,
  autoBookDelayMinutes: 30,
  fallbackWeightGrams: 500,
  fallbackLengthMm: 200,
  fallbackWidthMm: 150,
  fallbackHeightMm: 100,
  effectiveFrom: '2026-11-18T15:51:20Z',
  pickupWarehouse: {
    id: 'w-1',
    code: 'VERIFY',
    name: 'Verify Warehouse',
    active: true,
    contactName: 'Habbit Dispatch',
    contactPhone: '+919999999999',
    contactEmail: null,
    missingContact: ['EMAIL'],
  },
}

const PROVIDERS = [
  { code: 'MANUAL', name: 'Manual', configured: true, isDefault: true, supports: { label: false, tracking: false, cancel: true } },
  { code: 'PROSHIP', name: 'Proship', configured: true, isDefault: false, supports: { label: true, tracking: true, cancel: true } },
  { code: 'OTHER', name: 'Other courier', configured: false, isDefault: false, supports: { label: true, tracking: true, cancel: false } },
]

const WAREHOUSE = {
  id: 'w-1',
  code: 'VERIFY',
  name: 'Verify Warehouse',
  type: 'OWN',
  addressLine1: 'Line 1',
  city: 'Bengaluru',
  state: 'Karnataka',
  pincode: '560001',
  contactName: 'Habbit Dispatch',
  contactPhone: '+919999999999',
  contactEmail: null,
  active: true,
  version: 4,
}

function render(ui: React.ReactElement, path: string, route: string) {
  return rtlRender(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MemoryRouter initialEntries={[path]}>
        <BreadcrumbProvider>
          <Routes>
            <Route path={route} element={ui} />
          </Routes>
        </BreadcrumbProvider>
      </MemoryRouter>
    </QueryClientProvider>
  )
}

type Extra = (call: RecordedCall) => Response | undefined

function serve(permissions: string[], extra: Extra = () => undefined, list: OrderSummary[] = [summary(5)]) {
  respondWith((call) => {
    const answer = extra(call)
    if (answer) return answer
    const path = call.url.pathname
    if (path === '/api/admin/profile') {
      return json(200, { id: 'u', email: 'a@b.c', name: 'A', permissions, roles: [], version: 1 })
    }
    if (path === '/api/admin/orders') {
      return json(200, { content: list, totalElements: list.length, totalPages: 1 })
    }
    if (path === '/api/admin/orders/settings') {
      return json(200, { shippingFeeMinor: 4900, paymentTimeoutMinutes: 15, paymentLinkValidityHours: 24, cancelUntil: 'PACKED' })
    }
    if (path === '/api/admin/shipping/settings') return json(200, SETTINGS)
    if (path === '/api/admin/shipping/settings/versions') {
      return json(200, { content: [SETTINGS], totalElements: 1, totalPages: 1 })
    }
    if (path === '/api/admin/shipping/providers') return json(200, PROVIDERS)
    if (path === '/api/admin/warehouses') return json(200, { content: [WAREHOUSE], totalElements: 1, totalPages: 1 })
    if (path === '/api/admin/warehouses/w-1') return json(200, WAREHOUSE)
    if (path === '/api/admin/shipments') return json(200, { content: [], totalElements: 0, totalPages: 0 })
    return json(404, { code: 'NOT_FOUND', message: `unmocked ${path}`, traceId: 't', fieldErrors: [] })
  })
}

const tab = { location: { href: '' }, close: vi.fn() }

beforeEach(() => {
  resetFetch()
  sessionStorage.clear()
  tab.location.href = ''
  tab.close.mockClear()
  vi.stubGlobal('open', vi.fn(() => tab))
  URL.createObjectURL = vi.fn(() => 'blob:labels')
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('the selection cap', () => {
  it('stops at twenty and refuses the 21st', () => {
    const rows = Array.from({ length: 21 }, (_, i) => summary(i + 1))
    let sel = togglePage(new Map(), rows)
    expect(sel.size).toBe(SELECTION_CAP)
    expect(selectionBlocked(sel, 'o-21')).toBe(true)
    expect(selectionBlocked(sel, 'o-1')).toBe(false)
    sel = toggleSelected(sel, rows[20])
    expect(sel.has('o-21')).toBe(false)
    sel = toggleSelected(sel, rows[0])
    expect(sel.size).toBe(19)
    // the header box unticks a page that is all ticked
    expect(togglePage(sel, rows.slice(1, 20)).size).toBe(0)
  })

  it('shows the payment link validity in the settings in effect', async () => {
    serve(ALL)
    render(<OrdersPage />, '/orders', '/orders')
    expect(await screen.findByText('Link valid for 24 hours')).toBeInTheDocument()
  })

  it('disables the 21st box on the list with the hint, and shows the selection bar with its count', async () => {
    const user = userEvent.setup()
    const rows = Array.from({ length: 21 }, (_, i) => summary(i + 1))
    serve(ALL, undefined, rows)
    render(<OrdersPage />, '/orders', '/orders')

    await waitFor(() => expect(screen.getByLabelText('Select HBT_10000021')).toBeInTheDocument())
    await user.click(screen.getByLabelText('Select this page'))

    const bar = await screen.findByRole('region', { name: 'Selection' })
    expect(within(bar).getByTestId('selection-count')).toHaveTextContent('20 of 20 selected')
    expect(within(bar).getByText(SELECTION_CAP_HINT)).toBeInTheDocument()
    const last = screen.getByLabelText('Select HBT_10000021')
    expect(last).toBeDisabled()
    expect(last.parentElement).toHaveAttribute('title', SELECTION_CAP_HINT)
    expect(calls.some((c) => c.method === 'POST')).toBe(false)
  }, 15000) // 21 rows: slow under a full parallel run

  it('shows no boxes and no selection bar without shipping.book', async () => {
    serve(['orders.read', 'shipping.read'])
    render(<OrdersPage />, '/orders', '/orders')
    await waitFor(() => expect(screen.getByText('HBT_10000005')).toBeInTheDocument())
    expect(screen.queryByLabelText('Select HBT_10000005')).not.toBeInTheDocument()
    expect(screen.queryByRole('region', { name: 'Selection' })).not.toBeInTheDocument()
    expect(screen.getByText('Not booked')).toBeInTheDocument()
  })

  it('offers the packing presets with their counts', async () => {
    const user = userEvent.setup()
    serve(ALL)
    render(<OrdersPage />, '/orders', '/orders')
    for (const label of ['To ship', 'Booking failed', 'Booked, label not printed', 'In transit', 'Problems']) {
      await waitFor(() => expect(screen.getByLabelText(`${label} count`)).toHaveTextContent('1'))
    }
    await user.click(screen.getByRole('button', { name: /^To ship/ }))
    await waitFor(() => {
      const list = calls.filter((c) => c.url.pathname === '/api/admin/orders' && c.url.searchParams.get('size') === '20').at(-1)!
      expect(list.url.searchParams.get('bookable')).toBe('true')
      expect(list.url.searchParams.get('status')).toBeNull()
      expect(list.url.searchParams.getAll('shipmentState')).toEqual(['NONE'])
    })
  })

  it('sends exactly what each preset says, and To ship is the bookable, never-failed list', () => {
    const sent = Object.fromEntries(SHIPPING_PRESETS.map((p) => [p.key, p.filter]))
    expect(sent).toEqual({
      TO_SHIP: { bookable: true, shipmentState: ['NONE'] },
      BOOKING_FAILED: { shipmentState: ['BOOKING_FAILED'] },
      NOT_PRINTED: { shipmentState: ['BOOKED'], labelPrinted: false },
      IN_TRANSIT: { shipmentState: ['IN_TRANSIT'] },
      PROBLEMS: { shipmentState: ['PROBLEM'] },
    })
  })

  it('counts an order with a failed booking under Booking failed only', async () => {
    const user = userEvent.setup()
    const rows = [summary(5), summary(6, { shipmentState: 'BOOKING_FAILED', bookable: true })]
    serve(
      ALL,
      (call) => {
        if (call.url.pathname !== '/api/admin/orders') return undefined
        const q = call.url.searchParams
        const states = q.getAll('shipmentState')
        const hit = rows.filter(
          (r) =>
            (q.get('bookable') === null || String(r.bookable) === q.get('bookable')) &&
            (states.length === 0 || states.includes(r.shipmentState!))
        )
        return json(200, { content: hit, totalElements: hit.length, totalPages: 1 })
      },
      rows
    )
    render(<OrdersPage />, '/orders', '/orders')
    await waitFor(() => expect(screen.getByLabelText('To ship count')).toHaveTextContent('1'))
    expect(screen.getByLabelText('Booking failed count')).toHaveTextContent('1')
    await user.click(screen.getByRole('button', { name: /^To ship/ }))
    await waitFor(() => {
      expect(screen.getByText('HBT_10000005')).toBeInTheDocument()
      expect(screen.queryByText('HBT_10000006')).not.toBeInTheDocument()
    })
    await user.click(screen.getByRole('button', { name: /^Booking failed/ }))
    await waitFor(() => {
      expect(screen.getByText('HBT_10000006')).toBeInTheDocument()
      expect(screen.queryByText('HBT_10000005')).not.toBeInTheDocument()
    })
  })

  it('offers a box only on bookable rows and rows with a live shipment, and says why an action is off', async () => {
    const user = userEvent.setup()
    const rows = [
      summary(5),
      summary(6, { bookable: false, status: 'PACKED', shipmentState: 'BOOKED', shipmentId: 's-6', courierName: 'Delhivery', awb: 'AWB6' }),
      summary(7, { bookable: false, status: 'DELIVERED', shipmentState: 'DELIVERED', shipmentId: null }),
    ]
    serve(ALL, undefined, rows)
    render(<OrdersPage />, '/orders', '/orders')
    await waitFor(() => expect(screen.getByLabelText('Select HBT_10000005')).toBeInTheDocument())
    expect(screen.getByLabelText('Select HBT_10000006')).toBeInTheDocument()
    expect(screen.queryByLabelText('Select HBT_10000007')).not.toBeInTheDocument()
    expect(rows.map(canSelectRow)).toEqual([true, true, false])
    expect(rows.map(canBookRow)).toEqual([true, false, false])
    expect(rows.map(canPrintRow)).toEqual([false, true, false])

    // only the booked order is ticked: booking fits none of the selection, printing fits it
    await user.click(screen.getByLabelText('Select HBT_10000006'))
    const bar = await screen.findByRole('region', { name: 'Selection' })
    expect(within(bar).getByRole('button', { name: 'Book shipments' })).toBeDisabled()
    expect(within(bar).getByRole('button', { name: 'Book and print' })).toBeDisabled()
    expect(within(bar).getByRole('button', { name: 'Print labels' })).toBeEnabled()
    expect(within(bar).getByTestId('selection-reason')).toHaveTextContent(
      'Booking is off: None of the selected orders can be booked now.'
    )
    // both ticked: both actions fit something, and each says how many it takes
    await user.click(screen.getByLabelText('Select HBT_10000005'))
    expect(within(bar).getByRole('button', { name: 'Book shipments (1)' })).toBeEnabled()
    expect(within(bar).getByRole('button', { name: 'Print labels (1)' })).toBeEnabled()
    expect(within(bar).queryByTestId('selection-reason')).not.toBeInTheDocument()
    expect(actionBlockedReason(new Map(), 'print')).toMatch(/booked shipment/)
  })

  it('reads courier, AWB and tracking from the row with no shipment reads, and shows items and payment status', async () => {
    serve(
      ALL,
      undefined,
      [
        summary(5),
        summary(6, {
          bookable: false,
          status: 'PACKED',
          shipmentState: 'BOOKED',
          shipmentId: 's-6',
          providerCode: 'PROSHIP',
          courierName: 'Delhivery',
          awb: 'AWB-6',
          trackingUrl: 'https://track.example/AWB-6',
          itemCount: 7,
          paymentStatus: 'REFUND_PENDING',
        }),
      ]
    )
    render(<OrdersPage />, '/orders', '/orders')
    const rowOf = (n: string) => screen.getByText(n).closest('tr')!
    await waitFor(() => expect(rowOf('HBT_10000006')).toHaveTextContent('Delhivery · AWB-6'))
    const row6 = rowOf('HBT_10000006')
    expect(within(row6).getByRole('link', { name: 'Track' })).toHaveAttribute('href', 'https://track.example/AWB-6')
    expect(row6).toHaveTextContent('7')
    expect(row6).toHaveTextContent('Refund owed') // the served paymentStatus, not a guess from confirmedAt
    expect(rowOf('HBT_10000005')).toHaveTextContent('Not booked')
    expect(rowOf('HBT_10000005')).toHaveTextContent('Captured')
    expect(screen.getByRole('columnheader', { name: 'Items' })).toBeInTheDocument()
    // the whole page cost: no shipment read per row, however many rows are booked
    expect(calls.filter((c) => c.url.pathname.startsWith('/api/admin/shipments'))).toHaveLength(0)
  })
})

describe('booking from the list', () => {
  const PREVIEW = {
    bookable: 1,
    results: [
      {
        orderId: 'o-5',
        orderNumber: 'HBT_10000005',
        bookable: true,
        providerCode: 'MANUAL',
        providerName: 'Manual',
        pickupWarehouse: { id: 'w-1', code: 'VERIFY', name: 'Verify Warehouse' },
        weightGrams: 200,
        weightSource: 'PRODUCTS',
        lengthMm: 200,
        widthMm: 150,
        heightMm: 100,
        boxSource: 'FALLBACK',
        deliveryPincode: '110009',
        deliveryCity: 'North West Delhi',
        deliveryState: 'Delhi',
      },
      {
        orderId: 'o-6',
        orderNumber: 'HBT_10000006',
        bookable: false,
        providerCode: 'MANUAL',
        providerName: 'Manual',
        sentence: 'Order HBT_10000006 is not paid yet, so it cannot be booked.',
      },
    ],
  }

  it('opens with the preview, leaves out the order it refuses, and books the rest with courier and AWB from the result', async () => {
    const user = userEvent.setup()
    serve(ALL, (call) => {
      if (call.url.pathname === '/api/admin/shipments/preview') return json(200, PREVIEW)
      if (call.url.pathname === '/api/admin/shipments/book') {
        return json(200, {
          booked: 1,
          refused: 0,
          results: [
            { orderId: 'o-5', orderNumber: 'HBT_10000005', outcome: 'BOOKED', shipmentId: 's-5', courierName: 'Hand delivery', awb: 'W-1' },
          ],
        })
      }
      return undefined
    }, [summary(5), summary(6)])
    render(<OrdersPage />, '/orders', '/orders')

    await waitFor(() => expect(screen.getByLabelText('Select HBT_10000006')).toBeInTheDocument())
    await user.click(screen.getByLabelText('Select HBT_10000005'))
    await user.click(screen.getByLabelText('Select HBT_10000006'))
    await user.click(screen.getByRole('button', { name: 'Book shipments' }))

    const dialog = await screen.findByRole('dialog')
    const row5 = await within(dialog).findByTestId('preview-HBT_10000005')
    expect(row5).toHaveTextContent('200 g from the products')
    expect(row5).toHaveTextContent('200 × 150 × 100 mm fallback package')
    expect(row5).toHaveTextContent('Manual · from VERIFY')
    expect(within(dialog).getByTestId('preview-destination-HBT_10000005')).toHaveTextContent(
      'Deliver to 110009, North West Delhi, Delhi'
    )
    const row6 = within(dialog).getByTestId('preview-HBT_10000006')
    expect(row6).toHaveAttribute('data-bookable', 'false')
    expect(row6).toHaveTextContent('Order HBT_10000006 is not paid yet, so it cannot be booked.')
    expect(within(dialog).getByTestId('preview-excluded')).toHaveTextContent('1 order cannot be booked and is left out')
    const preview = calls.find((c) => c.url.pathname === '/api/admin/shipments/preview')!
    expect(preview.body).toEqual({ orderNumbers: ['HBT_10000005', 'HBT_10000006'] })

    const book = within(dialog).getByRole('button', { name: 'Book 1' })
    expect(book).toBeDisabled() // Manual needs carrier and tracking
    await user.type(within(dialog).getByLabelText('Carrier for HBT_10000005'), 'Hand delivery')
    await user.type(within(dialog).getByLabelText('Tracking reference for HBT_10000005'), 'W-1')
    await user.click(book)

    const results = await screen.findByRole('table', { name: 'Booking results' })
    const booked = within(results).getAllByRole('row').find((r) => r.getAttribute('data-outcome') === 'BOOKED')!
    expect(booked).toHaveTextContent('Hand delivery')
    expect(booked).toHaveTextContent('W-1')

    const post = calls.find((c) => c.url.pathname === '/api/admin/shipments/book')!
    expect(post.headers.get('Idempotency-Key')).toBeTruthy()
    expect(post.body).toEqual({ orders: [{ orderId: 'o-5', carrier: 'Hand delivery', trackingReference: 'W-1' }] })
    // courier and AWB came with the result: no follow-up read of the new shipment
    expect(calls.some((c) => c.method === 'GET' && c.url.pathname.startsWith('/api/admin/shipments/'))).toBe(false)
    expect(screen.queryByRole('region', { name: 'Selection' })).not.toBeInTheDocument()
  }, 15000) // types into fields: slow under a full parallel run

  it('keeps an override editable and sends it', async () => {
    const user = userEvent.setup()
    serve(ALL, (call) => {
      if (call.url.pathname === '/api/admin/shipments/preview') return json(200, { bookable: 1, results: [PREVIEW.results[0]] })
      if (call.url.pathname === '/api/admin/shipments/book') return json(200, { booked: 1, refused: 0, results: [] })
      return undefined
    }, [summary(5)])
    render(<OrdersPage />, '/orders', '/orders')
    await waitFor(() => expect(screen.getByLabelText('Select HBT_10000005')).toBeInTheDocument())
    await user.click(screen.getByLabelText('Select HBT_10000005'))
    await user.click(await screen.findByRole('button', { name: 'Book shipments' }))
    const dialog = await screen.findByRole('dialog')
    const weight = await within(dialog).findByLabelText('Weight for HBT_10000005')
    expect(weight).toHaveAttribute('placeholder', '200')
    await user.type(weight, '350')
    await user.type(within(dialog).getByLabelText('Carrier for HBT_10000005'), 'X')
    await user.type(within(dialog).getByLabelText('Tracking reference for HBT_10000005'), 'T')
    await user.click(within(dialog).getByRole('button', { name: 'Book 1' }))
    await waitFor(() => expect(calls.some((c) => c.url.pathname === '/api/admin/shipments/book')).toBe(true))
    const post = calls.find((c) => c.url.pathname === '/api/admin/shipments/book')!
    expect(post.body).toMatchObject({ orders: [{ orderId: 'o-5', weightGrams: 350 }] })
  }, 15000)

  it('prints nothing when the server refuses one label, and shows its sentence', async () => {
    const user = userEvent.setup()
    serve(ALL, (call) => {
      if (call.url.pathname === '/api/admin/shipments/labels') {
        return refusal(422, 'BUSINESS_RULE_VIOLATION', 'HBT_10000005 has no provider label: it was booked by hand.')
      }
      return undefined
    }, [summary(5, { status: 'PACKED', shipmentState: 'BOOKED', bookable: false, shipmentId: 's-5', providerCode: 'MANUAL' })])
    render(<OrdersPage />, '/orders', '/orders')

    await waitFor(() => expect(screen.getByLabelText('Select HBT_10000005')).toBeInTheDocument())
    await user.click(screen.getByLabelText('Select HBT_10000005'))
    await user.click(screen.getByRole('button', { name: 'Print labels' }))

    const alert = await screen.findByText('HBT_10000005 has no provider label: it was booked by hand.')
    expect(alert.closest('[role="dialog"]')).toHaveTextContent('Labels not printed')
    expect(tab.close).toHaveBeenCalled()
    expect(tab.location.href).toBe('')
    const print = calls.find((c) => c.url.pathname === '/api/admin/shipments/labels')!
    expect(print.body).toEqual({ orderNumbers: ['HBT_10000005'] }) // by order number: no shipment is resolved first
    expect(calls.some((c) => c.url.pathname === '/api/admin/shipments')).toBe(false)
    // a refusal keeps the selection (behind the open dialog, so hidden from the accessibility tree)
    expect(screen.getByRole('region', { name: 'Selection', hidden: true })).toBeInTheDocument()
  })
})

const ORDER: OrderDetail = {
  id: 'o-5',
  number: 'HBT_10000005',
  status: 'CONFIRMED',
  version: 5,
  tierCode: 'SPROUT',
  refundState: 'NONE',
  shipmentState: 'NONE',
  labelPrinted: false,
  shipment: null,
  shipments: [],
  lines: [],
  events: [],
  payment: { status: 'CAPTURED', gatewayStatus: 'CAPTURED', amountMinor: 84800 },
}

function serveOrder(order: OrderDetail, permissions = ALL, detail?: object) {
  serve(permissions, (call) => {
    if (call.url.pathname === '/api/admin/orders/o-5') return json(200, order)
    if (call.url.pathname.startsWith('/api/admin/shipments/') && detail) return json(200, detail)
    return undefined
  })
}

describe('the Shipment panel', () => {
  it('not booked: Book shipment is the header action, and a booking failure shows its sentence', async () => {
    serveOrder({ ...ORDER, shipmentState: 'BOOKING_FAILED', bookingFailure: 'The pickup warehouse has no contact email.' })
    render(<OrderDetailPage />, '/orders/o-5', '/orders/:id')
    expect(await screen.findByText('The pickup warehouse has no contact email.')).toBeInTheDocument()
    expect(screen.getAllByText('Booking failed').length).toBeGreaterThan(0)
    expect(screen.getAllByRole('button', { name: 'Book shipment' })).toHaveLength(2)
    expect(screen.queryByRole('button', { name: 'Pack' })).not.toBeInTheDocument()
  })

  const BOOKED_AT = '2026-11-18T10:00:00Z'
  const manualShipment = {
    id: 's-5',
    providerCode: 'MANUAL',
    status: 'BOOKED',
    awb: 'W-TEST',
    courierName: 'Hand delivery',
    pickupWarehouseId: 'w-1',
    bookedAt: BOOKED_AT,
  }
  const detail = (providerCode: string) => ({
    shipment: { ...manualShipment, providerCode, version: 1 },
    bookedByKind: 'ADMIN',
    bookedBy: { id: 'u-1', kind: 'ADMIN', displayName: 'Super Admin' },
    weightGrams: 500,
    lengthMm: 200,
    widthMm: 150,
    heightMm: 100,
    events: [
      { id: 'ev0', eventAt: '2026-11-17T09:00:00Z', providerStatusCode: 'CANCELLED', status: 'CANCELLED', source: 'SYSTEM' },
      { id: 'ev1', eventAt: '2026-11-18T10:00:00Z', providerStatusCode: 'BOOKED', status: 'BOOKED', source: 'ADMIN' },
      { id: 'ev2', eventAt: '2026-11-18T12:00:00Z', providerStatusCode: '6', status: 'IN_TRANSIT', location: 'Delhi hub', source: 'POLL' },
      { id: 'ev3', eventAt: '2026-11-18T13:00:00Z', providerStatusCode: 'COURIER_CHANGED', status: null, source: 'POLL', remark: 'PROSHIP reports courier Delhivery; it was XpressBees testing Ankit.' },
    ],
    calls: [{ id: 'c-own', action: 'BOOK', success: true, providerCode, createdAt: BOOKED_AT }],
  })
  const packed: OrderDetail = {
    ...ORDER,
    status: 'PACKED',
    shipmentState: 'BOOKED',
    shipment: manualShipment,
    shipments: [
      manualShipment,
      { id: 's-old', providerCode: 'MANUAL', status: 'CANCELLED', awb: 'W-OLD', bookedAt: '2026-11-17T10:00:00Z', cancelledAt: '2026-11-17T10:05:00Z' },
    ],
    events: [],
    shippingCalls: [
      { id: 'c-1', action: 'BOOK', success: false, providerCode: 'PROSHIP', httpStatus: 422, createdAt: '2026-11-17T10:00:00Z', sentence: 'No courier rule covers this order.', triggeredByName: 'Super Admin' },
      { id: 'c-2', action: 'AUTH', success: true, providerCode: 'PROSHIP', httpStatus: 200, createdAt: '2026-11-17T09:59:59Z' },
    ],
  }

  it('Manual booked: the hand steps stay, with the timeline newest first, booked by and the history', async () => {
    serveOrder(packed, ALL, detail('MANUAL'))
    render(<OrderDetailPage />, '/orders/o-5', '/orders/:id')

    expect(await screen.findAllByRole('button', { name: 'Ship' })).not.toHaveLength(0)
    expect(screen.getAllByText('Booked, awaiting pickup').length).toBeGreaterThan(0)
    const events = within(await screen.findByRole('list', { name: 'Tracking events' })).getAllByRole('listitem')
    expect(events[0]).toHaveTextContent('Courier changed to Delhivery')
    expect(events[1]).toHaveTextContent('In transit · Delhi hub')
    expect(events[2]).toHaveTextContent('Booked')
    expect(events[3]).toHaveTextContent('Cancelled')
    expect(events[3]).toHaveTextContent('System') // an event OMS wrote with no team member
    // booked by is a name from the shipment itself; the order's history is not searched
    expect(await screen.findByText(/Super Admin/)).toBeInTheDocument()
    expect(screen.getByText('500 g, 200 × 150 × 100 mm')).toBeInTheDocument()
    expect(screen.getByText('Previous shipments (1)')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Refresh tracking' })).not.toBeInTheDocument()
  })

  it('lists the order\'s booking attempts apart from the shipment\'s own log, each opening whole with a name', async () => {
    const user = userEvent.setup()
    serve(ALL, (call) => {
      if (call.url.pathname === '/api/admin/orders/o-5') return json(200, packed)
      if (call.url.pathname === '/api/admin/shipments/s-5') return json(200, detail('MANUAL'))
      if (call.url.pathname === '/api/admin/shipping/calls/c-1') {
        return json(200, {
          call: { id: 'c-1', action: 'BOOK', success: false, providerCode: 'PROSHIP', triggeredBy: { id: null, kind: 'SYSTEM', displayName: 'System' } },
          requestBody: '{"a":1}',
          responseBody: '{"error":"3013"}',
        })
      }
      return undefined
    })
    render(<OrderDetailPage />, '/orders/o-5', '/orders/:id')
    const section = await screen.findByRole('region', { name: 'Booking attempts' })
    expect(section).toHaveTextContent('2 calls, 1 failed')
    await user.click(within(section).getByRole('button', { name: /Open/ }))
    const list = await screen.findByRole('list', { name: 'Booking attempts' })
    const items = within(list).getAllByRole('listitem')
    expect(items).toHaveLength(2)
    expect(items[0]).toHaveTextContent('No courier rule covers this order.')
    await user.click(within(items[0]).getByRole('button'))
    expect(await screen.findByText('System')).toBeInTheDocument() // triggered by, as a name
    expect(screen.getByText(/3013/)).toBeInTheDocument()
  })

  it('shows the shipment\'s own log, not the order\'s attempts', async () => {
    const user = userEvent.setup()
    serveOrder(packed, ALL, detail('MANUAL'))
    render(<OrderDetailPage />, '/orders/o-5', '/orders/:id')
    await user.click(await screen.findByRole('button', { name: /Log/ }))
    const list = await screen.findByRole('list', { name: 'Shipment calls' })
    expect(within(list).getAllByRole('listitem')).toHaveLength(1)
  })

  it('opens a cancelled shipment: its own events, the courier change and the cancel, and its own calls', async () => {
    const user = userEvent.setup()
    const old = {
      shipment: { id: 's-old', providerCode: 'PROSHIP', status: 'CANCELLED', awb: 'W-OLD', version: 3, cancelledAt: '2026-11-17T10:05:00Z' },
      cancelledBy: { id: 'u-1', kind: 'ADMIN', displayName: 'Super Admin' },
      events: [
        { id: 'o0', eventAt: '2026-11-17T10:00:00Z', providerStatusCode: 'BOOKED', status: 'BOOKED', source: 'ADMIN' },
        { id: 'o1', eventAt: '2026-11-17T10:02:00Z', providerStatusCode: 'COURIER_CHANGED', status: null, source: 'POLL', remark: 'PROSHIP reports courier Delhivery; it was XpressBees.' },
        { id: 'o2', eventAt: '2026-11-17T10:05:00Z', providerStatusCode: 'CANCELLED', status: 'CANCELLED', source: 'ADMIN' },
      ],
      calls: [
        { id: 'c-old-1', action: 'BOOK', success: true, providerCode: 'PROSHIP', createdAt: '2026-11-17T10:00:00Z' },
        { id: 'c-old-2', action: 'CANCEL', success: true, providerCode: 'PROSHIP', createdAt: '2026-11-17T10:05:00Z' },
      ],
    }
    serve(ALL, (call) => {
      if (call.url.pathname === '/api/admin/orders/o-5') return json(200, packed)
      if (call.url.pathname === '/api/admin/shipments/s-5') return json(200, detail('MANUAL'))
      if (call.url.pathname === '/api/admin/shipments/s-old') return json(200, old)
      if (call.url.pathname === '/api/admin/shipping/calls/c-old-2') {
        return json(200, {
          call: { id: 'c-old-2', action: 'CANCEL', success: true, providerCode: 'PROSHIP' },
          requestBody: '{"awb":"W-OLD"}',
          responseBody: '{"cancelledOk":true}',
        })
      }
      return undefined
    })
    render(<OrderDetailPage />, '/orders/o-5', '/orders/:id')
    await user.click(await screen.findByText('Previous shipments (1)'))
    await user.click(await screen.findByRole('button', { name: 'Open history of W-OLD' }))

    const drawer = await screen.findByRole('dialog', { name: 'Earlier shipment' })
    const events = within(await within(drawer).findByRole('list', { name: 'Tracking events' })).getAllByRole('listitem')
    expect(events).toHaveLength(3)
    expect(events[0]).toHaveTextContent('Cancelled')
    expect(events[1]).toHaveTextContent('Courier changed to Delhivery')
    expect(events[2]).toHaveTextContent('Booked')
    const list = within(drawer).getByRole('list', { name: 'Shipment calls' })
    expect(within(list).getAllByRole('listitem')).toHaveLength(2)
    expect(within(list).queryByText(/No courier rule/)).not.toBeInTheDocument() // the order's own attempts are not here
    await user.click(within(within(list).getAllByRole('listitem')[1]).getByRole('button'))
    expect(await within(drawer).findByText(/cancelledOk/)).toBeInTheDocument()
    await user.click(within(drawer).getByRole('button', { name: /Back to the shipment/ }))
    expect(await within(drawer).findByRole('list', { name: 'Tracking events' })).toBeInTheDocument()
  })

  it('reads nothing of an earlier shipment until its history is opened, and offers none without shipping.read', async () => {
    const user = userEvent.setup()
    serveOrder(packed, ['orders.read'], detail('MANUAL'))
    render(<OrderDetailPage />, '/orders/o-5', '/orders/:id')
    await user.click(await screen.findByText('Previous shipments (1)'))
    expect(screen.queryByRole('button', { name: /Open history of/ })).not.toBeInTheDocument()
    expect(calls.some((c) => c.url.pathname.startsWith('/api/admin/shipments/'))).toBe(false)
  })

  it('shows the delivery address as one line with city and state', async () => {
    serveOrder({
      ...ORDER,
      address: {
        addressId: 'a-1',
        label: 'Home',
        line1: '12 Test Street',
        landmark: 'Mukherjee Nagar',
        city: 'North West Delhi',
        state: 'Delhi',
        pincode: '110009',
        deliveryMobile: '+919999900001',
      },
    })
    render(<OrderDetailPage />, '/orders/o-5', '/orders/:id')
    expect(await screen.findByText('12 Test Street, Mukherjee Nagar, North West Delhi, Delhi 110009')).toBeInTheDocument()
  })

  it('an older order without city and state shows what it has, nothing guessed', async () => {
    serveOrder({
      ...ORDER,
      address: { addressId: 'a-1', line1: '9 Old Road', pincode: '400069', city: null, state: null, deliveryMobile: '+919999900001' },
    })
    render(<OrderDetailPage />, '/orders/o-5', '/orders/:id')
    expect(await screen.findByText('9 Old Road 400069')).toBeInTheDocument()
  })

  it('courier booked: the hand steps are hidden and Print label is the header action', async () => {
    const proship = { ...packed, shipment: { ...manualShipment, providerCode: 'PROSHIP' } }
    serveOrder(proship, ALL, detail('PROSHIP'))
    render(<OrderDetailPage />, '/orders/o-5', '/orders/:id')

    expect(await screen.findAllByRole('button', { name: 'Print label' })).toHaveLength(2)
    expect(screen.queryByRole('button', { name: 'Ship' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Refresh tracking' })).toBeInTheDocument()
  })

  it('read-only: state shown, every shipping action off', async () => {
    serveOrder(packed, ['orders.read', 'shipping.read'], detail('MANUAL'))
    render(<OrderDetailPage />, '/orders/o-5', '/orders/:id')
    const print = await screen.findByRole('button', { name: 'Print label' })
    expect(print).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Cancel shipment' })).toBeDisabled()
    expect(screen.getByText('Needs shipping.book')).toBeInTheDocument()
  })
})

describe('the order page extras', () => {
  it('draws the line thumbnail (or a placeholder) and the customer email when served', async () => {
    serveOrder({
      ...ORDER,
      consumerId: 'c-1',
      consumerName: 'Asha',
      consumerMobile: '+919999900001',
      consumerEmail: 'asha@example.com',
      lines: [
        { lineNumber: 1, productName: 'Tee', skuCode: 'TEE-1', quantity: 1, primaryImage: { thumbUrl: 'https://cdn.example/tee-thumb.jpg', url: 'https://cdn.example/tee.jpg' } },
        { lineNumber: 2, productName: 'Cap', skuCode: 'CAP-1', quantity: 1, primaryImage: null },
      ],
    })
    render(<OrderDetailPage />, '/orders/o-5', '/orders/:id')
    const img = await screen.findByAltText('Tee')
    expect(img).toHaveAttribute('src', 'https://cdn.example/tee-thumb.jpg')
    expect(screen.getAllByLabelText('No image')).toHaveLength(1)
    expect(screen.getByRole('link', { name: 'asha@example.com' })).toHaveAttribute('href', 'mailto:asha@example.com')
  })

  it('shows no email line when none is served', async () => {
    serveOrder({ ...ORDER, consumerId: 'c-1', consumerName: 'Asha', consumerEmail: null })
    render(<OrderDetailPage />, '/orders/o-5', '/orders/:id')
    await screen.findByText('Asha')
    expect(screen.queryByRole('link', { name: /@/ })).not.toBeInTheDocument()
  })
})

describe('shipping settings', () => {
  it('disables only an unconfigured provider, lets Proship be chosen with a note, and warns of a missing contact', async () => {
    serve([...ALL, 'shipping.settings'])
    render(<ShippingSettingsPage />, '/shipping/settings', '/shipping/settings')

    const other = await screen.findByLabelText(/Other courier/)
    expect(other).toBeDisabled()
    expect(screen.getByText(/Not configured: its credentials are not set/)).toBeInTheDocument()
    expect(screen.getByLabelText(/^Proship/)).toBeEnabled()
    expect(screen.getByTestId('proship-note')).toHaveTextContent(
      'Proship is proven on the development account. Before making it the default on the live account, confirm courier rules and the pickup location with Prozo.'
    )
    expect(screen.queryByText(/Not proven live yet/)).not.toBeInTheDocument()
    expect(screen.getByLabelText(/^Manual/)).toBeChecked()
    // Automatic booking never uses Manual
    expect(screen.getByRole('switch')).toBeDisabled()

    // choosing Proship frees the automatic-booking switch; choosing Manual again locks it
    const user = userEvent.setup()
    await user.click(screen.getByLabelText(/^Proship/))
    expect(screen.getByRole('switch')).toBeEnabled()
    await user.click(screen.getByLabelText(/^Manual/))
    expect(screen.getByRole('switch')).toBeDisabled()

    const warning = await screen.findByTestId('pickup-contact-warning')
    expect(warning).toHaveTextContent('Verify Warehouse has no contact email.')
    expect(warning).toHaveTextContent('a Manual booking does not need them')
    expect(within(warning).getByRole('link')).toHaveAttribute('href', '/inventory/warehouses/w-1')
    expect(screen.getByText(/needed for courier bookings, not for Manual ones/)).toBeInTheDocument()
    // the warning came with the settings: the warehouse itself was never read
    expect(calls.some((c) => c.url.pathname === '/api/admin/warehouses/w-1')).toBe(false)
  })

  it('works without warehouse.read, and names every missing contact from missingContact', async () => {
    serve(['shipping.read', 'shipping.settings'], (call) =>
      call.url.pathname === '/api/admin/shipping/settings'
        ? json(200, { ...SETTINGS, pickupWarehouse: { ...SETTINGS.pickupWarehouse, missingContact: ['NAME', 'PHONE', 'EMAIL'] } })
        : undefined
    )
    render(<ShippingSettingsPage />, '/shipping/settings', '/shipping/settings')
    const warning = await screen.findByTestId('pickup-contact-warning')
    expect(warning).toHaveTextContent('no contact name, contact phone and contact email')
  })

  it('shows the server sentence from Test connection', async () => {
    const user = userEvent.setup()
    serve([...ALL, 'shipping.settings'], (call) =>
      call.url.pathname === '/api/admin/shipping/providers/PROSHIP/test'
        ? json(200, { code: 'PROSHIP', ok: true, sentence: 'Proship accepted the credentials.' })
        : undefined
    )
    render(<ShippingSettingsPage />, '/shipping/settings', '/shipping/settings')
    const buttons = await screen.findAllByRole('button', { name: 'Test connection' })
    await user.click(buttons[0])
    expect(await screen.findByText('Proship accepted the credentials.')).toBeInTheDocument()
  })

  it('shows no warning once the settings say nothing is missing', async () => {
    serve([...ALL, 'shipping.settings'], (call) =>
      call.url.pathname === '/api/admin/shipping/settings'
        ? json(200, { ...SETTINGS, pickupWarehouse: { ...SETTINGS.pickupWarehouse, contactEmail: 'dispatch@habbit.local', missingContact: [] } })
        : undefined
    )
    render(<ShippingSettingsPage />, '/shipping/settings', '/shipping/settings')
    await screen.findByLabelText('Pickup warehouse')
    expect(screen.queryByTestId('pickup-contact-warning')).not.toBeInTheDocument()
  })
})

describe('the warehouse form', () => {
  it('checks the contact email and sends the three contacts on an edit', async () => {
    const user = userEvent.setup()
    serve(ALL, (call) => (call.method === 'PUT' ? json(200, { ...WAREHOUSE, contactEmail: 'dispatch@habbit.local' }) : undefined))
    rtlRender(
      <QueryClientProvider client={new QueryClient()}>
        <WarehouseFormDialog open onOpenChange={() => {}} warehouse={WAREHOUSE as never} />
      </QueryClientProvider>
    )
    const email = screen.getByLabelText('Contact email')
    await user.type(email, 'not-an-email')
    expect(screen.getByText(/Enter an email address/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled()

    await user.clear(email)
    await user.type(email, 'dispatch@habbit.local')
    await user.click(screen.getByRole('button', { name: 'Save' }))

    await waitFor(() => expect(calls.some((c) => c.method === 'PUT')).toBe(true))
    const put = calls.find((c) => c.method === 'PUT')!
    expect(put.body).toMatchObject({
      contactName: 'Habbit Dispatch',
      contactPhone: '+919999999999',
      contactEmail: 'dispatch@habbit.local',
      version: 4,
    })
    expect(screen.getByText(/cannot be booked from a warehouse missing any of/)).toBeInTheDocument()
  })
})

describe('the booking preview destination', () => {
  it('says the city and state will be looked up when both are null, and never reads blank', async () => {
    const user = userEvent.setup()
    serve(ALL, (call) =>
      call.url.pathname === '/api/admin/shipments/preview'
        ? json(200, {
            bookable: 1,
            results: [
              {
                orderId: 'o-5',
                orderNumber: 'HBT_10000005',
                bookable: true,
                providerCode: 'PROSHIP',
                pickupWarehouse: { id: 'w-1', code: 'VERIFY', name: 'Verify Warehouse' },
                deliveryPincode: '110009',
                deliveryCity: null,
                deliveryState: null,
              },
            ],
          })
        : undefined
    )
    render(<OrdersPage />, '/orders', '/orders')
    await waitFor(() => expect(screen.getByLabelText('Select HBT_10000005')).toBeInTheDocument())
    await user.click(screen.getByLabelText('Select HBT_10000005'))
    await user.click(screen.getByRole('button', { name: 'Book shipments' }))
    const dialog = await screen.findByRole('dialog')
    expect(await within(dialog).findByTestId('preview-destination-HBT_10000005')).toHaveTextContent(
      'Deliver to 110009 · City and state will be looked up at booking'
    )
  })
})
