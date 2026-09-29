import * as React from 'react'
import { useNavigate } from 'react-router-dom'
import type { ColumnDef } from '@tanstack/react-table'
import { PlusIcon } from 'lucide-react'

import { DataTable } from '@/components/data-table/DataTable'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { MemberStatusBadge } from '@/components/team/MemberStatusBadge'
import { MemberCreateDialog } from '@/components/team/MemberCreateDialog'
import { useBreadcrumb } from '@/layouts/breadcrumb-context'
import { usePermissions } from '@/auth/usePermissions'
import { useRolesQuery } from '@/api/roles'
import { useTeamMembersQuery, type TeamMember, type TeamMemberStatus } from '@/api/team'

const PAGE_SIZE = 20
const STATUS_OPTIONS: TeamMemberStatus[] = ['INVITED', 'ACTIVE', 'SUSPENDED', 'DEACTIVATED']

function formatLastActive(value: string | undefined) {
  return value ? new Date(value).toLocaleString() : 'Never'
}

function TeamPage() {
  useBreadcrumb([{ label: 'Team' }])
  const navigate = useNavigate()
  const { has } = usePermissions()
  const canManage = has('team.manage')

  const [pageIndex, setPageIndex] = React.useState(0)
  const [status, setStatus] = React.useState<TeamMemberStatus | 'ALL'>('ALL')
  const [roleId, setRoleId] = React.useState('ALL')
  const [search, setSearch] = React.useState('')
  const [createOpen, setCreateOpen] = React.useState(false)

  const roles = useRolesQuery()

  // Status, role, search and paging are all server-side (0.8 added role + search).
  const members = useTeamMembersQuery({
    page: pageIndex,
    size: PAGE_SIZE,
    status: status === 'ALL' ? undefined : status,
    roleId: roleId === 'ALL' ? undefined : roleId,
    search: search.trim(),
  })
  const rows = members.data?.content ?? []

  const columns: ColumnDef<TeamMember, unknown>[] = [
    { accessorKey: 'name', header: 'Name' },
    { accessorKey: 'email', header: 'Email' },
    {
      id: 'status',
      header: 'Status',
      cell: ({ row }) => (
        <MemberStatusBadge status={row.original.status} locked={row.original.locked} />
      ),
    },
    {
      id: 'roles',
      header: 'Roles',
      cell: ({ row }) => (
        <div className="flex flex-wrap gap-1">
          {(row.original.roles ?? []).length === 0 ? (
            <span className="text-muted-foreground">None</span>
          ) : (
            row.original.roles!.map((r) => (
              <Badge key={r.id} variant={r.systemRole ? 'default' : 'secondary'}>
                {r.name}
              </Badge>
            ))
          )}
        </div>
      ),
    },
    {
      id: 'lastActive',
      header: 'Last active',
      cell: ({ row }) => formatLastActive(row.original.lastActiveAt),
    },
  ]

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <Input
            placeholder="Search name or email…"
            value={search}
            onChange={(event) => {
              setSearch(event.target.value)
              setPageIndex(0)
            }}
            className="w-64"
          />
          <Select
            value={status}
            onValueChange={(value) => {
              setStatus(value as TeamMemberStatus | 'ALL')
              setPageIndex(0)
            }}
          >
            <SelectTrigger className="w-40" aria-label="Status filter">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All statuses</SelectItem>
              {STATUS_OPTIONS.map((s) => (
                <SelectItem key={s} value={s}>
                  {s}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={roleId}
            onValueChange={(value) => {
              setRoleId(value)
              setPageIndex(0)
            }}
          >
            <SelectTrigger className="w-48" aria-label="Role filter">
              <SelectValue placeholder="Role" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All roles</SelectItem>
              {(roles.data ?? []).map((r) => (
                <SelectItem key={r.id} value={r.id!}>
                  {r.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button disabled={!canManage} onClick={() => setCreateOpen(true)}>
          <PlusIcon /> New member
        </Button>
      </div>

      <DataTable
        columns={columns}
        data={rows}
        isLoading={members.isLoading}
        emptyMessage="No team members match these filters."
        onRowClick={(member) => navigate(`/team/${member.id}`)}
        serverPagination={{
          pageIndex,
          pageSize: PAGE_SIZE,
          pageCount: members.data?.totalPages ?? 0,
          totalElements: members.data?.totalElements ?? 0,
          onPageIndexChange: setPageIndex,
        }}
      />

      <MemberCreateDialog open={createOpen} onOpenChange={setCreateOpen} />
    </div>
  )
}

export default TeamPage
