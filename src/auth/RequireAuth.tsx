import { Navigate, Outlet, useLocation } from 'react-router-dom'

import { useProfileQuery } from '@/api/auth'
import { Button } from '@/components/ui/button'
import { ApiClientError } from '@/lib/api-error'

function FullPageLoader() {
  return (
    <div className="flex h-svh w-full items-center justify-center text-sm text-muted-foreground">
      Loading…
    </div>
  )
}

function FullPageErrorState({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="flex h-svh w-full flex-col items-center justify-center gap-3 text-sm text-muted-foreground">
      <p>Could not reach OMS. Your session may still be fine — this may just be the server.</p>
      <Button variant="outline" size="sm" onClick={onRetry}>
        Retry
      </Button>
    </div>
  )
}

/**
 * Gates every screen behind the app shell. Outcomes for an unauthenticated or not-yet-known
 * session: still loading, definitely logged out, a server hiccup that says nothing about the
 * session, or mid-force-password-change and not allowed past it.
 *
 * <p>Only a **401** on this query means "the session is dead" — a 500 (found in a real
 * browser: a transient `ObjectOptimisticLockingFailureException` on the session's sliding-expiry
 * touch under concurrent requests, an OMS-core issue, not this UI's) is not proof of that, and
 * treating it as one bounced a member to `/login`, which then bounced them straight back to `/`
 * once the retry succeeded — losing whatever screen they were navigating to. Same shape as the
 * D2.21 401-vs-401 bug: two independently reasonable pieces of routing logic, wrong only in
 * combination, invisible to a test that mocks the query instead of hitting a real server.
 */
function RequireAuth() {
  const profile = useProfileQuery()
  const location = useLocation()

  if (profile.isPending) {
    return <FullPageLoader />
  }

  if (profile.isError) {
    const sessionIsDead = profile.error instanceof ApiClientError && profile.error.status === 401
    if (sessionIsDead) {
      return <Navigate to="/login" replace state={{ from: location }} />
    }
    return <FullPageErrorState onRetry={() => profile.refetch()} />
  }

  if (profile.data.mustChangePassword) {
    return <Navigate to="/force-password-change" replace />
  }

  return <Outlet />
}

export default RequireAuth
