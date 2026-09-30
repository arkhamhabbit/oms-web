import { describe, expect, it } from 'vitest'

import { requiredTierCodeFor, visibilitySaveProblem } from '@/lib/visibility'

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
