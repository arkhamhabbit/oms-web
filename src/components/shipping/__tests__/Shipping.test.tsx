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
  missingContacts,
  SELECTION_CAP,
  SELECTION_CAP_HINT,
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
    labelPrinted: false,
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
      return json(200, { shippingFeeMinor: 4900, paymentTimeoutMinutes: 15, cancelUntil: 'PACKED' })
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
  })

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
      expect(list.url.searchParams.get('status')).toBe('CONFIRMED')
    })
  })
})

describe('booking from the list', () => {
  it('books with Manual (carrier and tracking per row) and lists each order booked or refused', async () => {
    const user = userEvent.setup()
    serve(ALL, (call) => {
      if (call.url.pathname === '/api/admin/shipments/book') {
        return json(200, {
          booked: 1,
          refused: 1,
          results: [
            { orderId: 'o-5', orderNumber: 'HBT_10000005', outcome: 'BOOKED', shipmentId: 's-5' },
            { orderId: 'o-6', orderNumber: 'HBT_10000006', outcome: 'REFUSED', sentence: 'HBT_10000006 is not paid.' },
          ],
        })
      }
      if (call.url.pathname === '/api/admin/shipments/s-5') {
        return json(200, { shipment: { id: 's-5', courierName: 'Hand delivery', awb: 'W-1' } })
      }
      return undefined
    }, [summary(5), summary(6)])
    render(<OrdersPage />, '/orders', '/orders')

    await waitFor(() => expect(screen.getByLabelText('Select HBT_10000006')).toBeInTheDocument())
    await user.click(screen.getByLabelText('Select HBT_10000005'))
    await user.click(screen.getByLabelText('Select HBT_10000006'))
    await user.click(screen.getByRole('button', { name: 'Book shipments' }))

    const dialog = await screen.findByRole('dialog')
    await waitFor(() => expect(within(dialog).getByTestId('booking-provider')).toHaveTextContent('Manual (the default)'))
    const book = within(dialog).getByRole('button', { name: 'Book 2' })
    expect(book).toBeDisabled() // Manual needs carrier and tracking on every row
    for (const n of ['HBT_10000005', 'HBT_10000006']) {
      await user.type(within(dialog).getByLabelText(`Carrier for ${n}`), 'Hand delivery')
      await user.type(within(dialog).getByLabelText(`Tracking reference for ${n}`), `T-${n}`)
    }
    await user.click(book)

    const results = await screen.findByRole('table', { name: 'Booking results' })
    const booked = within(results).getAllByRole('row').find((r) => r.getAttribute('data-outcome') === 'BOOKED')!
    await waitFor(() => expect(booked).toHaveTextContent('W-1'))
    expect(booked).toHaveTextContent('Hand delivery')
    const refused = within(results).getAllByRole('row').find((r) => r.getAttribute('data-outcome') === 'REFUSED')!
    expect(refused).toHaveTextContent('Refused')
    expect(refused).toHaveTextContent('HBT_10000006 is not paid.')

    const post = calls.find((c) => c.url.pathname === '/api/admin/shipments/book')!
    expect(post.headers.get('Idempotency-Key')).toBeTruthy()
    expect(post.body).toEqual({
      orders: [
        { orderId: 'o-5', carrier: 'Hand delivery', trackingReference: 'T-HBT_10000005' },
        { orderId: 'o-6', carrier: 'Hand delivery', trackingReference: 'T-HBT_10000006' },
      ],
    })
    // the selection cleared after the action
    expect(screen.queryByRole('region', { name: 'Selection' })).not.toBeInTheDocument()

  }, 15000) // types into four fields: slow under a full parallel run

  it('prints nothing when the server refuses one label, and shows its sentence', async () => {
    const user = userEvent.setup()
    serve(ALL, (call) => {
      if (call.url.pathname === '/api/admin/shipments') {
        return json(200, { content: [{ id: 's-5', orderNumber: 'HBT_10000005', status: 'BOOKED', direction: 'FORWARD', providerCode: 'MANUAL' }], totalElements: 1, totalPages: 1 })
      }
      if (call.url.pathname === '/api/admin/shipments/labels') {
        return refusal(422, 'BUSINESS_RULE_VIOLATION', 'HBT_10000005 has no provider label: it was booked by hand.')
      }
      return undefined
    }, [summary(5, { status: 'PACKED', shipmentState: 'BOOKED' })])
    render(<OrdersPage />, '/orders', '/orders')

    await waitFor(() => expect(screen.getByLabelText('Select HBT_10000005')).toBeInTheDocument())
    await user.click(screen.getByLabelText('Select HBT_10000005'))
    await user.click(screen.getByRole('button', { name: 'Print labels' }))

    const alert = await screen.findByText('HBT_10000005 has no provider label: it was booked by hand.')
    expect(alert.closest('[role="dialog"]')).toHaveTextContent('Labels not printed')
    expect(tab.close).toHaveBeenCalled()
    expect(tab.location.href).toBe('')
    const print = calls.find((c) => c.url.pathname === '/api/admin/shipments/labels')!
    expect(print.body).toEqual({ shipmentIds: ['s-5'] })
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
    bookedBy: 'u-1',
    weightGrams: 500,
    lengthMm: 200,
    widthMm: 150,
    heightMm: 100,
    events: [
      { id: 'ev1', eventAt: '2026-11-18T10:00:00Z', providerStatusCode: 'BOOKED', status: 'BOOKED', source: 'ADMIN' },
      { id: 'ev2', eventAt: '2026-11-18T12:00:00Z', providerStatusCode: '6', status: 'IN_TRANSIT', location: 'Delhi hub', source: 'POLL' },
    ],
    calls: [],
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
    events: [{ id: 'e1', kind: 'STATUS', fromStatus: 'CONFIRMED', toStatus: 'PACKED', actorName: 'Super Admin', occurredAt: BOOKED_AT }],
  }

  it('Manual booked: the hand steps stay, with the timeline newest first, booked by and the history', async () => {
    serveOrder(packed, ALL, detail('MANUAL'))
    render(<OrderDetailPage />, '/orders/o-5', '/orders/:id')

    expect(await screen.findAllByRole('button', { name: 'Ship' })).not.toHaveLength(0)
    expect(screen.getAllByText('Booked, awaiting pickup').length).toBeGreaterThan(0)
    const events = within(await screen.findByRole('list', { name: 'Tracking events' })).getAllByRole('listitem')
    expect(events[0]).toHaveTextContent('In transit · Delhi hub')
    expect(events[1]).toHaveTextContent('Booked')
    expect(await screen.findByText(/Super Admin/)).toBeInTheDocument()
    expect(screen.getByText('500 g, 200 × 150 × 100 mm')).toBeInTheDocument()
    expect(screen.getByText('Previous shipments (1)')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Refresh tracking' })).not.toBeInTheDocument()
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

describe('shipping settings', () => {
  it('disables an unconfigured provider with why, keeps Proship off the default, and warns of a missing contact', async () => {
    serve([...ALL, 'shipping.settings'])
    render(<ShippingSettingsPage />, '/shipping/settings', '/shipping/settings')

    const other = await screen.findByLabelText(/Other courier/)
    expect(other).toBeDisabled()
    expect(screen.getByText(/Not configured: its credentials are not set/)).toBeInTheDocument()
    expect(screen.getByLabelText(/^Proship/)).toBeDisabled()
    expect(screen.getByText(/Not proven live yet/)).toBeInTheDocument()
    expect(screen.getByLabelText(/^Manual/)).toBeChecked()
    // Automatic booking never uses Manual
    expect(screen.getByRole('switch')).toBeDisabled()

    const warning = await screen.findByTestId('pickup-contact-warning')
    expect(warning).toHaveTextContent('Verify Warehouse has no contact email.')
    expect(within(warning).getByRole('link')).toHaveAttribute('href', '/inventory/warehouses/w-1')
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

  it('names nothing missing once all three contacts are there', () => {
    expect(missingContacts({ ...WAREHOUSE, contactEmail: 'dispatch@habbit.local' })).toEqual([])
    expect(missingContacts({ contactName: ' ' })).toEqual(['contact name', 'contact phone', 'contact email'])
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
