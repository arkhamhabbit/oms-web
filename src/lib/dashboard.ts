/**
 * The dashboard's count cards. Each card is a live count read from the list endpoint it stands
 * for, and exists only for an account that holds that endpoint's read permission: the card for a
 * list the account cannot open would be a 403 on the front page.
 */
export type DashboardCardKey = 'brands' | 'categories' | 'products' | 'users' | 'orders' | 'pos'

export interface DashboardCard {
  key: DashboardCardKey
  label: string
  hint: string
  /** The read permission of the list endpoint the count comes from. */
  permission: string
  /** Where the card leads. */
  to: string
}

export const DASHBOARD_CARDS: readonly DashboardCard[] = [
  {
    key: 'brands',
    label: 'Brands',
    hint: 'All brands',
    permission: 'catalog.brand.read',
    to: '/brands',
  },
  {
    key: 'categories',
    label: 'Categories',
    hint: 'All categories',
    permission: 'catalog.category.read',
    to: '/categories',
  },
  {
    key: 'products',
    label: 'Products',
    hint: 'All products',
    permission: 'catalog.product.read',
    to: '/products',
  },
  {
    key: 'users',
    label: 'Users',
    hint: 'All customers and partners',
    permission: 'identity.user.read',
    to: '/users',
  },
  {
    key: 'orders',
    label: 'Open orders',
    hint: 'Confirmed, packed or on the way',
    permission: 'orders.read',
    to: '/orders',
  },
  {
    key: 'pos',
    label: 'Open purchase orders',
    hint: 'Approved and still owed stock',
    permission: 'procurement.po.read',
    to: '/procurement/purchase-orders',
  },
]

/** The orders still moving: placed and paid, not yet delivered, cancelled or refunded. */
export const OPEN_ORDER_STATUSES = ['CONFIRMED', 'PACKED', 'SHIPPED', 'OUT_FOR_DELIVERY'] as const

/** The cards an account may see, in dashboard order. */
export function visibleDashboardCards(has: (permission: string) => boolean): DashboardCard[] {
  return DASHBOARD_CARDS.filter((card) => has(card.permission))
}
