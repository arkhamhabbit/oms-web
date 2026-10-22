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

/** The "as the product" choice in a variant's tier picker — `Select` cannot hold an empty value. */
export const AS_PRODUCT = '__as_product__'

/** A ladder tier as the variant rules need it: its stable code (D7.9) and its rank, higher = stricter. */
export interface LadderTier {
  code?: string
  rank?: number
}

function rankOf(ladder: LadderTier[], code: string): number | undefined {
  return ladder.find((t) => t.code === code)?.rank
}

/**
 * D4.18: a variant's own tier may only add to its product's rule. The server is authoritative
 * (400 unknown code, 422 looser / customer-restricted); this is the hint shown before the request.
 * `ladder` is `undefined` while it is unknown.
 */
export function variantTierProblem(
  audience: ProductAudience,
  productTierCode: string | undefined,
  variantTierCode: string | undefined,
  ladder: LadderTier[] | undefined
): string | undefined {
  if (!variantTierCode) {
    return undefined
  }
  if (audience === 'CUSTOMER_RESTRICTED') {
    return 'A customer-restricted product is limited by its allowlist — a variant cannot require a tier.'
  }
  if (audience === 'TIER_RESTRICTED' && productTierCode && ladder) {
    const own = rankOf(ladder, variantTierCode)
    const product = rankOf(ladder, productTierCode)
    if (own !== undefined && product !== undefined && own < product) {
      return `The product already requires ${productTierCode}; a variant can only require that tier or a higher one.`
    }
  }
  return undefined
}

/** Tiers a variant may pick: all of them on a PUBLIC product, only the product's tier and above
 * on a TIER_RESTRICTED one, none on a CUSTOMER_RESTRICTED one. */
export function variantTierChoices<T extends LadderTier>(
  audience: ProductAudience,
  productTierCode: string | undefined,
  ladder: T[]
): T[] {
  if (audience === 'CUSTOMER_RESTRICTED') {
    return []
  }
  const floor =
    audience === 'TIER_RESTRICTED' && productTierCode ? rankOf(ladder, productTierCode) : undefined
  return floor === undefined ? ladder : ladder.filter((t) => (t.rank ?? 0) >= floor)
}
