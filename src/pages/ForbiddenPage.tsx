import { ShieldAlert } from 'lucide-react'

import { useBreadcrumb } from '@/layouts/breadcrumb-context'

/**
 * Rendered in place of a screen the current member lacks the permission for — not a
 * redirect, not a blank page (see W0.1b done-criteria). Reached either because the server
 * itself returned 403 on a real request, or because `RequirePermission` already knew from
 * `profile.permissions` not to bother asking.
 */
function ForbiddenPage({ permission }: { permission?: string }) {
  useBreadcrumb([{ label: 'Not permitted' }])

  return (
    <div className="flex h-64 flex-col items-center justify-center gap-2 rounded-lg border border-dashed text-center">
      <ShieldAlert className="size-8 text-muted-foreground" />
      <p className="font-medium">You don't have permission to view this</p>
      {permission && (
        <p className="text-sm text-muted-foreground">
          Requires <code className="font-mono">{permission}</code>
        </p>
      )}
    </div>
  )
}

export default ForbiddenPage
