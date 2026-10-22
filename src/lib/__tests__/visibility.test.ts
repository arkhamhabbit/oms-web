import { describe, expect, it } from 'vitest'

import {
  requiredTierCodeFor,
  variantTierChoices,
  variantTierProblem,
  visibilitySaveProblem,
} from '@/lib/visibility'

describe('visibility save rule (D4.17)', () => {
  it('blocks a tier-restricted save with no tier', () => {
    expect(visibilitySaveProblem('TIER_RESTRICTED', undefined)).toMatch(/tier/)
    expect(visibilitySaveProblem('TIER_RESTRICTED', '')).toMatch(/tier/)
    expect(visibilitySaveProblem('TIER_RESTRICTED', 'APEX')).toBeUndefined()
  })

  it('never blocks the other audiences', () => {
    expect(visibilitySaveProblem('PUBLIC', undefined)).toBeUndefined()
    expect(visibilitySaveProblem('CUSTOMER_RESTRICTED', undefined)).toBeUndefined()
  })

  it('sends the tier only for TIER_RESTRICTED — the server refuses it otherwise', () => {
    expect(requiredTierCodeFor('TIER_RESTRICTED', 'LEGEND')).toBe('LEGEND')
    expect(requiredTierCodeFor('PUBLIC', 'LEGEND')).toBeUndefined()
    expect(requiredTierCodeFor('CUSTOMER_RESTRICTED', 'LEGEND')).toBeUndefined()
  })
})

describe('variant tier rule (D4.18)', () => {
  const ladder = [
    { code: 'SPROUT', rank: 1 },
    { code: 'ACTIVE', rank: 2 },
    { code: 'APEX', rank: 3 },
  ]

  it('allows any tier on a PUBLIC product, and none is always fine', () => {
    expect(variantTierProblem('PUBLIC', undefined, 'APEX', ladder)).toBeUndefined()
    expect(variantTierProblem('TIER_RESTRICTED', 'APEX', undefined, ladder)).toBeUndefined()
    expect(variantTierChoices('PUBLIC', undefined, ladder)).toHaveLength(3)
  })

  it('refuses a variant looser than a tier-restricted product', () => {
    expect(variantTierProblem('TIER_RESTRICTED', 'ACTIVE', 'SPROUT', ladder)).toMatch(/ACTIVE/)
    expect(variantTierProblem('TIER_RESTRICTED', 'ACTIVE', 'ACTIVE', ladder)).toBeUndefined()
    expect(variantTierChoices('TIER_RESTRICTED', 'ACTIVE', ladder).map((t) => t.code)).toEqual([
      'ACTIVE',
      'APEX',
    ])
  })

  it('refuses any variant tier on a customer-restricted product', () => {
    expect(variantTierProblem('CUSTOMER_RESTRICTED', undefined, 'APEX', ladder)).toMatch(/allowlist/)
    expect(variantTierChoices('CUSTOMER_RESTRICTED', undefined, ladder)).toEqual([])
  })

  it('leaves a code the ladder lacks to the server', () => {
    expect(variantTierProblem('TIER_RESTRICTED', 'ACTIVE', 'GONE', ladder)).toBeUndefined()
  })
})
