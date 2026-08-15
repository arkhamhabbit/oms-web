import { Navigate, Outlet, useLocation } from 'react-router-dom'

import { useProfileQuery } from '@/api/auth'

function FullPageLoader() {
  return (
    <div className="flex h-svh w-full items-center justify-center text-sm text-muted-foreground">
      Loading…
    </div>
  )
}

/**
 * Gates every screen behind the app shell. Three outcomes for an unauthenticated or
 * not-yet-known session: still loading, definitely logged out (401 already triggered the
 * global cache-clear + redirect in `api/client.ts` — this is the belt-and-braces path for a
 * direct render before that fires), or mid-force-password-change and not allowed past it.
 */
function RequireAuth() {
  const profile = useProfileQuery()
  const location = useLocation()

  if (profile.isPending) {
    return <FullPageLoader />
  }

  if (profile.isError) {
    return <Navigate to="/login" replace state={{ from: location }} />
  }

  if (profile.data.mustChangePassword) {
    return <Navigate to="/force-password-change" replace />
  }

  return <Outlet />
}

export default RequireAuth
