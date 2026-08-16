export type CatalogStatus = 'DRAFT' | 'IN_REVIEW' | 'ACTIVE' | 'ARCHIVED'

export type CatalogTransitionAction = 'activate' | 'publish' | 'unpublish' | 'archive'

export interface CatalogTransitionDef {
  action: CatalogTransitionAction
  label: string
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
