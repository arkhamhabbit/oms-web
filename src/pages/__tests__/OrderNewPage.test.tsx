import { calls, json, refusal, resetFetch, respondWith, type RecordedCall } from '@/test/fake-fetch'
import { installRadixPolyfills } from '@/test/polyfills'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render as rtlRender, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it } from 'vitest'

import { BreadcrumbProvider } from '@/layouts/breadcrumb-context'
import OrderNewPage from '@/pages/OrderNewPage'

installRadixPolyfills()

const SLOW = { timeout: 4000 }

const ACTIVE = { id: 'm-1', name: 'Asha Rao', mobile: '+919999900001', status: 'ACTIVE' }
const WAITLIST = { id: 'm-2', name: 'Asha Waitlist', mobile: '+919999900002', status: 'INVITED' }
const SUSPENDED = { id: 'm-3', name: 'Asha Suspended', mobile: '+919999900003', status: 'SUSPENDED' }

const ADDRESSES = [
  {
    id: 'a-1',
    label: 'Delhi Test',
    line1: '12 Test Street',
    landmark: 'Mukherjee Nagar',
    pincode: '110009',
    deliveryMobile: '+919999900001',
    isDefault: true,
  },
]

function quote(over: Record<string, unknown> = {}) {
  return {
    memberId: 'm-1',
    tierCode: 'SPROUT',
    placeable: true,
    refusals: [],
    itemTotalMinor: 79900,
    shippingMinor: 4900,
    payableMinor: 84800,
    gstMinor: 3805,
    savingsMinor: 20000,
    freeShipping: false,
    earnPoints: 79,
    earnCarrotsMinor: 799,
    lines: [
      {
        variantId: 'v-1',
        productName: 'Test Public Tee',
        variantName: 'M',
        skuCode: 'TEE-M',
        quantity: 1,
        unitPriceMinor: 79900,
        unitMrpMinor: 99900,
        lineSavingMinor: 20000,
        lineTotalMinor: 79900,
        available: 6,
        inStock: true,
      },
    ],
    ...over,
  }
}

function quoteCalls() {
  return calls.filter((c) => c.method === 'POST' && c.url.pathname === '/api/admin/orders/quote')
}
function placeCalls() {
  return calls.filter((c) => c.method === 'POST' && c.url.pathname === '/api/admin/orders')
}

type Handler = (call: RecordedCall) => Response | Promise<Response> | undefined

function install(extra?: Handler, permissions = ['orders.read', 'orders.create']) {
  respondWith(async (call) => {
    const special = extra?.(call)
    if (special) {
      return special
    }
    const path = call.url.pathname
    if (path === '/api/admin/profile') {
      return json(200, { id: 'u', email: 'a@b.c', name: 'A', permissions, roles: [], version: 1 })
    }
    if (path === '/api/admin/users') {
      return json(200, { content: [ACTIVE, WAITLIST, SUSPENDED], totalElements: 3, totalPages: 1 })
    }
    if (path === '/api/admin/users/m-1/addresses') {
      return json(200, ADDRESSES)
    }
    if (path.startsWith('/api/admin/pincodes/')) {
      const pincode = path.split('/').pop()
      return pincode === '110009'
        ? json(200, { pincode, city: 'North West Delhi', state: 'Delhi' })
        : refusal(404, 'NOT_FOUND', 'That PIN code could not be resolved.')
    }
    if (path === '/api/admin/products') {
      return json(200, {
        content: [{ id: 'p-1', name: 'Test Public Tee', variantCount: 1 }],
        totalElements: 1,
        totalPages: 1,
      })
    }
    if (path === '/api/admin/products/p-1/variants') {
      return json(200, [{ id: 'v-1', name: 'M', skuCode: 'TEE-M', variantStatus: 'ACTIVE' }])
    }
    if (path === '/api/admin/orders/quote') {
      return json(200, quote())
    }
    return json(200, {})
  })
}

function renderPage() {
  return rtlRender(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MemoryRouter initialEntries={['/orders/new']}>
        <BreadcrumbProvider>
          <Routes>
            <Route path="/orders/new" element={<OrderNewPage />} />
            <Route path="/orders/:id" element={<p>ORDER PAGE</p>} />
          </Routes>
        </BreadcrumbProvider>
      </MemoryRouter>
    </QueryClientProvider>
  )
}

