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
