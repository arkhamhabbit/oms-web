import { useMemo } from 'react'

import { useProfileQuery } from '@/api/auth'

/**
 * The current member's own effective permissions (from `GET /api/admin/profile`), for nav
 * and action gating. **Convenience only (D2.17)** — hiding a button here changes nothing
 * about what the server will accept; every one of these permissions is re-checked there on
 * every request regardless of what this hook says.
 */
export function usePermissions() {
  const profile = useProfileQuery()
  const permissions = useMemo(() => new Set(profile.data?.permissions ?? []), [profile.data])

  return {
    permissions,
    has: (key: string) => permissions.has(key),
    isLoading: profile.isLoading,
  }
}
