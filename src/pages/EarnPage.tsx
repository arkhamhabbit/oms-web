import * as React from 'react'
import { useNavigate } from 'react-router-dom'
import type { ColumnDef } from '@tanstack/react-table'
import { PlusIcon } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { DataTable } from '@/components/data-table/DataTable'
import { PricingStateBadge } from '@/components/pricing/PricingStateBadge'
import { EarnRulesSummary } from '@/components/earn/EarnRulesSummary'
import { EarnVersionCreateDialog } from '@/components/earn/EarnVersionCreateDialog'
import { useBreadcrumb } from '@/layouts/breadcrumb-context'
import { usePermissions } from '@/auth/usePermissions'
import { isApiError } from '@/lib/api-error'
import { useEarnRulesVersionsQuery, useEffectiveEarnRulesQuery, type EarnRules } from '@/api/earn'
import { formatDateTime } from '@/lib/dates'

const PAGE_SIZE = 20


function EarnPage() {
  useBreadcrumb([{ label: 'Earn rules' }])
  const navigate = useNavigate()
  const { has } = usePermissions()
  const canWrite = has('earn.write')

  const [pageIndex, setPageIndex] = React.useState(0)
  const [createOpen, setCreateOpen] = React.useState(false)
  const versions = useEarnRulesVersionsQuery({ page: pageIndex, size: PAGE_SIZE })
  const effective = useEffectiveEarnRulesQuery()

  const columns: ColumnDef<EarnRules, unknown>[] = [
    { accessorKey: 'name', header: 'Name' },
    {
      id: 'state',
      header: 'State',
      cell: ({ row }) => <PricingStateBadge state={row.original.state} />,
    },
    {
      id: 'welcome',
      header: 'Welcome Bits',
      cell: ({ row }) => (row.original.welcomePoints ?? 0).toLocaleString('en-IN'),
    },
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
        Earn rules are the amounts the system pays out: the welcome bonus, referral rewards and the
        order-time Bits. Every amount is a parameter you set here; each earn records the version
        that set it. Exactly one version is in effect at any moment; a change is a new draft.
      </p>

      <Card>
        <CardHeader>
          <CardTitle>
            In effect now{effective.data?.name ? `: ${effective.data.name}` : ''}
          </CardTitle>
          <CardDescription>
            {effective.data?.effectiveFrom
              ? `Took effect ${formatDateTime(effective.data.effectiveFrom)}`
              : 'The amounts every new earn uses today.'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {effective.isError ? (
            <p role="alert" className="text-sm text-destructive">
              {isApiError(effective.error)
                ? effective.error.message
                : 'The effective earn rules could not be loaded.'}
            </p>
          ) : (
            effective.data && <EarnRulesSummary rules={effective.data} />
          )}
        </CardContent>
      </Card>

      <div className="flex items-center justify-between gap-2">
        <h2 className="text-base font-semibold">Versions</h2>
        <Button disabled={!canWrite} onClick={() => setCreateOpen(true)}>
          <PlusIcon /> New draft
        </Button>
      </div>
      {!canWrite && (
        <p className="-mt-2 text-xs text-muted-foreground">
          Creating a draft needs <code>earn.write</code>
        </p>
      )}

      {versions.isError && (
        <p role="alert" className="text-sm text-destructive">
          {isApiError(versions.error)
            ? versions.error.message
            : 'Earn rules versions could not be loaded.'}
        </p>
      )}

      <DataTable
        columns={columns}
        data={versions.data?.content ?? []}
        isLoading={versions.isLoading}
        emptyMessage="No earn rules versions."
        onRowClick={(version) => navigate(`/earn/${version.id}`)}
        serverPagination={{
          pageIndex,
          pageSize: PAGE_SIZE,
          pageCount: versions.data?.totalPages ?? 0,
          totalElements: versions.data?.totalElements ?? 0,
          onPageIndexChange: setPageIndex,
        }}
      />

      <EarnVersionCreateDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreated={(id) => navigate(`/earn/${id}`)}
      />
    </div>
  )
}

export default EarnPage
