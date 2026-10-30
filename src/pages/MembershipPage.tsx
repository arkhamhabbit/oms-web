import * as React from 'react'
import { useNavigate } from 'react-router-dom'
import type { ColumnDef } from '@tanstack/react-table'
import { PlayIcon, PlusIcon } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { DataTable } from '@/components/data-table/DataTable'
import { ConfirmDialog } from '@/components/common/ConfirmDialog'
import { NoticeBanner, noticeFromError, type Notice } from '@/components/common/NoticeBanner'
import { PricingStateBadge } from '@/components/pricing/PricingStateBadge'
import { MembershipVersionCreateDialog } from '@/components/membership/MembershipVersionCreateDialog'
import { TierLadderTable } from '@/components/membership/TierLadderTable'
import { useBreadcrumb } from '@/layouts/breadcrumb-context'
import { usePermissions } from '@/auth/usePermissions'
import { isApiError } from '@/lib/api-error'
import {
  useEffectiveVersionQuery,
  useMembershipVersionsQuery,
  useRunCyclesMutation,
  type CycleRun,
  type MembershipVersion,
} from '@/api/membership'
import { formatDateTime } from '@/lib/dates'

const PAGE_SIZE = 20


function MembershipPage() {
  useBreadcrumb([{ label: 'Membership' }])
  const navigate = useNavigate()
  const { has } = usePermissions()
  const canWrite = has('membership.write')

  const [pageIndex, setPageIndex] = React.useState(0)
  const [createOpen, setCreateOpen] = React.useState(false)
  const versions = useMembershipVersionsQuery({ page: pageIndex, size: PAGE_SIZE })
  const effective = useEffectiveVersionQuery()

  const columns: ColumnDef<MembershipVersion, unknown>[] = [
    { accessorKey: 'name', header: 'Name' },
    {
      id: 'state',
      header: 'State',
      cell: ({ row }) => <PricingStateBadge state={row.original.state} />,
    },
    { id: 'tiers', header: 'Tiers', cell: ({ row }) => row.original.tiers?.length ?? 0 },
    {
      id: 'effectiveFrom',
      header: 'Effective from',
      cell: ({ row }) => formatDateTime(row.original.effectiveFrom) || '—',
    },
    { id: 'updatedAt', header: 'Updated', cell: ({ row }) => formatDateTime(row.original.updatedAt) },
  ]

  return (
    <div className="flex flex-col gap-4">
      <p className="max-w-3xl text-sm text-muted-foreground">
        A membership version is the tier ladder: each tier&apos;s reach and maintain thresholds and
        its benefits. A member runs in 12-month cycles from registration, is promoted the moment
        they reach a tier, and at each cycle&apos;s end keeps their tier or drops exactly one.
        Exactly one version is in effect at any moment; a change is a new draft.
      </p>

      <Card>
        <CardHeader className="flex-row items-start justify-between gap-3">
          <div className="flex flex-col gap-1.5">
            <CardTitle>
              In effect now{effective.data?.name ? `: ${effective.data.name}` : ''}
            </CardTitle>
            <CardDescription>
              {effective.data?.effectiveFrom
                ? `Took effect ${formatDateTime(effective.data.effectiveFrom)}`
                : 'The ladder every member is resolved against today.'}
            </CardDescription>
          </div>
          <RunCyclesAction />
        </CardHeader>
        <CardContent>
          {effective.isError ? (
            <p role="alert" className="text-sm text-destructive">
              {isApiError(effective.error)
                ? effective.error.message
                : 'The effective ladder could not be loaded.'}
            </p>
          ) : (
            <TierLadderTable tiers={effective.data?.tiers ?? []} />
          )}
        </CardContent>
      </Card>

      <div className="flex items-center justify-between gap-2">
        <h2 className="text-base font-semibold">Versions</h2>
        <Button disabled={!canWrite} onClick={() => setCreateOpen(true)}>
          <PlusIcon /> New draft
        </Button>
      </div>

      {versions.isError && (
        <p role="alert" className="text-sm text-destructive">
          {isApiError(versions.error)
            ? versions.error.message
            : 'Membership versions could not be loaded.'}
        </p>
      )}

      <DataTable
        columns={columns}
        data={versions.data?.content ?? []}
        isLoading={versions.isLoading}
        emptyMessage="No membership versions."
        onRowClick={(version) => navigate(`/membership/${version.id}`)}
        serverPagination={{
          pageIndex,
          pageSize: PAGE_SIZE,
          pageCount: versions.data?.totalPages ?? 0,
          totalElements: versions.data?.totalElements ?? 0,
          onPageIndexChange: setPageIndex,
        }}
      />

      <MembershipVersionCreateDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreated={(id) => navigate(`/membership/${id}`)}
      />
    </div>
  )
}

/**
 * "Run cycle evaluation now" — what the 00:05 IST sweep does, on demand. It can drop members a
 * tier, so it has its own permission (`membership.cycles.run`) and says so before it runs. The
 * server audits every run.
 */
function RunCyclesAction() {
  const { has } = usePermissions()
  const canRun = has('membership.cycles.run')
  const run = useRunCyclesMutation()
  const [open, setOpen] = React.useState(false)
  const [result, setResult] = React.useState<CycleRun | undefined>()
  const [notice, setNotice] = React.useState<Notice | undefined>()

  function confirm() {
    run
      .mutateAsync()
      .then((summary) => {
        setOpen(false)
        setNotice(undefined)
        setResult(summary)
      })
      .catch((error) => {
        setOpen(false)
        setResult(undefined)
        setNotice(noticeFromError(error, 'The cycle evaluation'))
      })
  }

  return (
    <div className="flex max-w-sm flex-col items-end gap-2">
      <Button
        variant="outline"
        disabled={!canRun}
        title={canRun ? undefined : 'Needs the membership.cycles.run permission'}
        onClick={() => setOpen(true)}
      >
        <PlayIcon /> Run cycle evaluation now
      </Button>
      {!canRun && (
        <span className="text-xs text-muted-foreground">
          Needs <code>membership.cycles.run</code>
        </span>
      )}
      {result && (
        <p role="status" className="text-right text-sm">
          Evaluated <strong>{result.evaluated ?? 0}</strong> member
          {result.evaluated === 1 ? '' : 's'} · <strong>{result.transitions ?? 0}</strong>{' '}
          transition{result.transitions === 1 ? '' : 's'}
          {(result.failed ?? 0) > 0 && (
            <span className="text-destructive">
              {' '}
              · {result.failed} failed (the next run retries them)
            </span>
          )}
        </p>
      )}
      {notice && (
        <NoticeBanner
          notice={notice}
          onReload={() => setNotice(undefined)}
          onDismiss={() => setNotice(undefined)}
        />
      )}

      <ConfirmDialog
        open={open}
        onOpenChange={setOpen}
        title="Run cycle evaluation now"
        confirmLabel="Run evaluation"
        destructive
        pending={run.isPending}
        onConfirm={confirm}
      >
        <p>
          Every member whose 12-month cycle has ended is evaluated now: one who earned at least
          their tier&apos;s maintain threshold keeps it, anyone short of it{' '}
          <strong>drops exactly one tier</strong>. Members evaluated under an older ladder are
          re-mapped.
        </p>
        <p>
          Safe to repeat — a cycle end is decided once. The run is audited, and the transitions it
          writes carry you as the actor.
        </p>
      </ConfirmDialog>
    </div>
  )
}

export default MembershipPage
