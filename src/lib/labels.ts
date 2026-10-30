/**
 * The one place an enum code becomes the words an admin reads. Every status, kind, type or
 * reason the console renders (badges, table cells, filter options, dialog fields) goes through a
 * map here, so "IN_REVIEW" is "In review" on every screen. A code with no entry falls back to
 * its title-cased self rather than showing raw, so a value the contract adds later still reads
 * as words until it is given a label.
 */

/** `IN_REVIEW` -> `In review`, `stock_movement` -> `Stock movement`. */
export function titleCaseCode(code: string): string {
  const words = code.replace(/[_-]+/g, ' ').trim().toLowerCase()
  return words.charAt(0).toUpperCase() + words.slice(1)
}

/** The label for a code from a map, or its title-cased code when the map has none. */
export function labelOf(map: Readonly<Record<string, string>>, code: string | undefined): string {
  if (!code) {
    return ''
  }
  return map[code] ?? titleCaseCode(code)
}

// --- Filters: what "no filter" reads as ------------------------------------------------------

export const ANY_STATUS = 'Any status'
export const ANY_VISIBILITY = 'Any visibility'
export const ANY_STATE = 'Any state'
export const ANY_AUDIENCE = 'Any audience'
export const ANY_KIND = 'Any kind'

// --- People ----------------------------------------------------------------------------------

export const USER_STATUS_LABEL = {
  INVITED: 'Invited',
  ACTIVE: 'Active',
  SUSPENDED: 'Suspended',
} as const

export const TEAM_STATUS_LABEL = {
  INVITED: 'Invited',
  ACTIVE: 'Active',
  SUSPENDED: 'Suspended',
  DEACTIVATED: 'Deactivated',
} as const

// --- Catalog ---------------------------------------------------------------------------------

/** Brand, category and product share one lifecycle (D4.8). */
export const CATALOG_STATUS_LABEL = {
  DRAFT: 'Draft',
  IN_REVIEW: 'In review',
  ACTIVE: 'Active',
  ARCHIVED: 'Archived',
} as const

export const PRODUCT_AUDIENCE_LABEL = {
  PUBLIC: 'Public',
  TIER_RESTRICTED: 'Tier restricted',
  CUSTOMER_RESTRICTED: 'Customer restricted',
} as const

export const ATTRIBUTE_KIND_LABEL = {
  OPTION: 'Option',
  SPEC: 'Spec',
} as const

export const ATTRIBUTE_DATA_TYPE_LABEL = {
  TEXT: 'Text',
  NUMBER: 'Number',
  BOOLEAN: 'Yes / no',
  SINGLE_SELECT: 'Single select',
  MULTI_SELECT: 'Multi select',
} as const

export const ATTRIBUTE_APPLIES_TO_LABEL = {
  PRODUCT: 'Product',
  VARIANT: 'Variant',
} as const

export const MEDIA_STATUS_LABEL = {
  PENDING: 'Pending',
  READY: 'Ready',
  FAILED: 'Failed',
} as const

// --- Inventory and procurement ---------------------------------------------------------------

export const WAREHOUSE_TYPE_LABEL = {
  OWN: 'Own',
  THIRD_PARTY: 'Third party',
} as const

export const MOVEMENT_TYPE_LABEL = {
  RECEIPT: 'Receipt',
  ADJUSTMENT: 'Adjustment',
  TRANSFER_OUT: 'Transfer out',
  TRANSFER_IN: 'Transfer in',
  DAMAGE: 'Damage',
  EXPIRY_WRITE_OFF: 'Expiry write-off',
  RETURN: 'Return',
  SALE: 'Sale',
} as const

export const REASON_CODE_LABEL = {
  CYCLE_COUNT: 'Cycle count',
  DATA_CORRECTION: 'Data correction',
  FOUND_STOCK: 'Found stock',
  LOST_STOCK: 'Lost stock',
  THEFT: 'Theft',
  CONSUMED_INTERNALLY: 'Consumed internally',
  DAMAGED_IN_TRANSIT: 'Damaged in transit',
  DAMAGED_IN_WAREHOUSE: 'Damaged in warehouse',
  DAMAGED_ON_RETURN: 'Damaged on return',
  CUSTOMER_RETURN: 'Customer return',
  COURIER_RTO: 'Courier RTO',
  CANCELLED_ORDER: 'Cancelled order',
} as const

export const AVAILABILITY_ACTION_LABEL = {
  IN_SYNC: 'In sync',
  POPULATED: 'Counter created',
  CORRECTED_DOWN: 'Lowered',
  CORRECTED_UP: 'Raised',
  UPWARD_DEFERRED: 'Raise deferred',
  CHANGED_DURING_CHECK: 'Changed during the check',
  REMOVED: 'Counter removed',
} as const

export const PO_STATUS_LABEL = {
  DRAFT: 'Draft',
  APPROVED: 'Approved',
  PARTIALLY_RECEIVED: 'Partially received',
  RECEIVED: 'Received',
  CANCELLED: 'Cancelled',
} as const

// --- Orders and payments ---------------------------------------------------------------------

export const ORDER_STATUS_LABEL = {
  PENDING_PAYMENT: 'Awaiting payment',
  CONFIRMED: 'Confirmed',
  PACKED: 'Packed',
  SHIPPED: 'Shipped',
  OUT_FOR_DELIVERY: 'Out for delivery',
  DELIVERED: 'Delivered',
  PAYMENT_FAILED: 'Payment failed',
  EXPIRED: 'Expired',
  CANCELLED: 'Cancelled',
  REFUNDED: 'Refunded',
} as const

export const PAYMENT_STATUS_LABEL = {
  CREATED: 'Awaiting payment',
  CAPTURED: 'Captured',
  FAILED: 'Failed',
  REFUND_PENDING: 'Refund pending',
  REFUNDED: 'Refunded',
} as const

export const REFUND_METHOD_LABEL = {
  GATEWAY: 'Gateway',
  MANUAL: 'Manual',
} as const

/** The domain an audit action or entity belongs to, for grouping the filters. */
export function domainLabel(code: string): string {
  const head = code.split('.')[0] ?? code
  return DOMAIN_LABEL[head] ?? titleCaseCode(head)
}

const DOMAIN_LABEL: Record<string, string> = {
  catalog: 'Catalog',
  identity: 'Users',
  team: 'Team',
  invite: 'Invites',
  pricing: 'Pricing',
  membership: 'Membership',
  earn: 'Earn rules',
  orders: 'Orders',
  inventory: 'Inventory',
  warehouse: 'Warehouses',
  procurement: 'Procurement',
  media: 'Media',
  audit: 'Audit',
}
