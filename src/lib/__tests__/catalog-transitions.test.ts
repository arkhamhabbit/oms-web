import { describe, expect, it } from 'vitest'

import { availableCatalogTransitions } from '@/lib/catalog-transitions'

function actionsFor(status: Parameters<typeof availableCatalogTransitions>[0], live: boolean) {
  return availableCatalogTransitions(status, live).map((t) => t.action)
}

describe('availableCatalogTransitions', () => {
  it('offers only activate and archive from DRAFT', () => {
    expect(actionsFor('DRAFT', false)).toEqual(['activate', 'archive'])
  })

  it('offers only activate and archive from IN_REVIEW', () => {
    expect(actionsFor('IN_REVIEW', false)).toEqual(['activate', 'archive'])
  })

  it('offers publish and archive from ACTIVE while not live', () => {
    expect(actionsFor('ACTIVE', false)).toEqual(['publish', 'archive'])
  })

  it('offers unpublish and archive from ACTIVE while live — not publish again', () => {
    expect(actionsFor('ACTIVE', true)).toEqual(['unpublish', 'archive'])
  })

  it('offers nothing once ARCHIVED, even if the live flag were somehow still set', () => {
    expect(actionsFor('ARCHIVED', false)).toEqual([])
    expect(actionsFor('ARCHIVED', true)).toEqual(['unpublish'])
  })

  it('never offers a transition the entity cannot structurally take (D4.16: four, not two)', () => {
    // DRAFT can never be "published" directly — it must activate first.
    expect(actionsFor('DRAFT', false)).not.toContain('publish')
  })
})
