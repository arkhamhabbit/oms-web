import { describe, expect, it } from 'vitest'

import { availableProductTransitions } from '@/lib/product-transitions'

describe('availableProductTransitions', () => {
  it('offers only submit from DRAFT', () => {
    const actions = availableProductTransitions('DRAFT', false).map((t) => t.action)
    expect(actions).toEqual(['submit', 'archive'])
  })

  it('offers approve and reject from IN_REVIEW', () => {
    const actions = availableProductTransitions('IN_REVIEW', false).map((t) => t.action)
    expect(actions).toEqual(['approve', 'reject', 'archive'])
  })

  it('offers publish once ACTIVE and not live', () => {
    const actions = availableProductTransitions('ACTIVE', false).map((t) => t.action)
    expect(actions).toEqual(['publish', 'archive'])
  })

  it('offers unpublish while live, never publish at the same time', () => {
    const actions = availableProductTransitions('ACTIVE', true).map((t) => t.action)
    expect(actions).toEqual(['unpublish', 'archive'])
  })

  it('offers nothing but nothing is wrong from ARCHIVED — no archive either', () => {
    const actions = availableProductTransitions('ARCHIVED', false).map((t) => t.action)
    expect(actions).toEqual([])
  })

  it('archive is offered from every non-archived status', () => {
    for (const status of ['DRAFT', 'IN_REVIEW', 'ACTIVE'] as const) {
      expect(availableProductTransitions(status, false).map((t) => t.action)).toContain('archive')
    }
  })
})
