import * as React from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import type { ColumnDef } from '@tanstack/react-table'
import { PlusIcon } from 'lucide-react'

import { DataTable } from '@/components/data-table/DataTable'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { UserCreateDialog } from '@/components/users/UserCreateDialog'
import { UserRoleBadges, UserStatusBadge } from '@/components/users/UserStatusBadge'
import { useBreadcrumb } from '@/layouts/breadcrumb-context'
import { usePermissions } from '@/auth/usePermissions'
import { isApiError } from '@/lib/api-error'
import { useUsersQuery, type UserRole, type UserStatus, type UserSummary } from '@/api/users'

const PAGE_SIZE = 20
const STATUS_OPTIONS: UserStatus[] = ['INVITED', 'ACTIVE', 'SUSPENDED']
const ROLE_OPTIONS: UserRole[] = ['CONSUMER', 'PARTNER']

function UsersPage() {
  useBreadcrumb([{ label: 'Users' }])
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const { has } = usePermissions()
  const canWrite = has('identity.user.write')

  const [pageIndex, setPageIndex] = React.useState(0)
  const [status, setStatus] = React.useState<UserStatus | 'ALL'>('ALL')
  const [role, setRole] = React.useState<UserRole | 'ALL'>('ALL')
  // The URL is the source of truth, so the "find the existing account" link lands on the match
  // even when this page is already mounted.
  const search = params.get('search') ?? ''
  const [createOpen, setCreateOpen] = React.useState(false)

  const users = useUsersQuery({
    page: pageIndex,
    size: PAGE_SIZE,
    status: status === 'ALL' ? undefined : status,
    role: role === 'ALL' ? undefined : role,
    search: search.trim(),
  })

  function changeSearch(value: string) {
    setPageIndex(0)
    setParams(value ? { search: value } : {}, { replace: true })
  }

  const columns: ColumnDef<UserSummary, unknown>[] = [
    // Canonical +91XXXXXXXXXX exactly as stored — it is the identity key, never reformatted.
    {
      id: 'mobile',
      header: 'Mobile',
      cell: ({ row }) => <span className="font-mono">{row.original.mobile}</span>,
    },
    { accessorKey: 'name', header: 'Name' },
    { id: 'email', header: 'Email', cell: ({ row }) => row.original.email ?? '' },
    {
      id: 'status',
      header: 'Status',
      cell: ({ row }) => <UserStatusBadge status={row.original.status} />,
    },
    {
      id: 'roles',
      header: 'Roles',
      cell: ({ row }) => <UserRoleBadges roles={row.original.roles} />,
    },
  ]

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <Input
            autoFocus
            placeholder="Search mobile, email or name…"
            aria-label="Search users"
            value={search}
            onChange={(event) => changeSearch(event.target.value)}
            className="w-72"
          />
          <Select
            value={status}
            onValueChange={(value) => {
              setStatus(value as UserStatus | 'ALL')
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
            value={role}
            onValueChange={(value) => {
              setRole(value as UserRole | 'ALL')
              setPageIndex(0)
            }}
          >
            <SelectTrigger className="w-40" aria-label="Role filter">
              <SelectValue placeholder="Role" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All roles</SelectItem>
              {ROLE_OPTIONS.map((r) => (
                <SelectItem key={r} value={r}>
                  {r}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button disabled={!canWrite} onClick={() => setCreateOpen(true)}>
          <PlusIcon /> Invite customer
        </Button>
      </div>

      {users.isError && (
        <p role="alert" className="text-sm text-destructive">
          {isApiError(users.error) ? users.error.message : 'Users could not be loaded.'}
        </p>
      )}

      <DataTable
        columns={columns}
        data={users.data?.content ?? []}
        isLoading={users.isLoading}
        emptyMessage="No users match these filters."
        onRowClick={(user) => navigate(`/users/${user.id}`)}
        serverPagination={{
          pageIndex,
          pageSize: PAGE_SIZE,
          pageCount: users.data?.totalPages ?? 0,
          totalElements: users.data?.totalElements ?? 0,
          onPageIndexChange: setPageIndex,
        }}
      />

      <UserCreateDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreated={(id) => navigate(`/users/${id}`)}
      />
    </div>
  )
}

export default UsersPage
