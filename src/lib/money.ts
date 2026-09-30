/**
 * Money is stored as integer minor units (paise) + ISO currency — D3.2. These helpers
 * convert to/from the major-unit string a human types into a form field, without ever
 * routing the value through floating-point arithmetic.
 */

const MINOR_UNITS_PER_MAJOR = 100

/** Minor units (e.g. 449900) -> display string in major units (e.g. "4499.00"). */
export function minorToMajorString(amountMinor: number): string {
  const negative = amountMinor < 0
  const abs = Math.abs(Math.trunc(amountMinor))
  const major = Math.floor(abs / MINOR_UNITS_PER_MAJOR)
  const minor = abs % MINOR_UNITS_PER_MAJOR
  const sign = negative ? '-' : ''
  return `${sign}${major}.${String(minor).padStart(2, '0')}`
}

/**
 * Display string in major units (e.g. "4499.5", "4,499.00") -> minor units (449950).
 * Returns null for anything that isn't a valid non-negative amount with at most 2
 * fractional digits. Parses digit-by-digit — never via parseFloat — so no precision is
 * lost to IEEE-754 rounding.
 */
export function majorStringToMinor(input: string): number | null {
  const trimmed = input.trim().replace(/,/g, '')
  if (trimmed === '') {
    return null
  }
  const match = /^(\d+)(?:\.(\d{1,2}))?$/.exec(trimmed)
  if (!match) {
    return null
  }
  const [, wholePart, fractionPart = ''] = match
  const fractionPadded = fractionPart.padEnd(2, '0')
  const whole = Number.parseInt(wholePart, 10)
  const fraction = Number.parseInt(fractionPadded, 10)
  return whole * MINOR_UNITS_PER_MAJOR + fraction
}

/**
 * D4.11: `base_selling_price <= mrp` — selling above MRP is illegal in India. Both amounts are
 * minor-unit integers, so this is a plain integer comparison, never routed through float. This is
 * a **client-side hint only**: the server is the authority (a check constraint), and a value this
 * says is fine can still be refused for a reason this function doesn't know about — see the
 * variant form, which shows this as an inline warning and submits regardless.
 */
export function sellingPriceExceedsMrp(baseSellingPriceMinor: number, mrpMinor: number): boolean {
  return baseSellingPriceMinor > mrpMinor
}

/** A wire amount for display, as the variant table already shows it ("INR 799.00"); "—" if none. */
export function formatMoney(
  money: { amountMinor?: number; currency?: string } | null | undefined
): string {
  if (!money || money.amountMinor === undefined) {
    return '—'
  }
  return `${money.currency ?? ''} ${minorToMajorString(money.amountMinor)}`.trim()
}
