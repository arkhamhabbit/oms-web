import * as React from 'react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { isApiError } from '@/lib/api-error'
import {
  useEffectiveLadderQuery,
  useUserTierHistoryQuery,
  useUserTierQuery,
  type TierTransition,
} from '@/api/membership'

const HISTORY_PAGE_SIZE = 10

const REASON: Record<NonNullable<TierTransition['reason']>, string> = {
  PROVISIONED: 'Joined',
  PROMOTED: 'Promoted',
  MAINTAINED: 'Tier kept',
  DROPPED: 'Dropped a tier',
  LEGACY_START: 'Legacy start',
  VERSION_REEVALUATED: 'Ladder changed',
}

const points = (value: number | undefined) => (value ?? 0).toLocaleString('en-IN')
const when = (value: string | undefined) => (value ? new Date(value).toLocaleString() : '—')
const date = (value: string | undefined) => (value ? new Date(value).toLocaleDateString() : '—')

/**
 * A member's tier, read-only (D7.15). The tier is OMS state that only the server transitions —
 * there is deliberately no override here; none exists server-side. Tier codes are shown with the
 * name from the ladder in effect now, falling back to the bare code for one it no longer has.
 */
function MemberTierCard({ userId }: { userId: string }) {
  const tier = useUserTierQuery(userId)
  const ladder = useEffectiveLadderQuery()
  const [page, setPage] = React.useState(0)
  const history = useUserTierHistoryQuery(userId, page, HISTORY_PAGE_SIZE)

  const names = new Map((ladder.data ?? []).map((t) => [t.code, t.name]))
  const label = (code: string | undefined) => (code ? (names.get(code) ?? code) : '—')

  const state = tier.data
  const current = state?.tier

  return (
    <Card>
      <CardHeader>
        <CardTitle>Membership</CardTitle>
        <CardDescription>
          The tier is held as state and changes only on a promotion, a cycle end or a ladder change.
          Spending Bits never changes it.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {tier.isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}
        {tier.isError && (
          <p role="alert" className="text-sm text-destructive">
            {isApiError(tier.error) ? tier.error.message : 'Membership could not be loaded.'}
          </p>
        )}
        {state && !state.provisioned && (
          <p className="text-sm text-muted-foreground">
            Not a member yet — a customer becomes one when they claim their account, and starts on
            the first tier ({label(current?.tierCode)}).
          </p>
        )}
        {state && state.provisioned && (
          <dl className="grid gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-muted-foreground">Current tier</dt>
              <dd className="flex items-center gap-2 font-medium">
                {current?.tierName ?? label(current?.tierCode)}
                <span className="font-mono text-xs text-muted-foreground">{current?.tierCode}</span>
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Since</dt>
              <dd>{when(state.tierSince)}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Cycle</dt>
              <dd>
                {when(state.cycleStart)} → {when(state.cycleEnd)}
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Bits earned this cycle</dt>
              <dd>
                <strong>{points(state.pointsInCycle)}</strong> of{' '}
                {points(state.maintainThresholdPoints)} to maintain{' '}
                {(current?.rank ?? 0) <= 1 ? (
                  <Badge variant="outline">Base tier — nothing to maintain</Badge>
                ) : state.secured ? (
                  <Badge>Tier secured</Badge>
                ) : (
                  <Badge variant="secondary">In progress</Badge>
                )}
              </dd>
            </div>
            <div className="sm:col-span-2">
              <dt className="text-muted-foreground">Next tier</dt>
              <dd>
                {state.nextTierCode ? (
                  <>
                    {label(state.nextTierCode)} at {points(state.nextTierReachPoints)} Bits —{' '}
                    <strong>{points(state.pointsToNextTier)}</strong> to go
                  </>
                ) : (
                  'At the top tier'
                )}
              </dd>
            </div>
          </dl>
        )}

        <div className="flex flex-col gap-2">
          <h3 className="text-sm font-medium">History</h3>
          {history.isError && (
            <p role="alert" className="text-sm text-destructive">
              {isApiError(history.error)
                ? history.error.message
                : 'Tier history could not be loaded.'}
            </p>
          )}
          {history.data && (history.data.content ?? []).length === 0 && (
            <p className="text-sm text-muted-foreground">No tier history yet.</p>
          )}
          {(history.data?.content ?? []).length > 0 && (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>When</TableHead>
                  <TableHead>Reason</TableHead>
                  <TableHead>From → to</TableHead>
                  <TableHead>Cycle</TableHead>
                  <TableHead className="text-right">Bits in cycle</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {history.data!.content!.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell>{when(row.at)}</TableCell>
                    <TableCell>{row.reason ? REASON[row.reason] : '—'}</TableCell>
                    <TableCell>
                      {row.fromCode ? `${label(row.fromCode)} → ` : ''}
                      {label(row.toCode)}
                    </TableCell>
                    <TableCell>
                      {date(row.cycleStart)} – {date(row.cycleEnd)}
                    </TableCell>
                    <TableCell className="text-right">{points(row.pointsInCycle)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
          {(history.data?.totalPages ?? 0) > 1 && (
            <div className="flex items-center justify-end gap-2 text-sm">
              <Button
                variant="outline"
                size="sm"
                disabled={page === 0}
                onClick={() => setPage((p) => p - 1)}
              >
                Previous
              </Button>
              <span>
                Page {page + 1} of {history.data!.totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={page + 1 >= (history.data!.totalPages ?? 1)}
                onClick={() => setPage((p) => p + 1)}
              >
                Next
              </Button>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

export { MemberTierCard }
