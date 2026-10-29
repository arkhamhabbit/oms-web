import type * as React from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeftIcon } from 'lucide-react'

import ForbiddenPage from '@/pages/ForbiddenPage'
import { ApiClientError, isApiError } from '@/lib/api-error'

function BackLink({ to, label }: { to: string; label: string }) {
  return (
    <Link
      to={to}
      className="inline-flex w-fit items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
    >
      <ArrowLeftIcon className="size-4" /> {label}
    </Link>
  )
}

function Facts({ rows }: { rows: [string, React.ReactNode][] }) {
  return (
    <dl className="grid gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
      {rows.map(([label, value]) => (
        <div key={label}>
          <dt className="text-muted-foreground">{label}</dt>
          <dd className="font-medium break-words">{value || '—'}</dd>
        </div>
      ))}
    </dl>
  )
}

/**
 * What a failed detail read looks like: the 403 page naming the key the server wanted, "was not
 * found" for a 404 (inside the page, with a way back), the server's sentence for anything else.
 */
function DetailError({
  error,
  noun,
  back,
  permission,
}: {
  error: unknown
  noun: string
  back: { to: string; label: string }
  permission: string
}) {
  if (error instanceof ApiClientError && error.status === 403) {
    return <ForbiddenPage permission={permission} />
  }
  const message =
    error instanceof ApiClientError && error.status === 404
      ? `This ${noun} was not found.`
      : isApiError(error)
        ? error.message
        : `This ${noun} could not be loaded.`
  return (
    <div className="flex flex-col gap-3">
      <BackLink to={back.to} label={back.label} />
      <p role="alert" className="text-sm">
        {message}
      </p>
    </div>
  )
}

/** A list query's failure line, in the server's own words. */
function ListError({ error, what }: { error: unknown; what: string }) {
  return (
    <p role="alert" className="text-sm text-destructive">
      {isApiError(error) ? error.message : `${what} could not be loaded.`}
    </p>
  )
}

export { BackLink, DetailError, Facts, ListError }
