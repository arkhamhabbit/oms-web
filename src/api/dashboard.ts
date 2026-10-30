import { useQuery } from '@tanstack/react-query'

import { api, unwrap } from '@/api/client'
import { OPEN_ORDER_STATUSES, type DashboardCardKey } from '@/lib/dashboard'

const ONE = { page: 0, size: 1 }

/** The total a list endpoint reports for a one-row page. */
async function total(page: Promise<{ totalElements?: number }>): Promise<number> {
  return (await page).totalElements ?? 0
}

async function countFor(key: DashboardCardKey): Promise<number> {
  switch (key) {
    case 'brands':
      return total(unwrap(api.GET('/api/admin/brands', { params: { query: { pageable: ONE } } })))
    case 'categories':
      return total(
        unwrap(api.GET('/api/admin/categories', { params: { query: { pageable: ONE } } }))
      )
    case 'products':
      return total(unwrap(api.GET('/api/admin/products', { params: { query: { pageable: ONE } } })))
    case 'users':
      return total(unwrap(api.GET('/api/admin/users', { params: { query: { pageable: ONE } } })))
    case 'orders': {
      const counts = await Promise.all(
        OPEN_ORDER_STATUSES.map((status) =>
          total(
            unwrap(
              api.GET('/api/admin/orders', { params: { query: { pageable: ONE, status } } })
            )
          )
        )
      )
      return counts.reduce((sum, count) => sum + count, 0)
    }
    case 'pos':
      return total(
        unwrap(api.GET('/api/admin/purchase-orders/open', { params: { query: { pageable: ONE } } }))
      )
  }
}

/**
 * One card's live count. Nothing is kept once the dashboard is left (`gcTime: 0`) and a failed
 * read is an error, not the last number seen: a count on the front page is either current or absent.
 */
export function useDashboardCount(key: DashboardCardKey) {
  return useQuery({
    queryKey: ['dashboard', 'count', key],
    queryFn: () => countFor(key),
    retry: false,
    staleTime: 0,
    gcTime: 0,
  })
}
