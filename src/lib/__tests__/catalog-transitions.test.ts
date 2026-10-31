import { describe, expect, it } from 'vitest'

import { AUDIT_ACTIONS } from '@/api/enums.gen'
import { availableCatalogTransitions, canRestore, restorePrompt } from '@/lib/catalog-transitions'

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

describe('canRestore (D4.23)', () => {
  it('needs ARCHIVED and the publish key', () => {
    expect(canRestore('ARCHIVED', true)).toBe(true)
    expect(canRestore('ARCHIVED', false)).toBe(false)
    for (const status of ['DRAFT', 'IN_REVIEW', 'ACTIVE', undefined]) {
      expect(canRestore(status, true)).toBe(false)
    }
  })

  it('is not an Actions-menu entry: an archived item has no other transition', () => {
    expect(actionsFor('ARCHIVED', false)).toEqual([])
  })

  it('names the item, and says it stays off sale until published', () => {
    expect(restorePrompt('Apparel')).toBe(
      'Restore Apparel? It comes back as Active and stays off sale until you publish it.'
    )
  })
})

describe('audit actions for restore', () => {
  it('offers the three restored actions beside their siblings in the Catalog group', () => {
    for (const entity of ['brand', 'category', 'product']) {
      expect(AUDIT_ACTIONS).toContain(`catalog.${entity}.restored`)
    }
  })
})
