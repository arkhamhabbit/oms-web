import * as React from 'react'
import { useSearchParams } from 'react-router-dom'
import type { ColumnDef } from '@tanstack/react-table'
import { PlusIcon, SendIcon } from 'lucide-react'

import { DataTable } from '@/components/data-table/DataTable'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { InviteDetailDialog } from '@/components/invites/InviteDetailDialog'
import { INVITE_STATUS, InviteStatusBadge } from '@/components/invites/InviteStatusBadge'
import { IssueInviteDialog } from '@/components/invites/IssueInviteDialog'
import { useBreadcrumb } from '@/layouts/breadcrumb-context'
import { usePermissions } from '@/auth/usePermissions'
import { isApiError } from '@/lib/api-error'
import { INVITE_STATUSES } from '@/api/enums.gen'
import {
  useInvitesQuery,
  useWaitlistQuery,
  type Invite,
  type InviteStatus,
  type WaitlistEntry,
} from '@/api/invites'

const PAGE_SIZE = 20

function formatDate(value: string | undefined) {
  return value ? new Date(value).toLocaleString() : ''
}

type Tab = 'invites' | 'waitlist'

function InvitesPage() {
  useBreadcrumb([{ label: 'Invites' }])
  const [params, setParams] = useSearchParams()
  const tab: Tab = params.get('tab') === 'waitlist' ? 'waitlist' : 'invites'
  const { has } = usePermissions()
  const canWrite = has('invite.write')

  return (
    <div className="flex flex-col gap-4">
      <div className="flex gap-2 border-b pb-2">
        <Button
          size="sm"
          variant={tab === 'invites' ? 'default' : 'ghost'}
          onClick={() => setParams({}, { replace: true })}
        >
          Invites
        </Button>
        <Button
          size="sm"
          variant={tab === 'waitlist' ? 'default' : 'ghost'}
          onClick={() => setParams({ tab: 'waitlist' }, { replace: true })}
        >
          Waitlist
        </Button>
      </div>
      {tab === 'invites' ? <InvitesTab canWrite={canWrite} /> : <WaitlistTab canWrite={canWrite} />}
    </div>
  )
}

