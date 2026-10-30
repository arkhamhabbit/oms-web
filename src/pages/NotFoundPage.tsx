import { Compass } from 'lucide-react'
import { Link } from 'react-router-dom'

import { Button } from '@/components/ui/button'
import { useBreadcrumb } from '@/layouts/breadcrumb-context'

/** An address that matches no screen, drawn inside the shell so the navigation stays at hand. */
function NotFoundPage() {
  useBreadcrumb([{ label: 'Page not found' }])

  return (
    <div className="flex h-64 flex-col items-center justify-center gap-2 rounded-lg border border-dashed text-center">
      <Compass className="size-8 text-muted-foreground" />
      <p className="font-medium">This page does not exist</p>
      <p className="text-sm text-muted-foreground">The address may be mistyped or out of date.</p>
      <Button asChild variant="outline" size="sm" className="mt-2">
        <Link to="/">Back to the dashboard</Link>
      </Button>
    </div>
  )
}

export default NotFoundPage
