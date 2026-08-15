import type { ReactNode } from 'react'

import { usePermissions } from '@/auth/usePermissions'
import ForbiddenPage from '@/pages/ForbiddenPage'

/**
 * Route-level permission gate. Same convenience-only caveat as `usePermissions` (D2.17):
 * this stops a hidden nav item from still being reachable by typing the URL, it does not
 * stand in for the server rejecting the underlying endpoint — that's verified independently
 * against the real API, not through this component.
 */
function RequirePermission({ permission, children }: { permission: string; children: ReactNode }) {
  const { has, isLoading } = usePermissions()

  if (isLoading) {
    return null
  }

  if (!has(permission)) {
    return <ForbiddenPage permission={permission} />
  }

  return children
}

export default RequirePermission
