export type CatalogStatus = 'DRAFT' | 'IN_REVIEW' | 'ACTIVE' | 'ARCHIVED'

export type CatalogTransitionAction = 'activate' | 'publish' | 'unpublish' | 'archive'

export interface CatalogTransitionDef {
  action: CatalogTransitionAction
  label: string
}

/** The past tense for the success toast: "Apparel archived". */
export const TRANSITION_DONE: Record<CatalogTransitionAction, string> = {
  activate: 'activated',
  publish: 'published',
  unpublish: 'unpublished',
  archive: 'archived',
}

const ALL_TRANSITIONS: Record<CatalogTransitionAction, string> = {
  activate: 'Activate',
  publish: 'Publish',
  unpublish: 'Unpublish',
  archive: 'Archive',
}

/**
 * D4.16: four transitions, only the ones valid from the current state. Mirrors
 * `CatalogStatus.canTransitionTo` and `CatalogEntity.publish/unpublish` on the OMS side —
 * `activate` from DRAFT/IN_REVIEW, `publish` only once ACTIVE and not already live, `unpublish`
 * only while live, `archive` from anything but ARCHIVED. This is convenience only (D2.17): the
 * server re-checks every one of these regardless of what this function offers.
 */
export function availableCatalogTransitions(
  status: CatalogStatus,
  live: boolean
): CatalogTransitionDef[] {
  const actions: CatalogTransitionAction[] = []

  if (status === 'DRAFT' || status === 'IN_REVIEW') {
    actions.push('activate')
  }
  if (status === 'ACTIVE' && !live) {
    actions.push('publish')
  }
  if (live) {
    actions.push('unpublish')
  }
  if (status !== 'ARCHIVED') {
    actions.push('archive')
  }

  return actions.map((action) => ({ action, label: ALL_TRANSITIONS[action] }))
}

/**
 * D4.23: restore is the fifth transition, and a deliberate one. It is not in the Actions menu —
 * it is the one action an archived item has, shown only when the item is ARCHIVED and the account
 * holds the entity's publish key (the key that archives it). Convenience only (D2.17).
 */
export function canRestore(status: string | undefined, canPublish: boolean): boolean {
  return status === 'ARCHIVED' && canPublish
}

/** What the confirm says: it comes back Active, and stays off sale until published. */
export function restorePrompt(name: string): string {
  return `Restore ${name}? It comes back as Active and stays off sale until you publish it.`
}

/** Shown on an archived item's page, where its edit controls stay disabled. */
export const ARCHIVED_NOTICE = 'Archived — restore to edit'
