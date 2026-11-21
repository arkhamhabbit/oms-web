import { calls, json, refusal, resetFetch, respondWith } from '@/test/fake-fetch'
import { installRadixPolyfills } from '@/test/polyfills'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render as rtlRender, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { OrderDetail, PaymentLink } from '@/api/orders'
import { BreadcrumbProvider } from '@/layouts/breadcrumb-context'
import {
  canIssueLink,
  canMarkPaid,
  canRecordRefund,
  countdown,
  manualRefundLeftMinor,
  markPaidProblems,
  paymentReference,
  refundGate,
} from '@/lib/orders'
import OrderDetailPage from '@/pages/OrderDetailPage'
import OrdersPage from '@/pages/OrdersPage'

installRadixPolyfills()

const FUTURE = new Date(Date.now() + 5 * 3_600_000 + 30_000).toISOString()

const LIVE: PaymentLink = {
  id: 'l-2',
  status: 'ISSUED',
  shortUrl: 'https://rzp.io/rzp/AbC123',
  expiresAt: FUTURE,
  issuedAt: '2026-11-21T08:00:00Z',
  issuedByName: 'Super Admin',
  notifyCustomer: false,
  amountMinor: 84800,
}
const OLD: PaymentLink = {
  id: 'l-1',
  status: 'CANCELLED',
  shortUrl: 'https://rzp.io/rzp/OLD111',
  expiresAt: '2026-11-21T07:00:00Z',
  cancelledAt: '2026-11-21T07:30:00Z',
  issuedAt: '2026-11-21T06:00:00Z',
  notifyCustomer: true,
}

const TYPED_ADDRESS = {
  addressId: null,
  label: 'Office',
  line1: '2 Test Street',
  landmark: 'Mukherjee Nagar',
  pincode: '110009',
  deliveryMobile: '+919999900001',
}

const PENDING: OrderDetail = {
  id: 'o-2',
  number: 'HBT_10000030',
  status: 'PENDING_PAYMENT',
  source: 'ADMIN',
  createdBy: { id: 'a-1', kind: 'ADMIN', displayName: 'Super Admin' },
  version: 3,
  payableMinor: 84800,
  consumerId: 'c-1',
  consumerName: 'Asha Rao',
  consumerMobile: '+919999900001',
  address: TYPED_ADDRESS,
  paymentLinks: [LIVE, OLD],
  refundState: 'NONE',
}

const MANUAL_PAID: OrderDetail = {
  ...PENDING,
  status: 'CONFIRMED',
  paymentLinks: [{ ...LIVE, status: 'CANCELLED', cancelledAt: '2026-11-21T09:00:00Z' }],
  payment: {
    id: 'pay-1',
    gateway: 'MANUAL',
    status: 'CAPTURED',
    role: 'PRIMARY',
    method: 'UPI',
    amountMinor: 84800,
    manualReference: 'W310-UPI-0001',
    recordedByName: 'Super Admin',
    recordedAt: '2026-11-21T09:00:00Z',
    receivedAt: '2026-11-21T08:59:00Z',
  },
  refunds: [],
}

const EXCESS_ORDER: OrderDetail = {
  ...PENDING,
  status: 'CONFIRMED',
  paymentLinks: [{ ...LIVE, status: 'PAID' }],
  refundState: 'OWED',
  payment: { id: 'pay-1', gateway: 'RAZORPAY', status: 'CAPTURED', role: 'PRIMARY', amountMinor: 84800, gatewayPaymentId: 'pay_MAIN', gatewayStatus: 'CAPTURED' },
  excessPayments: [
    {
      id: 'x-1',
      gateway: 'RAZORPAY',
      status: 'REFUND_PENDING',
      role: 'EXCESS',
      method: 'UPI',
      amountMinor: 84800,
      gatewayPaymentId: 'pay_EXCESS',
    },
  ],
  refunds: [],
}

function profile(permissions: string[]) {
  return json(200, { id: 'u', email: 'a@b.c', name: 'A', permissions, roles: [], version: 1 })
}

