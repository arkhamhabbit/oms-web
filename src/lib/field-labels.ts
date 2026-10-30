/**
 * Field name -> the label the admin sees on the form, one map per form. The server names a field
 * by its request property (`paymentTimeoutMinutes`, `tiers[1].threshold`); a refusal that names
 * it must read as the control it belongs to, never as camelCase. A field with no entry falls
 * back to a spelled-out version of its name, so nothing reaches the screen as code.
 */
export type FieldLabels = Record<string, string>

export const CHANGE_PASSWORD_LABELS: FieldLabels = {
  currentPassword: 'Current password',
  newPassword: 'New password',
}

export const LOGIN_LABELS: FieldLabels = { email: 'Email', password: 'Password' }

export const ORDER_SETTINGS_LABELS: FieldLabels = {
  shippingFeeMinor: 'Flat shipping fee',
  paymentTimeoutMinutes: 'Payment timeout',
  cancelUntil: 'Cancel window',
  notes: 'Notes',
}

export const EARN_VERSION_LABELS: FieldLabels = {
  name: 'Name',
  effectiveFrom: 'Effective from',
  orderPointsPer100Rupees: 'Bits per ₹100 of an order',
  orderCarrotsPer100Rupees: 'Carrots per ₹100 of an order',
}

export const MEMBERSHIP_VERSION_LABELS: FieldLabels = {
  name: 'Name',
  effectiveFrom: 'Effective from',
  'tiers[].name': 'Tier name',
  'tiers[].threshold': 'Qualifying threshold',
  'tiers[].qualifyingPoints': 'Qualifying points',
  'tiers[].freeShipping': 'Free shipping',
}

export const PRICING_VERSION_LABELS: FieldLabels = {
  name: 'Name',
  effectiveFrom: 'Effective from',
  maxPointsPerOrder: 'Bits cap per order',
}

export const STOCK_ADJUST_LABELS: FieldLabels = {
  quantity: 'Quantity',
  movementType: 'Movement type',
  reasonCode: 'Reason',
  note: 'Note',
}

export const REFUND_LABELS: FieldLabels = {
  reference: 'Reference',
  reason: 'Reason',
}

const WORD_BOUNDARY = /(?<=[a-z0-9])(?=[A-Z])|(?<=[a-z])(?=[0-9])/

/** `lines[0].quantityOrdered` -> `Lines 1 quantity ordered`: a readable stand-in when no map names the field. */
export function humanizeField(field: string): string {
  const words = field
    .replace(/\[(\d+)]/g, (_, index: string) => ` ${Number(index) + 1} `)
    .split(/[.\s]+/)
    .filter(Boolean)
    .flatMap((part) => part.split(WORD_BOUNDARY))
    .map((word) => word.toLowerCase())
  const text = words.join(' ')
  return text.charAt(0).toUpperCase() + text.slice(1)
}

/**
 * The label for a server field name: an exact entry, else the entry for the same path with its
 * row indexes removed (`tiers[1].threshold` -> `tiers[].threshold`, shown as "Qualifying threshold,
 * row 2"), else the spelled-out name.
 */
export function fieldLabel(field: string, labels?: FieldLabels): string {
  if (!field) {
    return ''
  }
  const exact = labels?.[field]
  if (exact) {
    return exact
  }
  const rows: number[] = []
  const generic = field.replace(/\[(\d+)]/g, (_, index: string) => {
    rows.push(Number(index) + 1)
    return '[]'
  })
  const mapped = labels?.[generic]
  if (mapped) {
    return rows.length > 0 ? `${mapped}, row ${rows.join('.')}` : mapped
  }
  return humanizeField(field)
}

/** "Label: sentence" for a field error that has no control to sit beside. */
export function describeFieldError(
  error: { field: string; message: string },
  labels?: FieldLabels
): string {
  const label = fieldLabel(error.field, labels)
  return label ? `${label}: ${error.message}` : error.message
}
