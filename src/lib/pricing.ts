import type { PricingLevel, PricingVersionState } from '@/api/pricing'

/**
 * D7.12 — a tier price is at most the variant's base selling price (and so never above MRP).
 * A **hint only**: the server checks it on every write and again at publish, and its refusal is
 * the sentence the operator sees. Integer minor units, never float (D3.2).
 */
export function priceAboveBase(priceMinor: number | null, baseMinor: number | undefined): boolean {
  return priceMinor !== null && baseMinor !== undefined && priceMinor > baseMinor
}

/**
 * The bulk "set a variant's prices" body: it *replaces* the variant's prices in the draft, so a
 * level left empty is simply omitted — the server clears it and that level pays the base price.
 */
export function pricesRequest(
  entries: { level: PricingLevel; amountMinor: number | null }[],
  currency: string
): { level: PricingLevel; price: { amountMinor: number; currency: string } }[] {
  return entries
    .filter((e): e is { level: PricingLevel; amountMinor: number } => e.amountMinor !== null)
    .map((e) => ({ level: e.level, price: { amountMinor: e.amountMinor, currency } }))
}

/** What each lifecycle action is allowed on — D7.11/D7.13; the server refuses the rest (422). */
export function pricingActions(state: PricingVersionState | undefined) {
  return {
    editable: state === 'DRAFT',
    publishable: state === 'DRAFT',
    withdrawable: state === 'SCHEDULED',
  }
}

/**
 * A `datetime-local` value ("2026-10-05T09:30", the operator's own clock) as the ISO instant the
 * publish endpoint takes; empty means "now", which the server reads as an omitted field.
 */
export function localInputToInstant(value: string): string | undefined {
  if (!value) {
    return undefined
  }
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString()
}

/** One tier's Bits option as the editor holds it: both fields empty means no option. */
export interface BitsDraft {
  points: number | null
  priceMinor: number | null
}

/** D7.17 — a Bits price is at least ₹1. */
const MIN_BITS_PRICE_MINOR = 100

/**
 * What a tier pays in a draft, as far as the editor can know it: its level's price if the draft
 * sets one, else the base selling price; LOWEST pays the cheaper of the two levels (D7.12). A
 * **hint only** — the server resolves the real tier price and its sentence is what the operator
 * sees on refusal.
 */
export function tierPriceHint(
  level: PricingLevel | undefined,
  levelPrices: Partial<Record<PricingLevel, number | null>>,
  baseMinor: number | undefined
): number | undefined {
  const member = levelPrices.MEMBER ?? baseMinor
  if (level === 'LOWEST') {
    const lowest = levelPrices.LOWEST ?? baseMinor
    return member === undefined || lowest === undefined
      ? (member ?? lowest)
      : Math.min(member, lowest)
  }
  return member
}

/** The reason a Bits option will be refused, or `undefined` when it looks fine (or is empty). */
export function bitsOptionHint(
  option: BitsDraft,
  tierPriceMinor: number | undefined
): string | undefined {
  const { points, priceMinor } = option
  if (points === null && priceMinor === null) {
    return undefined
  }
  if (points === null || priceMinor === null) {
    return 'Set both the Bits and the price, or leave both empty.'
  }
  if (points <= 0) {
    return 'Bits must be more than 0.'
  }
  if (priceMinor < MIN_BITS_PRICE_MINOR) {
    return 'The price must be at least ₹1.00.'
  }
  if (tierPriceMinor !== undefined && priceMinor >= tierPriceMinor) {
    return 'The price must be below what this tier pays — otherwise there is nothing to save.'
  }
  return undefined
}

/**
 * The bulk "set a variant's Bits options" body: it *replaces* the variant's options, so a tier
 * with both fields empty is omitted and the server clears it. `null` while any tier is half-set.
 */
export function bitsRequest(
  entries: { tierCode: string; option: BitsDraft }[],
  currency: string
):
  | { tierCode: string; pointsAmount: number; price: { amountMinor: number; currency: string } }[]
  | null {
  const out = []
  for (const { tierCode, option } of entries) {
    if (option.points === null && option.priceMinor === null) {
      continue
    }
    if (option.points === null || option.priceMinor === null) {
      return null
    }
    out.push({
      tierCode,
      pointsAmount: option.points,
      price: { amountMinor: option.priceMinor, currency },
    })
  }
  return out
}