async function chooseMember(user: ReturnType<typeof userEvent.setup>) {
  await user.type(await screen.findByLabelText('Search members'), 'Asha')
  await user.click(await screen.findByRole('button', { name: 'Choose Asha Rao' }, SLOW))
}

async function addTee(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText('Search products'), 'Tee')
  await user.click(await screen.findByRole('button', { name: /Test Public Tee/ }, SLOW))
  await user.click(await screen.findByRole('button', { name: /Add Test Public Tee M TEE-M/ }))
}

async function chooseAddress(user: ReturnType<typeof userEvent.setup>) {
  await user.click(await screen.findByRole('radio', { name: /Delhi Test/ }))
}

beforeEach(() => {
  resetFetch()
})

describe('member chooser', () => {
  it('lists an invited and a suspended member disabled, with why, and lets an active one be chosen', async () => {
    install()
    const user = userEvent.setup()
    renderPage()

    await user.type(await screen.findByLabelText('Search members'), 'Asha')
    // No address is asked for until a member is chosen (a request for /users//addresses is a bug).
    expect(calls.some((c) => c.url.pathname.includes('//'))).toBe(false)
    const waitlist = await screen.findByRole('button', { name: 'Choose Asha Waitlist' }, SLOW)
    expect(waitlist).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Choose Asha Suspended' })).toBeDisabled()
    expect(screen.getByText(/Invited but not yet joined/)).toBeInTheDocument()
    expect(screen.getByText(/Suspended: an order cannot be placed/)).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Choose Asha Rao' }))
    expect(await screen.findByRole('button', { name: 'Change member' })).toBeInTheDocument()
  })
})

