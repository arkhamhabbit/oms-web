import { calls, json, resetFetch, respondWith } from '@/test/fake-fetch'
import { installRadixPolyfills } from '@/test/polyfills'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render as rtlRender, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it } from 'vitest'

import { BreadcrumbProvider } from '@/layouts/breadcrumb-context'
import OrderSettingsPage from '@/pages/OrderSettingsPage'

installRadixPolyfills()

const CURRENT = {
  versionId: 'v-1',
  shippingFeeMinor: 4900,
  paymentTimeoutMinutes: 15,
  cancelUntil: 'SHIPPED',
  effectiveFrom: '2026-10-01T00:00:00Z',
}

function render() {
  return rtlRender(
    <QueryClientProvider
      client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
    >
      <MemoryRouter>
        <BreadcrumbProvider>
          <OrderSettingsPage />
        </BreadcrumbProvider>
      </MemoryRouter>
    </QueryClientProvider>
  )
}

beforeEach(() => {
  resetFetch()
  respondWith((call) => {
    if (call.url.pathname === '/api/admin/profile') {
      return json(200, {
        id: 'u',
        email: 'a@b.c',
        name: 'A',
        permissions: ['orders.read', 'orders.write'],
        roles: [],
        version: 1,
      })
    }
    if (call.url.pathname.endsWith('/current')) {
      return json(200, CURRENT)
    }
    return json(200, { content: [CURRENT], page: 0, size: 20, totalElements: 1, totalPages: 1 })
  })
})

describe('order settings timeout', () => {
  it('refuses 30 beside the field, before any confirm dialog opens', async () => {
    const user = userEvent.setup()
    render()

    const timeout = await screen.findByLabelText('Payment timeout (minutes)')
    await user.clear(timeout)
    await user.type(timeout, '30')

    expect(screen.getByText('Enter a whole number of minutes from 5 to 15.')).toBeInTheDocument()
    expect(timeout).toHaveAttribute('aria-invalid', 'true')
    const publish = screen.getByRole('button', { name: 'Publish' })
    expect(publish).toBeDisabled()
    await user.click(publish)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(calls.some((c) => c.method === 'POST')).toBe(false)
  })

  it('accepts the edges of the range and opens the confirm', async () => {
    const user = userEvent.setup()
    render()

    const timeout = await screen.findByLabelText('Payment timeout (minutes)')
    for (const ok of ['5', '15']) {
      await user.clear(timeout)
      await user.type(timeout, ok)
      expect(screen.queryByText(/Enter a whole number of minutes/)).not.toBeInTheDocument()
    }
    await user.click(screen.getByRole('button', { name: 'Publish' }))
    expect(await screen.findByRole('dialog')).toBeInTheDocument()
  })

  it('refuses 4 and a non-number the same way', async () => {
    const user = userEvent.setup()
    render()

    const timeout = await screen.findByLabelText('Payment timeout (minutes)')
    for (const bad of ['4', '1x']) {
      await user.clear(timeout)
      await user.type(timeout, bad)
      expect(screen.getByText('Enter a whole number of minutes from 5 to 15.')).toBeInTheDocument()
    }
  })
})
