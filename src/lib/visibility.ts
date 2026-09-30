import type { ProductAudience } from '@/api/products'

/**
 * D4.17(4): `requiredTierCode` is required exactly when the audience is `TIER_RESTRICTED` and
 * refused for any other audience. The server 400s either way; this is what lets the form say so
 * before the request, and what keeps a stale tier from riding along after the audience changes.
 */
export function requiredTierCodeFor(
  audience: ProductAudience,
  tierCode: string | undefined
): string | undefined {
  return audience === 'TIER_RESTRICTED' ? tierCode || undefined : undefined
}

/** The sentence blocking a save, or undefined when the switches can be sent as they are. */
export function visibilitySaveProblem(
  audience: ProductAudience,
  tierCode: string | undefined
): string | undefined {
  if (audience === 'TIER_RESTRICTED' && !tierCode) {
    return 'Choose the tier a customer must reach — a tier-restricted product needs one.'
  }
  return undefined
}