describe('basket and quote', () => {
  it('asks for the quote only once member, basket and delivery are all set, and sends no price', async () => {
    install()
    const user = userEvent.setup()
    renderPage()

    await chooseMember(user)
    await addTee(user)
    expect(quoteCalls()).toHaveLength(0)
    await chooseAddress(user)

    expect(await screen.findByText('₹848.00', {}, SLOW)).toBeInTheDocument()
    expect(quoteCalls()).toHaveLength(1)
    expect(quoteCalls()[0].body).toEqual({
      memberId: 'm-1',
      lines: [{ variantId: 'v-1', quantity: 1 }],
      addressId: 'a-1',
    })
    // The line shows what the server says about it; the quote shows the earns.
    expect(screen.getByTestId('line-quote')).toHaveTextContent('₹799.00 each')
    expect(screen.getByTestId('line-quote')).toHaveTextContent('MRP ₹999.00')
    expect(screen.getByTestId('line-quote')).toHaveTextContent('6 in stock')
    expect(screen.getByTestId('quote-earns')).toHaveTextContent('79 Bits')
    // No price, discount or shipping control anywhere on the page.
    expect(screen.queryByLabelText(/price|discount|shipping/i)).not.toBeInTheDocument()
    expect(screen.queryByRole('spinbutton')).not.toBeInTheDocument()
  })

  it('asks again when the basket changes, and a slow answer to the earlier basket is never shown', async () => {
    let releaseFirst: () => void = () => undefined
    const first = new Promise<void>((resolve) => (releaseFirst = resolve))
    install((call) => {
      if (call.url.pathname !== '/api/admin/orders/quote') {
        return undefined
      }
      const qty = (call.body as { lines: { quantity: number }[] }).lines[0].quantity
      if (qty === 1) {
        return first.then(() => json(200, quote({ payableMinor: 11100 })))
      }
      return json(200, quote({ payableMinor: 22200 }))
    })
    const user = userEvent.setup()
    renderPage()

    await chooseMember(user)
    await addTee(user)
    await chooseAddress(user)
    await waitFor(() => expect(quoteCalls()).toHaveLength(1), SLOW)

    await user.click(screen.getByRole('button', { name: 'More TEE-M' }))
    expect(await screen.findByText('₹222.00', {}, SLOW)).toBeInTheDocument()
    expect(quoteCalls()).toHaveLength(2)
    expect((quoteCalls()[1].body as { lines: { quantity: number }[] }).lines[0].quantity).toBe(2)

    releaseFirst()
    await new Promise((r) => setTimeout(r, 100))
    expect(screen.queryByText('₹111.00')).not.toBeInTheDocument()
    expect(screen.getByText('₹222.00')).toBeInTheDocument()
  })

  it('puts a refusal that names a line beside that line, and the rest in the quote; Place stays off', async () => {
    install((call) =>
      call.url.pathname === '/api/admin/orders/quote'
        ? json(
            200,
            quote({
              placeable: false,
              refusals: [
                'TEE-M has only 0 left in stock.',
                'This member’s delivery pincode is not served.',
              ],
              lines: [{ ...quote().lines[0], inStock: false, available: 0 }],
            })
          )
        : undefined
    )
    const user = userEvent.setup()
    renderPage()
    await chooseMember(user)
    await addTee(user)
    await chooseAddress(user)

    const line = await screen.findByTestId('basket-line-TEE-M', {}, SLOW)
    expect(await within(line).findByText('TEE-M has only 0 left in stock.')).toBeInTheDocument()
    expect(within(line).getByText('Out of stock')).toBeInTheDocument()
    const panel = screen.getByRole('region', { name: 'Quote' })
    expect(within(panel).getByText('This member’s delivery pincode is not served.')).toBeInTheDocument()
    expect(within(panel).queryByText('TEE-M has only 0 left in stock.')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Place order' })).toBeDisabled()
  })

  it('shows the server’s sentence when the quote itself is refused', async () => {
    install((call) =>
      call.url.pathname === '/api/admin/orders/quote'
        ? refusal(422, 'BUSINESS_RULE_VIOLATION', 'The member is not active.')
        : undefined
    )
    const user = userEvent.setup()
    renderPage()
    await chooseMember(user)
    await addTee(user)
    await chooseAddress(user)
    expect(await screen.findByText('The member is not active.', {}, SLOW)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Place order' })).toBeDisabled()
  })
})

describe('delivery', { timeout: 20000 }, () => {
  it('sends a typed address with the not-saved note and a normalised delivery mobile', async () => {
    install()
    const user = userEvent.setup()
    renderPage()
    await chooseMember(user)
    await addTee(user)

    await user.click(screen.getByRole('button', { name: 'Type an address' }))
    expect(
      screen.getByText("Used for this order only; not saved to the member's address book.")
    ).toBeInTheDocument()
    await user.type(screen.getByLabelText('Label'), 'Office')
    await user.type(screen.getByLabelText('Address line 1'), '2 Test Street')
    await user.type(screen.getByLabelText('Landmark'), 'Mukherjee Nagar')
    await user.type(screen.getByLabelText('Pincode'), '11000')
    expect(screen.getByText('A pincode is six digits.')).toBeInTheDocument()
    await user.type(screen.getByLabelText('Pincode'), '9')
    await user.type(screen.getByLabelText('Delivery mobile (optional)'), '98765 43210')

    await waitFor(() => expect(quoteCalls().length).toBeGreaterThan(0), SLOW)
    expect(quoteCalls().at(-1)?.body).toEqual({
      memberId: 'm-1',
      lines: [{ variantId: 'v-1', quantity: 1 }],
      deliveryMobile: '+919876543210',
      address: {
        label: 'Office',
        line1: '2 Test Street',
        landmark: 'Mukherjee Nagar',
        pincode: '110009',
        city: 'North West Delhi',
        state: 'Delhi',
      },
    })
  })

  async function startTyped(user: ReturnType<typeof userEvent.setup>) {
    await chooseMember(user)
    await addTee(user)
    await user.click(screen.getByRole('button', { name: 'Type an address' }))
    await user.type(screen.getByLabelText('Address line 1'), '2 Test Street')
  }

  it('prefills the city and state from the PIN code, still editable, and sends both', async () => {
    install()
    const user = userEvent.setup()
    renderPage()
    await startTyped(user)
    await user.type(screen.getByLabelText('Pincode'), '110009')

    await waitFor(() => expect(screen.getByLabelText('City')).toHaveValue('North West Delhi'), SLOW)
    expect(screen.getByLabelText('State')).toHaveValue('Delhi')
    expect(screen.queryByText('Enter the city and state')).not.toBeInTheDocument()
    expect(calls.some((c) => c.url.pathname === '/api/admin/pincodes/110009')).toBe(true)

    await user.clear(screen.getByLabelText('City'))
    await user.type(screen.getByLabelText('City'), 'Rohini')
    await waitFor(
      () => expect((quoteCalls().at(-1)?.body as { address: { city: string } }).address.city).toBe('Rohini'),
      SLOW
    )
    expect((quoteCalls().at(-1)?.body as { address: { state: string } }).address.state).toBe('Delhi')
  })

  it('a PIN code the directory does not have leaves city and state empty; nothing is quoted until both are typed', async () => {
    install()
    const user = userEvent.setup()
    renderPage()
    await startTyped(user)
    await user.type(screen.getByLabelText('Pincode'), '110009')
    await waitFor(() => expect(screen.getByLabelText('City')).toHaveValue('North West Delhi'), SLOW)
    await waitFor(() => expect(quoteCalls().length).toBeGreaterThan(0), SLOW)
    const before = quoteCalls().length

    await user.clear(screen.getByLabelText('Pincode'))
    await user.type(screen.getByLabelText('Pincode'), '560001')
    expect(await screen.findByText('Enter the city and state', {}, SLOW)).toBeInTheDocument()
    expect(screen.getByLabelText('City')).toHaveValue('')
    expect(screen.getByLabelText('State')).toHaveValue('')
    await new Promise((r) => setTimeout(r, 600))
    expect(quoteCalls()).toHaveLength(before)
    expect(screen.getByRole('button', { name: 'Place order' })).toBeDisabled()

    await user.type(screen.getByLabelText('City'), 'Bengaluru')
    await user.type(screen.getByLabelText('State'), 'Karnataka')
    await waitFor(() => expect(quoteCalls().length).toBeGreaterThan(before), SLOW)
    expect(quoteCalls().at(-1)?.body).toMatchObject({
      address: { pincode: '560001', city: 'Bengaluru', state: 'Karnataka' },
    })
  })

  it('a failed read leaves them empty too; clearing a prefilled value blocks the quote again', async () => {
    install((call) =>
      call.url.pathname === '/api/admin/pincodes/400069'
        ? refusal(500, 'INTERNAL_ERROR', 'The lookup is down.')
        : undefined
    )
    const user = userEvent.setup()
    renderPage()
    await startTyped(user)
    await user.type(screen.getByLabelText('Pincode'), '400069')
    expect(await screen.findByText('Enter the city and state', {}, SLOW)).toBeInTheDocument()
    expect(screen.getByLabelText('City')).toHaveValue('')

    await user.clear(screen.getByLabelText('Pincode'))
    await user.type(screen.getByLabelText('Pincode'), '110009')
    await waitFor(() => expect(screen.getByLabelText('State')).toHaveValue('Delhi'), SLOW)
    await waitFor(() => expect(quoteCalls().length).toBeGreaterThan(0), SLOW)
    const before = quoteCalls().length

    await user.clear(screen.getByLabelText('State'))
    expect(await screen.findByText('Enter the city and state')).toBeInTheDocument()
    await new Promise((r) => setTimeout(r, 600))
    expect(quoteCalls()).toHaveLength(before)
    expect(screen.getByRole('button', { name: 'Place order' })).toBeDisabled()
  })

  it('shows each member address with city and state, and says so when one has none', async () => {
    install((call) =>
      call.url.pathname === '/api/admin/users/m-1/addresses'
        ? json(200, [
            { ...ADDRESSES[0], city: 'North West Delhi', state: 'Delhi' },
            { id: 'a-2', label: 'Old flat', line1: '9 Old Road', pincode: '400069', deliveryMobile: '+919999900001' },
          ])
        : undefined
    )
    const user = userEvent.setup()
    renderPage()
    await chooseMember(user)
    const withPlace = (await screen.findByRole('radio', { name: /Delhi Test/ })).closest('label')
    expect(withPlace).toHaveTextContent('12 Test Street, Mukherjee Nagar, North West Delhi, Delhi 110009')
    expect(withPlace).not.toHaveTextContent('No city or state on this address')
    const without = screen.getByRole('radio', { name: /Old flat/ }).closest('label')
    expect(without).toHaveTextContent('9 Old Road 400069')
    expect(without).toHaveTextContent('No city or state on this address')
  })

  it('shows the link validity the quote carries', async () => {
    install((call) =>
      call.url.pathname === '/api/admin/orders/quote'
        ? json(200, quote({ paymentLinkValidityHours: 24 }))
        : undefined
    )
    const user = userEvent.setup()
    renderPage()
    await chooseMember(user)
    await addTee(user)
    await chooseAddress(user)
    expect(await screen.findByTestId('quote-validity', {}, SLOW)).toHaveTextContent('Link valid for 24 hours')
  })

  it('does not ask for a quote while the delivery mobile is not an Indian mobile', async () => {
    install()
    const user = userEvent.setup()
    renderPage()
    await chooseMember(user)
    await addTee(user)
    await chooseAddress(user)
    await waitFor(() => expect(quoteCalls()).toHaveLength(1), SLOW)
    await user.type(screen.getByLabelText('Delivery mobile (optional)'), '12345')
    expect(await screen.findByText('Enter a 10-digit Indian mobile number (+91).')).toBeInTheDocument()
    await new Promise((r) => setTimeout(r, 600))
    expect(quoteCalls()).toHaveLength(1)
  })
})

describe('place', () => {
  async function ready(user: ReturnType<typeof userEvent.setup>) {
    await chooseMember(user)
    await addTee(user)
    await chooseAddress(user)
    await screen.findByText('₹848.00', {}, SLOW)
    await waitFor(() => expect(screen.getByRole('button', { name: 'Place order' })).toBeEnabled())
  }

  it('sends one idempotency key, the quoted payable, the note, and notify off by default; then opens the order', async () => {
    install((call) =>
      call.method === 'POST' && call.url.pathname === '/api/admin/orders'
        ? json(201, { id: 'o-9', number: 'HBT_10000020' })
        : undefined
    )
    const user = userEvent.setup()
    renderPage()
    await ready(user)
    await user.type(screen.getByLabelText('Internal note (optional)'), 'Phone order')
    await user.click(screen.getByRole('button', { name: 'Place order' }))

    expect(await screen.findByText('ORDER PAGE')).toBeInTheDocument()
    expect(placeCalls()).toHaveLength(1)
    const [placed] = placeCalls()
    expect(placed.headers.get('Idempotency-Key')).toMatch(/^[0-9a-f-]{36}$/)
    expect(placed.body).toEqual({
      memberId: 'm-1',
      lines: [{ variantId: 'v-1', quantity: 1 }],
      addressId: 'a-1',
      quotedPayableMinor: 84800,
      internalNote: 'Phone order',
      notifyCustomer: false,
    })
  })

  it('sends notifyCustomer only when the box is ticked', async () => {
    install((call) =>
      call.method === 'POST' && call.url.pathname === '/api/admin/orders'
        ? json(201, { id: 'o-9', number: 'HBT_10000020' })
        : undefined
    )
    const user = userEvent.setup()
    renderPage()
    await ready(user)
    await user.click(screen.getByLabelText('Text the payment link to the member'))
    await user.click(screen.getByRole('button', { name: 'Place order' }))
    await screen.findByText('ORDER PAGE')
    expect((placeCalls()[0].body as { notifyCustomer: boolean }).notifyCustomer).toBe(true)
  })

  it('shows the server’s sentence when the price changed and asks for the quote again', async () => {
    let quoteNo = 0
    install((call) => {
      if (call.url.pathname === '/api/admin/orders/quote') {
        quoteNo += 1
        return json(200, quote(quoteNo === 1 ? {} : { payableMinor: 89700 }))
      }
      if (call.method === 'POST' && call.url.pathname === '/api/admin/orders') {
        return refusal(422, 'BUSINESS_RULE_VIOLATION', 'The price changed to ₹897.00. Check the quote and place again.')
      }
      return undefined
    })
    const user = userEvent.setup()
    renderPage()
    await ready(user)
    await user.click(screen.getByRole('button', { name: 'Place order' }))

    expect(
      await screen.findByText('The price changed to ₹897.00. Check the quote and place again.')
    ).toBeInTheDocument()
    expect(await screen.findByText('₹897.00', {}, SLOW)).toBeInTheDocument()
    expect(quoteCalls()).toHaveLength(2)
    expect(screen.queryByText('ORDER PAGE')).not.toBeInTheDocument()
  })
})

describe('permission', () => {
  it('refuses the page without orders.create', async () => {
    install(undefined, ['orders.read'])
    renderPage()
    expect(await screen.findByText(/You don’t have permission to place orders/)).toBeInTheDocument()
    expect(screen.queryByLabelText('Search members')).not.toBeInTheDocument()
  })
})