function InvitesTab({ canWrite }: { canWrite: boolean }) {
  const [pageIndex, setPageIndex] = React.useState(0)
  const [status, setStatus] = React.useState<InviteStatus | 'ALL'>('ALL')
  const [issueOpen, setIssueOpen] = React.useState(false)
  const [openId, setOpenId] = React.useState<string | undefined>()

  const invites = useInvitesQuery({
    page: pageIndex,
    size: PAGE_SIZE,
    status: status === 'ALL' ? undefined : status,
  })

  const columns: ColumnDef<Invite, unknown>[] = [
    {
      id: 'mobile',
      header: 'Mobile',
      cell: ({ row }) => <span className="font-mono">{row.original.mobile}</span>,
    },
    {
      id: 'status',
      header: 'Status',
      cell: ({ row }) => <InviteStatusBadge status={row.original.status} />,
    },
    {
      id: 'issuer',
      header: 'Issued by',
      cell: ({ row }) => (row.original.issuerKind === 'INSIDER' ? 'Insider' : 'Admin'),
    },
    { id: 'issuedAt', header: 'Issued', cell: ({ row }) => formatDate(row.original.issuedAt) },
    { id: 'expiresAt', header: 'Expires', cell: ({ row }) => formatDate(row.original.expiresAt) },
  ]

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Select
          value={status}
          onValueChange={(value) => {
            setStatus(value as InviteStatus | 'ALL')
            setPageIndex(0)
          }}
        >
          <SelectTrigger className="w-44" aria-label="Status filter">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All statuses</SelectItem>
            {INVITE_STATUSES.map((s) => (
              <SelectItem key={s} value={s}>
                {INVITE_STATUS[s].label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button disabled={!canWrite} onClick={() => setIssueOpen(true)}>
          <PlusIcon /> Issue invite
        </Button>
      </div>

      {invites.isError && (
        <p role="alert" className="text-sm text-destructive">
          {isApiError(invites.error) ? invites.error.message : 'Invites could not be loaded.'}
        </p>
      )}

      <DataTable
        columns={columns}
        data={invites.data?.content ?? []}
        isLoading={invites.isLoading}
        emptyMessage="No invites match this filter."
        onRowClick={(invite) => setOpenId(invite.id)}
        serverPagination={{
          pageIndex,
          pageSize: PAGE_SIZE,
          pageCount: invites.data?.totalPages ?? 0,
          totalElements: invites.data?.totalElements ?? 0,
          onPageIndexChange: setPageIndex,
        }}
      />

      <IssueInviteDialog open={issueOpen} onOpenChange={setIssueOpen} />
      <InviteDetailDialog
        inviteId={openId}
        canWrite={canWrite}
        onOpenChange={(open) => !open && setOpenId(undefined)}
      />
    </>
  )
}

function WaitlistTab({ canWrite }: { canWrite: boolean }) {
  const [pageIndex, setPageIndex] = React.useState(0)
  const [waitingOnly, setWaitingOnly] = React.useState(true)
  const [entry, setEntry] = React.useState<{ id: string; mobile: string } | undefined>()

  const waitlist = useWaitlistQuery({ page: pageIndex, size: PAGE_SIZE, waitingOnly })

  const columns: ColumnDef<WaitlistEntry, unknown>[] = [
    {
      id: 'mobile',
      header: 'Mobile',
      cell: ({ row }) => <span className="font-mono">{row.original.mobile}</span>,
    },
    {
      id: 'firstSeen',
      header: 'First seen',
      cell: ({ row }) => formatDate(row.original.firstSeenAt),
    },
    { id: 'lastSeen', header: 'Last seen', cell: ({ row }) => formatDate(row.original.lastSeenAt) },
    {
      id: 'invited',
      header: 'Invited',
      cell: ({ row }) => formatDate(row.original.invitedAt) || 'Waiting',
    },
    {
      id: 'actions',
      header: '',
      cell: ({ row }) =>
        !row.original.invitedAt && (
          <Button
            size="sm"
            variant="outline"
            disabled={!canWrite}
            onClick={() => setEntry({ id: row.original.id!, mobile: row.original.mobile! })}
          >
            <SendIcon /> Invite
          </Button>
        ),
    },
  ]

  return (
    <>
      <p className="max-w-3xl text-sm text-muted-foreground">
        Numbers that verified an OTP in the app without an invite, earliest first.
      </p>
      <div className="flex items-center gap-2">
        <Switch
          id="waiting-only"
          checked={waitingOnly}
          onCheckedChange={(checked) => {
            setWaitingOnly(checked)
            setPageIndex(0)
          }}
        />
        <Label htmlFor="waiting-only">Still waiting only</Label>
      </div>

      {waitlist.isError && (
        <p role="alert" className="text-sm text-destructive">
          {isApiError(waitlist.error)
            ? waitlist.error.message
            : 'The waitlist could not be loaded.'}
        </p>
      )}

      <DataTable
        columns={columns}
        data={waitlist.data?.content ?? []}
        isLoading={waitlist.isLoading}
        emptyMessage={waitingOnly ? 'Nobody is waiting.' : 'The waitlist is empty.'}
        serverPagination={{
          pageIndex,
          pageSize: PAGE_SIZE,
          pageCount: waitlist.data?.totalPages ?? 0,
          totalElements: waitlist.data?.totalElements ?? 0,
          onPageIndexChange: setPageIndex,
        }}
      />

      <IssueInviteDialog
        open={!!entry}
        onOpenChange={(open) => !open && setEntry(undefined)}
        waitlistEntry={entry}
      />
    </>
  )
}

export default InvitesPage
