import type { EarnRules, EarnRulesState } from '@/api/earn'

/** What each lifecycle action is allowed on — D3.6/D7.11; the server refuses the rest (422). */
export function earnActions(state: EarnRulesState | undefined) {
  return {
    editable: state === 'DRAFT',
    publishable: state === 'DRAFT',
    withdrawable: state === 'SCHEDULED',
  }
}

/** Bits fields as typed; Carrots are held in paise (D3.2). `null` while empty or unparsable. */
export interface EarnDraft {
  welcomePoints: number | null
  welcomeCarrotsMinor: number | null
  referralJoinPoints: number | null
  referralFirstOrderCarrotsMinor: number | null
  profileCompletePoints: number | null
  deviceConnectedPoints: number | null
  firstOrderPoints: number | null
  orderPointsPer100Rupees: number | null
  orderCarrotsPer100RupeesMinor: number | null
  welcomeForLegacy: boolean
}

export function rulesToDraft(rules: EarnRules): EarnDraft {
  return {
    welcomePoints: rules.welcomePoints ?? 0,
    welcomeCarrotsMinor: rules.welcomeCarrotsMinor ?? 0,
    referralJoinPoints: rules.referralJoinPoints ?? 0,
    referralFirstOrderCarrotsMinor: rules.referralFirstOrderCarrotsMinor ?? 0,
    profileCompletePoints: rules.profileCompletePoints ?? 0,
    deviceConnectedPoints: rules.deviceConnectedPoints ?? 0,
    firstOrderPoints: rules.firstOrderPoints ?? 0,
    orderPointsPer100Rupees: rules.orderPointsPer100Rupees ?? 0,
    orderCarrotsPer100RupeesMinor: rules.orderCarrotsPer100RupeesMinor ?? 0,
    welcomeForLegacy: rules.welcomeForLegacy ?? false,
  }
}

/**
 * Whole number from what was typed, or null. A leading minus is kept on purpose: a negative is
 * sent and refused by the server with its own sentence, rather than silently blocked here.
 */
export function parseWholeNumber(input: string): number | null {
  const trimmed = input.trim().replace(/,/g, '')
  if (!/^-?\d+$/.test(trimmed)) {
    return null
  }
  const value = Number.parseInt(trimmed, 10)
  return Number.isSafeInteger(value) ? value : null
}

/** The request body, or null while any amount is still empty or unparsable. */
export function draftToRequest(draft: EarnDraft) {
  const {
    welcomePoints,
    welcomeCarrotsMinor,
    referralJoinPoints,
    referralFirstOrderCarrotsMinor,
    profileCompletePoints,
    deviceConnectedPoints,
    firstOrderPoints,
    orderPointsPer100Rupees,
    orderCarrotsPer100RupeesMinor,
    welcomeForLegacy,
  } = draft
  if (
    welcomePoints === null ||
    welcomeCarrotsMinor === null ||
    referralJoinPoints === null ||
    referralFirstOrderCarrotsMinor === null ||
    profileCompletePoints === null ||
    deviceConnectedPoints === null ||
    firstOrderPoints === null ||
    orderPointsPer100Rupees === null ||
    orderCarrotsPer100RupeesMinor === null
  ) {
    return null
  }
  return {
    welcomePoints,
    welcomeCarrotsMinor,
    referralJoinPoints,
    referralFirstOrderCarrotsMinor,
    profileCompletePoints,
    deviceConnectedPoints,
    firstOrderPoints,
    orderPointsPer100Rupees,
    orderCarrotsPer100RupeesMinor,
    welcomeForLegacy,
  }
}
