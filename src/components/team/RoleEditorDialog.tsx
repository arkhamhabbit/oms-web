import * as React from 'react'
import { LockIcon } from 'lucide-react'
import { useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { errorSentence } from '@/components/team/role-errors'
import { usePermissionCatalogQuery } from '@/api/permission-catalog'
import { useCreateRoleMutation, useUpdateRoleMutation, type Role } from '@/api/roles'
import { isApiError, isVersionConflict } from '@/lib/api-error'

export interface RoleEditorDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Omit to create; supply the loaded role to edit or (for a system role) to view. */
  role?: Role
  canManage: boolean
}

function RoleEditorDialog({ open, onOpenChange, role, canManage }: RoleEditorDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        {/* Mounted only while open, so every open starts from the role as currently loaded. */}
        <RoleEditorForm onOpenChange={onOpenChange} role={role} canManage={canManage} />
      </DialogContent>
    </Dialog>
  )
}

function RoleEditorForm({ onOpenChange, role, canManage }: Omit<RoleEditorDialogProps, 'open'>) {
  const isEdit = !!role
  const readOnly = !canManage || !!role?.systemRole
  const catalog = usePermissionCatalogQuery()
  const create = useCreateRoleMutation()
  const update = useUpdateRoleMutation(role?.id ?? '')
  const queryClient = useQueryClient()

  const [name, setName] = React.useState(role?.name ?? '')
  const [description, setDescription] = React.useState(role?.description ?? '')
  const [selected, setSelected] = React.useState<Set<string>>(new Set(role?.permissions ?? []))
  const [errors, setErrors] = React.useState<Record<string, string>>({})
  const [banner, setBanner] = React.useState<string | undefined>()

  function toggle(key: string, on: boolean) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (on) {
        next.add(key)
      } else {
        next.delete(key)
      }
      return next
    })
  }

  function save(event: React.FormEvent) {
    event.preventDefault()
    setErrors({})
    setBanner(undefined)
    const permissions = [...selected]
    const request = isEdit
      ? update.mutateAsync({
          name: name.trim(),
          description: description.trim() || undefined,
          permissions,
          version: role!.version!,
        })
      : create.mutateAsync({
          name: name.trim(),
          description: description.trim() || undefined,
          permissions,
        })

    request
      .then(() => {
        toast.success(isEdit ? 'Role saved' : 'Role created')
        onOpenChange(false)
      })
      .catch((error) => {
        if (isVersionConflict(error)) {
          // Refresh the list so reopening the role picks up the version that beat this save.
          void queryClient.invalidateQueries({ queryKey: ['roles'] })
          setBanner(
            'This role was changed by someone else — close and reopen it to see the latest, then try again.'
          )
        } else if (isApiError(error) && error.fieldErrors.length > 0) {
          setErrors(Object.fromEntries(error.fieldErrors.map((f) => [f.field, f.message])))
        } else {
          setBanner(errorSentence(error))
        }
      })
  }

  const pending = create.isPending || update.isPending
  // A system role reports its whole expanded set; a read-only view shows exactly what it grants.
  const granted = new Set(role?.permissions ?? [])

  return (
    <>
      <DialogHeader>
        <DialogTitle>{isEdit ? (role?.name ?? 'Role') : 'New role'}</DialogTitle>
        <DialogDescription>
          A role is a name plus a set of permissions. Changes reach everyone holding the role on
          their next request — no re-login needed.
        </DialogDescription>
      </DialogHeader>

      {role?.systemRole && (
        <p className="flex items-start gap-2 rounded-md bg-muted p-3 text-sm text-muted-foreground">
          <LockIcon className="mt-0.5 size-4 shrink-0" />
          <span>
            <strong>{role.name}</strong> is a system role: it can&apos;t be edited or deleted, and
            always grants every permission that exists. If it could be edited, its last holder could
            strip it and lock everyone out.
          </span>
        </p>
      )}
      {!role?.systemRole && !canManage && (
        <p className="rounded-md bg-muted p-3 text-sm text-muted-foreground">
          Viewing only — changing roles needs the <code>team.manage</code> permission.
        </p>
      )}
      {banner && (
        <p
          role="alert"
          className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm"
        >
          {banner}
        </p>
      )}

      <form onSubmit={save} className="flex flex-col gap-4">
        <div className="grid gap-1.5">
          <Label htmlFor="role-name">Name</Label>
          <Input
            id="role-name"
            value={name}
            readOnly={readOnly}
            onChange={(e) => setName(e.target.value)}
          />
          {errors.name && <p className="text-sm text-destructive">{errors.name}</p>}
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="role-description">Description</Label>
          <Input
            id="role-description"
            value={description}
            readOnly={readOnly}
            onChange={(e) => setDescription(e.target.value)}
          />
          {errors.description && <p className="text-sm text-destructive">{errors.description}</p>}
        </div>

        <div className="grid gap-2">
          <Label>Permissions</Label>
          {errors.permissions && <p className="text-sm text-destructive">{errors.permissions}</p>}
          {catalog.isLoading && <p className="text-sm text-muted-foreground">Loading catalog…</p>}
          {catalog.isError && (
            <p className="text-sm text-destructive">
              The permission catalog could not be loaded, so permissions can&apos;t be shown.
            </p>
          )}
          <div className="flex flex-col gap-3">
            {(catalog.data ?? []).map((group) => {
              const perms = group.permissions ?? []
              const keys = perms.map((p) => p.key!)
              const checkedCount = keys.filter((k) => (readOnly ? granted : selected).has(k)).length
              return (
                <fieldset key={group.domain} className="rounded-md border p-3">
                  <legend className="flex items-center gap-2 px-1 text-sm font-medium capitalize">
                    {group.domain}
                    <span className="text-xs font-normal text-muted-foreground">
                      {checkedCount}/{keys.length}
                    </span>
                    {!readOnly && (
                      <button
                        type="button"
                        className="text-xs font-normal text-primary underline-offset-2 hover:underline"
                        onClick={() => keys.forEach((k) => toggle(k, checkedCount !== keys.length))}
                      >
                        {checkedCount === keys.length ? 'Clear' : 'Select all'}
                      </button>
                    )}
                  </legend>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {perms.map((p) => {
                      const inputId = `perm-${p.key}`
                      return (
                        <div key={p.key} className="flex items-start gap-2">
                          {readOnly ? (
                            <span
                              aria-hidden
                              className="mt-0.5 w-4 shrink-0 text-center text-sm"
                              title={granted.has(p.key!) ? 'Granted' : 'Not granted'}
                            >
                              {granted.has(p.key!) ? '✓' : '–'}
                            </span>
                          ) : (
                            <Checkbox
                              id={inputId}
                              checked={selected.has(p.key!)}
                              onCheckedChange={(v) => toggle(p.key!, v === true)}
                              className="mt-0.5"
                            />
                          )}
                          <label htmlFor={inputId} className="grid text-sm leading-tight">
                            <code className="text-xs">{p.key}</code>
                            <span className="text-muted-foreground">{p.description}</span>
                          </label>
                        </div>
                      )
                    })}
                  </div>
                </fieldset>
              )
            })}
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            {readOnly ? 'Close' : 'Cancel'}
          </Button>
          {!readOnly && (
            <Button type="submit" disabled={pending || name.trim() === ''}>
              {isEdit ? 'Save role' : 'Create role'}
            </Button>
          )}
        </DialogFooter>
      </form>
    </>
  )
}

export { RoleEditorDialog }