function renderOrder(order: OrderDetail, permissions: string[]) {
  respondWith((call) => {
    if (call.url.pathname === '/api/admin/profile') {
      return profile(permissions)
    }
    if (call.url.pathname === '/api/admin/orders') {
      return json(200, { content: [], totalElements: 2, totalPages: 1 })
    }
    return json(200, order)
  })
  return rtlRender(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MemoryRouter initialEntries={['/orders/o-2']}>
        <BreadcrumbProvider>
          <Routes>
            <Route path="/orders/:id" element={<OrderDetailPage />} />
          </Routes>
        </BreadcrumbProvider>
      </MemoryRouter>
    </QueryClientProvider>
  )
}

const posts = () => calls.filter((c) => c.method === 'POST')
const ALL = ['orders.read', 'orders.write', 'orders.create', 'orders.mark_paid', 'orders.refund']

beforeEach(() => {
  resetFetch()
})
afterEach(() => {
  vi.useRealTimers()
})

describe('lib', () => {
  it('words a countdown to a link’s expiry', () => {
    const now = Date.parse('2026-11-21T10:00:00Z')
    expect(countdown('2026-11-22T09:18:00Z', now)).toBe('23 h 18 min')
    expect(countdown('2026-11-21T10:12:00Z', now)).toBe('12 min')
    expect(countdown('2026-11-21T09:59:00Z', now)).toBe('Expired')
    expect(countdown(undefined, now)).toBe('—')
  })

  it('offers a new link and Mark as paid only for a team order still awaiting payment', () => {
    expect(canIssueLink({ ...PENDING, paymentLinks: [OLD] })).toBe(true)
    expect(canIssueLink(PENDING)).toBe(false) // a link is live
    expect(canIssueLink({ ...PENDING, source: 'APP', paymentLinks: [] })).toBe(false)
    expect(canIssueLink({ ...PENDING, status: 'CONFIRMED', paymentLinks: [] })).toBe(false)
    expect(canMarkPaid(PENDING)).toBe(true)
    expect(canMarkPaid({ ...PENDING, source: 'APP' })).toBe(false)
    expect(canMarkPaid(MANUAL_PAID)).toBe(false)
  })

  it('caps a manual refund at what was paid less what was already recorded', () => {
    expect(manualRefundLeftMinor(MANUAL_PAID)).toBe(84800)
    const part = {
      ...MANUAL_PAID,
      refunds: [{ id: 'r', method: 'MANUAL' as const, outcome: 'SETTLED' as const, amountMinor: 30000 }],
    }
    expect(manualRefundLeftMinor(part)).toBe(54800)
    expect(canRecordRefund(part)).toBe(true)
    const all = { ...part, refunds: [{ ...part.refunds[0], amountMinor: 84800 }] }
    expect(canRecordRefund(all)).toBe(false)
    expect(canRecordRefund({ ...MANUAL_PAID, payment: { ...MANUAL_PAID.payment, gateway: 'RAZORPAY' } })).toBe(false)
  })

  it('shows a manual payment’s reference where a gateway payment id would be', () => {
    expect(paymentReference(MANUAL_PAID.payment)).toBe('W310-UPI-0001')
    expect(paymentReference({ gateway: 'RAZORPAY', gatewayPaymentId: 'pay_X' })).toBe('pay_X')
  })

  it('validates a manual payment before asking', () => {
    const now = Date.parse('2026-11-21T10:00:00Z')
    expect(markPaidProblems({ reference: '', amount: 'abc', receivedAt: '', now })).toEqual({
      reference: 'Enter the reference of the payment.',
      amount: 'Enter the amount received in rupees, up to two decimals.',
      receivedAt: 'Enter when the payment was received.',
    })
    expect(
      markPaidProblems({ reference: 'R1', amount: '848.00', receivedAt: '2026-11-21T10:30:00Z', now })
        .receivedAt
    ).toMatch(/future/)
    expect(markPaidProblems({ reference: 'R1', amount: '848', receivedAt: '2026-11-21T09:00:00Z', now })).toEqual({})
  })

  it('leaves the owed refund of an excess payment to its own row, and Razorpay off for a manual payment', () => {
    const gate = refundGate(EXCESS_ORDER)
    expect(gate.excessOnly).toBe(true)
    expect(gate.canSettle).toBe(false)
    const manualOwed = { ...MANUAL_PAID, refundState: 'OWED' as const, payment: { ...MANUAL_PAID.payment, status: 'REFUND_PENDING' as const } }
    expect(refundGate(manualOwed).canGateway).toBe(false)
    expect(refundGate(manualOwed).gatewayReason).toMatch(/Record the refund/)
  })
})

