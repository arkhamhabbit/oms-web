import type { MembershipVersionState, Tier, TierInput, TierPricingLevel } from '@/api/membership'

/** What each lifecycle action is allowed on — D7.11; the server refuses the rest (422). */
export function membershipActions(state: MembershipVersionState | undefined) {
  return {
    editable: state === 'DRAFT',
    publishable: state === 'DRAFT',
    withdrawable: state === 'SCHEDULED',
  }
}

/**
 * A ladder row as the editor holds it. Numeric fields are `null` while empty or unparsable, so a
 * half-typed value never clobbers itself. Carrots are held in **paise** (D3.2) and typed in
 * rupees through `MoneyInput`.
 */
export interface TierDraft {
  /** Local key only — a draft's tier ids change on every save, so the id can't key a row. */
  key: string
  code: string
  name: string
  thresholdPoints12mo: number | null
  maintainThresholdPoints: number | null
  carrotsPerFriendOrderMinor: number | null
  pricingLevel: TierPricingLevel
  freeShipping: boolean
  activeInviteLimit: number | null
}

let keyCounter = 0
function nextTierKey(): string {
  keyCounter += 1
  return `tier-${keyCounter}`
}

export function tierToDraft(tier: Tier): TierDraft {
  return {
    key: nextTierKey(),
    code: tier.code ?? '',
    name: tier.name ?? '',
    thresholdPoints12mo: tier.thresholdPoints12mo ?? 0,
    maintainThresholdPoints: tier.maintainThresholdPoints ?? 0,
    carrotsPerFriendOrderMinor: tier.carrotsPerFriendOrderMinor ?? 0,
    pricingLevel: tier.pricingLevel ?? 'MEMBER',
    freeShipping: tier.freeShipping ?? false,
    activeInviteLimit: tier.activeInviteLimit ?? 0,
  }
}

/** A blank rung for the operator to fill: reach and maintain start empty. */
export function blankTierDraft(): TierDraft {
  return {
    key: nextTierKey(),
    code: '',
    name: '',
    thresholdPoints12mo: null,
    maintainThresholdPoints: null,
    carrotsPerFriendOrderMinor: 0,
    pricingLevel: 'MEMBER',
    freeShipping: false,
    activeInviteLimit: 0,
  }
}

/** The request body for a complete ladder, or `null` while any numeric field is still empty. */
export function draftsToRequest(drafts: TierDraft[]): TierInput[] | null {
  const tiers: TierInput[] = []
  for (const d of drafts) {
    if (
      d.thresholdPoints12mo === null ||
      d.maintainThresholdPoints === null ||
      d.carrotsPerFriendOrderMinor === null ||
      d.activeInviteLimit === null
    ) {
      return null
    }
    tiers.push({
      code: d.code.trim(),
      name: d.name.trim(),
      thresholdPoints12mo: d.thresholdPoints12mo,
      maintainThresholdPoints: d.maintainThresholdPoints,
      carrotsPerFriendOrderMinor: d.carrotsPerFriendOrderMinor,
      pricingLevel: d.pricingLevel,
      freeShipping: d.freeShipping,
      activeInviteLimit: d.activeInviteLimit,
    })
  }
  return tiers
}

/**
 * The D7.15 maintain bar as a **hint only** — the server validates the whole ladder on every
 * save and again at publish, and its sentence is what the operator sees on refusal. The first
 * tier (index 0) has nothing to drop to, so its maintain is 0; every other is
 * `0 < maintain < reach`. Returns the hint, or `undefined` when fine or not yet a number.
 */
export function maintainHint(
  index: number,
  maintain: number | null,
  reach: number | null
): string | undefined {
  if (maintain === null) {
    return undefined
  }
  if (index === 0) {
    return maintain === 0 ? undefined : 'The first tier has nothing to drop to — its maintain is 0.'
  }
  if (maintain <= 0) {
    return 'Must be more than 0.'
  }
  if (reach !== null && maintain >= reach) {
    return `Must be below the reach threshold (${reach.toLocaleString('en-IN')}).`
  }
  return undefined
}

/**
 * A whole non-negative number from a text field; `null` for empty or anything else. Digits
 * only — never `Number()` — so "1e3" or "12.5" can't slip through as a points figure.
 */
export function parseWholeNumber(text: string): number | null {
  const trimmed = text.trim().replace(/,/g, '')
  return /^\d{1,15}$/.test(trimmed) ? Number.parseInt(trimmed, 10) : null
}
