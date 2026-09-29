import * as React from 'react'
import type { ColumnDef } from '@tanstack/react-table'
import { EyeIcon, LockIcon, PencilIcon, PlusIcon, Trash2Icon } from 'lucide-react'
import { toast } from 'sonner'

import { DataTable } from '@/components/data-table/DataTable'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ConfirmDialog } from '@/components/common/ConfirmDialog'
import { RoleEditorDialog } from '@/components/team/RoleEditorDialog'
import { errorSentence } from '@/components/team/role-errors'
import { useBreadcrumb } from '@/layouts/breadcrumb-context'
import { usePermissions } from '@/auth/usePermissions'
import { useDeleteRoleMutation, useRolesQuery, type Role } from '@/api/roles'
import { useTeamMembersQuery } from '@/api/team'

/** A team is tens of people; the role list has no member count, so it is derived from this. */
const FETCH_ALL_SIZE = 500

function RolesPage() {
  useBreadcrumb([{ label: 'Roles' }])
  const { has } = usePermissions()
  const canManage = has('team.manage')

  const roles = useRolesQuery()
  // Contract gap (recorded in the W1.3 Status): RoleResponse carries no member count, so the
  // "in use" count is derived from the member list.
  const members = useTeamMembersQuery({ page: 0, size: FETCH_ALL_SIZE })
  const deleteRole = useDeleteRoleMutation()

  const [editorOpen, setEditorOpen] = React.useState(false)
  const [editing, setEditing] = React.useState<Role | undefined>()
  const [deleting, setDeleting] = React.useState<Role | undefined>()
  const [deleteError, setDeleteError] = React.useState<string | undefined>()

  const holderCount = React.useMemo(() => {
    const counts = new Map<string, number>()
    for (const member of members.data?.content ?? []) {
      for (const r of member.roles ?? []) {
        counts.set(r.id!, (counts.get(r.id!) ?? 0) + 1)
      }
    }
    return counts
  }, [members.data])

  function open(role?: Role) {
    setEditing(role)
    setEditorOpen(true)
  }

  const deletingCount = deleting ? (holderCount.get(deleting.id!) ?? 0) : 0

  const columns: ColumnDef<Role, unknown>[] = [
    {
      id: 'name',
      header: 'Name',
      cell: ({ row }) => (
        <span className="flex items-center gap-2 font-medium">
          {row.original.name}
          {row.original.systemRole && (
            <Badge variant="default" className="gap-1">
              <LockIcon className="size-3" /> System
            </Badge>
          )}
        </span>
      ),
    },
    { id: 'description', header: 'Description', cell: ({ row }) => row.original.description ?? '' },
    {
      id: 'permissions',
      header: 'Permissions',
      cell: ({ row }) =>
        row.original.grantsEveryPermission
          ? `All (${row.original.permissions?.length ?? 0})`
          : (row.original.permissions?.length ?? 0),
    },
    {
      id: 'members',
      header: 'Members',
      cell: ({ row }) => (members.data ? (holderCount.get(row.original.id!) ?? 0) : '…'),
    },
    {
      id: 'actions',
      header: '',
      cell: ({ row }) => {
        const role = row.original
        const readOnly = role.systemRole || !canManage
        return (
          <div className="flex items-center justify-end gap-1">
            <Button
              variant="ghost"
              size="icon"
              title={readOnly ? 'View permissions' : 'Edit'}
              aria-label={readOnly ? `View ${role.name}` : `Edit ${role.name}`}
              onClick={() => open(role)}
            >
              {readOnly ? <EyeIcon /> : <PencilIcon />}
            </Button>
            {!role.systemRole && (
              <Button
                variant="ghost"
                size="icon"
                disabled={!canManage}
                title="Delete"
                aria-label={`Delete ${role.name}`}
                onClick={() => {
                  setDeleteError(undefined)
                  setDeleting(role)
                }}
              >
                <Trash2Icon />
              </Button>
            )}
          </div>
        )
      },
    },
  ]

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="max-w-2xl text-sm text-muted-foreground">
          A member can do the union of what their roles grant. Permissions are only ever granted
          through roles — there are no per-member grants.
        </p>
        <Button disabled={!canManage} onClick={() => open()}>
          <PlusIcon /> New role
        </Button>
      </div>

      <DataTable
        columns={columns}
        data={roles.data ?? []}
        isLoading={roles.isLoading}
        emptyMessage="No roles yet."
      />

      <RoleEditorDialog
        open={editorOpen}
        onOpenChange={setEditorOpen}
        role={editing}
        canManage={canManage}
      />

      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(next) => !next && setDeleting(undefined)}
        title={`Delete ${deleting?.name ?? 'role'}`}
        confirmLabel="Delete role"
        destructive
        pending={deleteRole.isPending}
        confirmDisabled={deletingCount > 0}
        onConfirm={() => {
          if (!deleting) {
            return
          }
          deleteRole
            .mutateAsync(deleting.id!)
            .then(() => {
              toast.success('Role deleted')
              setDeleting(undefined)
            })
            .catch((error) => setDeleteError(errorSentence(error)))
        }}
      >
        {deletingCount > 0 ? (
          <p>
            <strong>{deleting?.name}</strong> is still held by {deletingCount}{' '}
            {deletingCount === 1 ? 'member' : 'members'}, so it can&apos;t be deleted. Take it off
            them first — each removal is its own audited change.
          </p>
        ) : (
          <p>
            No one holds <strong>{deleting?.name}</strong>. Deleting it is permanent.
          </p>
        )}
        {deleteError && (
          <p role="alert" className="text-destructive">
            {deleteError}
          </p>
        )}
      </ConfirmDialog>
    </div>
  )
}

export default RolesPage