describe('placed by the team', () => {
  it('tags the order with who placed it and shows a typed address with no book link', async () => {
    renderOrder(PENDING, ALL)
    expect(await screen.findByTestId('placed-by-team')).toHaveTextContent('Placed by the team · Super Admin')
    expect(screen.getByText('2 Test Street')).toBeInTheDocument()
    expect(screen.getByText(/Typed for this order; not in the member’s address book/)).toBeInTheDocument()
  })

  it('does not tag an app order', async () => {
    renderOrder({ ...PENDING, source: 'APP', paymentLinks: [] }, ALL)
    await screen.findByText('HBT_10000030')
    expect(screen.queryByTestId('placed-by-team')).not.toBeInTheDocument()
    expect(screen.queryByText('Payment link')).not.toBeInTheDocument()
  })
})

describe('payment link panel', () => {
  it('shows the live link with Copy, status, a countdown, whether it was texted, and earlier links collapsed', async () => {
    renderOrder(PENDING, ALL)
    const panel = (await screen.findByText('Payment link')).closest('[id="payment-link"]') as HTMLElement
    expect(within(panel).getByText('https://rzp.io/rzp/AbC123')).toBeInTheDocument()
    expect(within(panel).getByRole('button', { name: 'Copy payment link' })).toBeInTheDocument()
    expect(within(panel).getByText('Live')).toBeInTheDocument()
    expect(within(panel).getByTestId('link-countdown')).toHaveTextContent(/^5 h \d+ min$/)
    expect(within(panel).getByText('No — shared by the team')).toBeInTheDocument()
    const earlier = within(panel).getByText(/Earlier links \(1\)/).closest('details') as HTMLDetailsElement
    expect(earlier.open).toBe(false)
    // A live link leaves no room for a second one.
    expect(within(panel).queryByRole('button', { name: 'Issue new link' })).not.toBeInTheDocument()
  })

  it('shows a cancel that failed at the gateway, and one still pending', async () => {
    renderOrder(
      {
        ...PENDING,
        paymentLinks: [
          { ...LIVE, cancelRequestedAt: '2026-11-21T09:00:00Z', lastCancelError: 'Razorpay refused the cancel.' },
        ],
      },
      ALL
    )
    expect(await screen.findByText(/Cancelling this link at Razorpay failed: Razorpay refused the cancel\./)).toBeInTheDocument()
  })

  it('shows a cancel at the gateway that is still waiting', async () => {
    renderOrder({ ...PENDING, paymentLinks: [{ ...LIVE, cancelRequestedAt: '2026-11-21T09:00:00Z' }] }, ALL)
    expect(await screen.findByText(/Cancelling at Razorpay requested/)).toBeInTheDocument()
  })

  it('offers Issue new link when none is live, and sends the version and a key', async () => {
    const user = userEvent.setup()
    renderOrder({ ...PENDING, paymentLinks: [OLD] }, ALL)
    expect(await screen.findByText(/No payment link is live/)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Issue new link' }))
    await waitFor(() => expect(posts()).toHaveLength(1))
    expect(posts()[0].url.pathname).toBe('/api/admin/orders/o-2/payment-link')
    expect(posts()[0].body).toEqual({ version: 3, notifyCustomer: false })
    expect(posts()[0].headers.get('Idempotency-Key')).toMatch(/^[0-9a-f-]{36}$/)
  })

  it('shows the server’s sentence when a new link cannot be issued', async () => {
    const user = userEvent.setup()
    renderOrder({ ...PENDING, paymentLinks: [OLD] }, ALL)
    const original = calls.length
    respondWith((call) => {
      if (call.url.pathname === '/api/admin/profile') {
        return profile(ALL)
      }
      if (call.method === 'POST') {
        return refusal(422, 'BUSINESS_RULE_VIOLATION', 'There is not enough stock left to hold this order again.')
      }
      return json(200, { ...PENDING, paymentLinks: [OLD] })
    })
    void original
    await user.click(await screen.findByRole('button', { name: 'Issue new link' }))
    expect(
      await screen.findByText('There is not enough stock left to hold this order again.')
    ).toBeInTheDocument()
  })

  it('keeps a paid, expired or cancelled link visible after the order is confirmed', async () => {
    renderOrder(MANUAL_PAID, ALL)
    const panel = (await screen.findByText('Payment link')).closest('[id="payment-link"]') as HTMLElement
    expect(within(panel).getByText('Cancelled')).toBeInTheDocument()
    expect(within(panel).queryByRole('button', { name: 'Mark as paid' })).not.toBeInTheDocument()
  })

  it('reads the order again every 15 seconds while it awaits payment', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    renderOrder(PENDING, ALL)
    await screen.findByText('Payment link')
    const reads = () => calls.filter((c) => c.method === 'GET' && c.url.pathname === '/api/admin/orders/o-2').length
    const before = reads()
    await vi.advanceTimersByTimeAsync(15_500)
    await waitFor(() => expect(reads()).toBeGreaterThan(before))
  })
})

