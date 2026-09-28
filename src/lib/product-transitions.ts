export type ProductStatus = 'DRAFT' | 'IN_REVIEW' | 'ACTIVE' | 'ARCHIVED'

export type ProductTransitionAction =
  | 'submit'
  | 'approve'
  | 'reject'
  | 'publish'
  | 'unpublish'
  | 'archive'

export type ProductTransitionPermission =
  | 'catalog.product.write'
  | 'catalog.product.approve'
  | 'catalog.product.publish'

export interface ProductTransitionDef {
  action: ProductTransitionAction
  label: string
  permission: ProductTransitionPermission
}

const ALL_TRANSITIONS: Record<ProductTransitionAction, Omit<ProductTransitionDef, 'action'>> = {
  submit: { label: 'Submit for review', permission: 'catalog.product.write' },
  approve: { label: 'Approve', permission: 'catalog.product.approve' },
  reject: { label: 'Reject to draft', permission: 'catalog.product.approve' },
  publish: { label: 'Publish', permission: 'catalog.product.publish' },
  unpublish: { label: 'Unpublish', permission: 'catalog.product.publish' },
  archive: { label: 'Archive', permission: 'catalog.product.publish' },
}

/**
 * D4.16: products have two extra transitions brands/categories don't (`submit`, `approve` covers
 * `IN_REVIEW -> ACTIVE`, `reject` sends a submission back). Mirrors `ProductService` on the OMS
 * side as best this client can infer — **the contract does not expose valid-next-transitions
 * explicitly** (no `availableActions`/`allowedTransitions` field on `ProductResponse`), so this is
 * inferred from `status`/`live` the same way `catalog-transitions.ts` does for brands/categories.
 * Flagged as a contract gap in the task's Status block: if OMS's real transition guard ever
 * diverges from this (e.g. a rule this function doesn't know about), the button would show and
 * the server would then refuse it with a sentence (D2.17 — convenience only, never security).
 */
export function availableProductTransitions(
  status: ProductStatus,
  live: boolean
): ProductTransitionDef[] {
  const actions: ProductTransitionAction[] = []

  if (status === 'DRAFT') {
    actions.push('submit')
  }
  if (status === 'IN_REVIEW') {
    actions.push('approve', 'reject')
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

  return actions.map((action) => ({ action, ...ALL_TRANSITIONS[action] }))
}
