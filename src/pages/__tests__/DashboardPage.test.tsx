import { calls, json, refusal, resetFetch, respondWith } from '@/test/fake-fetch'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render as rtlRender, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it } from 'vitest'

import DashboardPage from '@/pages/DashboardPage'
import { BreadcrumbProvider } from '@/layouts/breadcrumb-context'
import { DASHBOARD_CARDS, visibleDashboardCards } from '@/lib/dashboard'

function page(totalElements: number) {
  return json(200, { content: [], page: 0, size: 1, totalElements, totalPages: totalElements })
}

function render() {
  return rtlRender(
    <QueryClientProvider
      client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
    >
      <MemoryRouter>
        <BreadcrumbProvider>
          <DashboardPage />
        </BreadcrumbProvider>
      </MemoryRouter>
    </QueryClientProvider>
  )
}

function profileWith(permissions: string[]) {
  return json(200, { id: 'u', email: 'a@b.c', name: 'A', permissions, roles: [], version: 1 })
}

const COUNTS: Record<string, number> = {
  '/api/admin/brands': 4,
  '/api/admin/categories': 9,
  '/api/admin/products': 6,
  '/api/admin/users': 12,
  '/api/admin/purchase-orders/open': 2,
}

beforeEach(() => {
  resetFetch()
})

describe('dashboard cards', () => {
  it('shows only the cards whose list the account may read', () => {
    const readonly = (key: string) => ['identity.user.read', 'orders.read'].includes(key)
    expect(visibleDashboardCards(readonly).map((c) => c.key)).toEqual(['users', 'orders'])
    expect(visibleDashboardCards(() => true)).toHaveLength(DASHBOARD_CARDS.length)
    expect(visibleDashboardCards(() => false)).toEqual([])
  })

  it('reads each count live from its list endpoint, with no fixture numbers', async () => {
    respondWith((call) => {
      const path = call.url.pathname
      if (path === '/api/admin/profile') {
        return profileWith(DASHBOARD_CARDS.map((c) => c.permission))
      }
      if (path === '/api/admin/orders') {
        // each open status reports its own total; the card adds them
        return page({ CONFIRMED: 3, PACKED: 1, SHIPPED: 2, OUT_FOR_DELIVERY: 0 }[call.url.searchParams.get('status') ?? ''] ?? 0)
      }
      return page(COUNTS[path] ?? 0)
    })
    render()

    await waitFor(() => expect(screen.getByTestId('dashboard-card-brands')).toHaveTextContent('4'))
    expect(screen.getByTestId('dashboard-card-categories')).toHaveTextContent('9')
    expect(screen.getByTestId('dashboard-card-products')).toHaveTextContent('6')
    expect(screen.getByTestId('dashboard-card-users')).toHaveTextContent('12')
    await waitFor(() => expect(screen.getByTestId('dashboard-card-orders')).toHaveTextContent('6'))
    expect(screen.getByTestId('dashboard-card-pos')).toHaveTextContent('2')
  })

  it('renders, and asks for, only the users and orders cards for a read-only account', async () => {
    respondWith((call) => {
      if (call.url.pathname === '/api/admin/profile') {
        return profileWith(['identity.user.read', 'orders.read'])
      }
      return page(5)
    })
    render()

    await waitFor(() => expect(screen.getByTestId('dashboard-card-users')).toHaveTextContent('5'))
    expect(screen.getByTestId('dashboard-card-orders')).toBeInTheDocument()
    expect(screen.queryByTestId('dashboard-card-brands')).not.toBeInTheDocument()
    expect(screen.queryByTestId('dashboard-card-categories')).not.toBeInTheDocument()
    expect(screen.queryByTestId('dashboard-card-products')).not.toBeInTheDocument()
    expect(screen.queryByTestId('dashboard-card-pos')).not.toBeInTheDocument()
    // a card the account cannot see never asks for its list
    const asked = calls.map((c) => c.url.pathname)
    expect(asked).not.toContain('/api/admin/brands')
    expect(asked).not.toContain('/api/admin/purchase-orders/open')
  })

  it('shows a skeleton while loading and an error, not a number, when a count fails', async () => {
    respondWith((call) => {
      if (call.url.pathname === '/api/admin/profile') {
        return profileWith(['identity.user.read', 'catalog.brand.read'])
      }
      if (call.url.pathname === '/api/admin/brands') {
        return refusal(500, 'INTERNAL_ERROR', 'Something went wrong.')
      }
      return page(7)
    })
    render()

    expect(await screen.findByRole('status', { name: /Loading Users/ })).toBeInTheDocument()
    await waitFor(() => expect(screen.getByTestId('dashboard-card-users')).toHaveTextContent('7'))
    const brands = screen.getByTestId('dashboard-card-brands')
    await waitFor(() => expect(brands).toHaveTextContent('Could not load'))
    expect(brands).not.toHaveTextContent(/\d/)
  })
})