describe('Mark as paid', () => {
  it('is hidden without orders.mark_paid', async () => {
    renderOrder(PENDING, ['orders.read', 'orders.create'])
    await screen.findByText('Payment link')
    expect(screen.queryByRole('button', { name: 'Mark as paid' })).not.toBeInTheDocument()
  })

  it('opens with the payable, states what it does, and will not send without a reference', async () => {
    const user = userEvent.setup()
    renderOrder(PENDING, ALL)
    await user.click(await screen.findByRole('button', { name: 'Mark as paid' }))
    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByLabelText('Amount received (₹)')).toHaveValue('848.00')
    expect(dialog).toHaveTextContent(
      'This confirms the order without a gateway payment. It will be refunded outside Razorpay.'
    )
    await user.click(within(dialog).getByRole('button', { name: 'Mark as paid' }))
    expect(within(dialog).getByText('Enter the reference of the payment.')).toBeInTheDocument()
    expect(posts()).toHaveLength(0)
  })

  it('sends the method, reference, exact amount, received time and note, and the idempotency key', async () => {
    const user = userEvent.setup()
    renderOrder(PENDING, ALL)
    await user.click(await screen.findByRole('button', { name: 'Mark as paid' }))
    const dialog = await screen.findByRole('dialog')
    await user.click(within(dialog).getByRole('combobox', { name: 'How it was paid' }))
    await user.click(await screen.findByRole('option', { name: 'Bank transfer' }))
    await user.type(within(dialog).getByLabelText('Reference'), 'W310-NEFT-9')
    await user.type(within(dialog).getByLabelText('Note (optional)'), 'cheque cleared')
    await user.click(within(dialog).getByRole('button', { name: 'Mark as paid' }))

    await waitFor(() => expect(posts()).toHaveLength(1))
    const call = posts()[0]
    expect(call.url.pathname).toBe('/api/admin/orders/o-2/mark-paid')
    expect(call.headers.get('Idempotency-Key')).toMatch(/^[0-9a-f-]{36}$/)
    expect(call.body).toMatchObject({
      version: 3,
      method: 'BANK_TRANSFER',
      reference: 'W310-NEFT-9',
      amountMinor: 84800,
      note: 'cheque cleared',
    })
    expect(Date.parse((call.body as { receivedAt: string }).receivedAt)).toBeLessThanOrEqual(Date.now())
  })

  it('shows the server’s sentence when the amount does not match, beside the amount', async () => {
    const user = userEvent.setup()
    renderOrder(PENDING, ALL)
    await user.click(await screen.findByRole('button', { name: 'Mark as paid' }))
    const dialog = await screen.findByRole('dialog')
    respondWith((call) => {
      if (call.url.pathname === '/api/admin/profile') {
        return profile(ALL)
      }
      if (call.method === 'POST') {
        return refusal(422, 'VALIDATION_FAILED', 'Validation failed', [
          { field: 'amountMinor', message: 'The amount must equal the payable, ₹848.00.' },
        ] as never)
      }
      return json(200, PENDING)
    })
    await user.type(within(dialog).getByLabelText('Reference'), 'R-1')
    await user.clear(within(dialog).getByLabelText('Amount received (₹)'))
    await user.type(within(dialog).getByLabelText('Amount received (₹)'), '800')
    await user.click(within(dialog).getByRole('button', { name: 'Mark as paid' }))
    expect(await within(dialog).findByText('The amount must equal the payable, ₹848.00.')).toBeInTheDocument()
  })
})

describe('Record refund', () => {
  it('replaces Refund via Razorpay on a manually paid order, with the reference shown for the payment', async () => {
    renderOrder(MANUAL_PAID, ALL)
    expect(await screen.findByRole('button', { name: 'Record refund' })).toBeEnabled()
    expect(screen.queryByRole('button', { name: 'Refund via Razorpay' })).not.toBeInTheDocument()
    expect(screen.getByText('W310-UPI-0001')).toBeInTheDocument()
    expect(screen.queryByText('Gateway payment id')).not.toBeInTheDocument()
  })

  it('needs orders.refund', async () => {
    renderOrder(MANUAL_PAID, ['orders.read'])
    const button = await screen.findByRole('button', { name: 'Record refund' })
    expect(button).toBeDisabled()
    expect(button).toHaveAttribute('title', 'Needs orders.refund')
  })

  it('checks the reference and caps the amount at what is left before asking, and can be cancelled without sending', async () => {
    const user = userEvent.setup()
    renderOrder(MANUAL_PAID, ALL)
    await user.click(await screen.findByRole('button', { name: 'Record refund' }))
    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByTestId('refund-left')).toHaveTextContent('₹848.00')

    await user.click(within(dialog).getByRole('button', { name: 'Record refund' }))
    expect(within(dialog).getByText('Enter the reference of the payment back.')).toBeInTheDocument()

    await user.type(within(dialog).getByLabelText('Reference'), 'R-1')
    const amount = within(dialog).getByLabelText('Amount (₹)')
    await user.clear(amount)
    await user.type(amount, '900')
    await user.click(within(dialog).getByRole('button', { name: 'Record refund' }))
    expect(within(dialog).getByText(/The most that can be recorded is ₹848\.00/)).toBeInTheDocument()
    await user.clear(amount)
    await user.type(amount, '0')
    await user.click(within(dialog).getByRole('button', { name: 'Record refund' }))
    expect(within(dialog).getByText('The amount must be more than zero.')).toBeInTheDocument()
    expect(posts()).toHaveLength(0)

    await user.click(within(dialog).getByRole('button', { name: 'Cancel' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(posts()).toHaveLength(0)
  })

  it('records a part refund with its reference, amount and key', async () => {
    const user = userEvent.setup()
    renderOrder(MANUAL_PAID, ALL)
    await user.click(await screen.findByRole('button', { name: 'Record refund' }))
    const dialog = await screen.findByRole('dialog')
    await user.type(within(dialog).getByLabelText('Reference'), 'R-77')
    const amount = within(dialog).getByLabelText('Amount (₹)')
    await user.clear(amount)
    await user.type(amount, '100.50')
    await user.click(within(dialog).getByRole('button', { name: 'Record refund' }))
    await waitFor(() => expect(posts()).toHaveLength(1))
    expect(posts()[0].url.pathname).toBe('/api/admin/orders/o-2/refund/manual')
    expect(posts()[0].body).toEqual({ version: 3, reference: 'R-77', amountMinor: 10050 })
    expect(posts()[0].headers.get('Idempotency-Key')).toMatch(/^[0-9a-f-]{36}$/)
  })
})

describe('excess payment', () => {
  it('is its own row tagged as owed, with Refund via Razorpay acting on that payment', async () => {
    const user = userEvent.setup()
    renderOrder(EXCESS_ORDER, ALL)
    const rows = await screen.findByTestId('excess-payments')
    expect(within(rows).getByText('Excess — refund owed')).toBeInTheDocument()
    expect(within(rows).getByText('pay_EXCESS')).toBeInTheDocument()
    // The order's own payment is untouched and the refund panel says where to refund.
    expect(screen.getByText('pay_MAIN')).toBeInTheDocument()
    expect(screen.getByTestId('refund-headline')).toHaveTextContent('Refund owed ₹848.00')
    expect(screen.queryByRole('button', { name: 'Mark as refunded' })).not.toBeInTheDocument()

    await user.click(within(rows).getByRole('button', { name: 'Refund via Razorpay' }))
    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByTestId('refund-amount')).toHaveTextContent('₹848.00')
    await user.click(within(dialog).getByRole('button', { name: 'Refund via Razorpay' }))
    await waitFor(() => expect(posts()).toHaveLength(1))
    expect(posts()[0].url.pathname).toBe('/api/admin/orders/o-2/refund/gateway')
    expect(posts()[0].body).toEqual({ version: 3 })
  })
})

describe('orders list', () => {
  const rows = [
    {
      id: 'o-2',
      number: 'HBT_10000030',
      status: 'PENDING_PAYMENT',
      source: 'ADMIN',
      createdBy: { id: 'a-1', kind: 'ADMIN', displayName: 'Super Admin' },
      payableMinor: 84800,
      paymentMethod: 'BANK_TRANSFER',
    },
    { id: 'o-1', number: 'HBT_10000001', status: 'DELIVERED', source: 'APP', payableMinor: 50000 },
  ]

  function renderList(permissions: string[]) {
    respondWith((call) => {
      if (call.url.pathname === '/api/admin/profile') {
        return profile(permissions)
      }
      if (call.url.pathname === '/api/admin/orders') {
        return json(200, { content: rows, totalElements: 2, totalPages: 1 })
      }
      return json(200, {})
    })
    return rtlRender(
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <MemoryRouter initialEntries={['/orders']}>
          <BreadcrumbProvider>
            <Routes>
              <Route path="/orders" element={<OrdersPage />} />
              <Route path="/orders/new" element={<p>NEW ORDER PAGE</p>} />
            </Routes>
          </BreadcrumbProvider>
        </MemoryRouter>
      </QueryClientProvider>
    )
  }

  it('shows a Source column and the new payment methods by name', async () => {
    renderList(['orders.read'])
    await waitFor(() => expect(screen.getByText('HBT_10000030')).toBeInTheDocument())
    const row = screen.getByText('HBT_10000030').closest('tr') as HTMLElement
    expect(within(row).getByText('Placed by the team')).toBeInTheDocument()
    expect(within(row).getByText('Super Admin')).toBeInTheDocument()
    expect(within(row).getByText('Bank transfer')).toBeInTheDocument()
    const app = screen.getByText('HBT_10000001').closest('tr') as HTMLElement
    expect(within(app).getByText('App')).toBeInTheDocument()
  })

  it('filters by source', async () => {
    const user = userEvent.setup()
    renderList(['orders.read'])
    await screen.findByText('HBT_10000030')
    await user.click(screen.getByRole('combobox', { name: 'Source filter' }))
    await user.click(await screen.findByRole('option', { name: 'Placed by the team' }))
    await waitFor(() =>
      expect(
        calls.some(
          (c) =>
            c.url.pathname === '/api/admin/orders' &&
            c.url.searchParams.get('source') === 'ADMIN' &&
            c.url.searchParams.has('page')
        )
      ).toBe(true)
    )
  })

  it('shows New order only with orders.create', async () => {
    const { unmount } = renderList(['orders.read'])
    await screen.findByText('HBT_10000030')
    expect(screen.queryByRole('link', { name: /New order/ })).not.toBeInTheDocument()
    unmount()
    renderList(['orders.read', 'orders.create'])
    expect(await screen.findByRole('link', { name: /New order/ })).toHaveAttribute('href', '/orders/new')
  })
})
