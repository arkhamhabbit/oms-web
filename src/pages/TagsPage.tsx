import * as React from 'react'
import { PencilIcon, TrashIcon } from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ConfirmDialog } from '@/components/common/ConfirmDialog'
import { describeApiError } from '@/components/content/BlockFormDialog'
import { useBreadcrumb } from '@/layouts/breadcrumb-context'
import { usePermissions } from '@/auth/usePermissions'
import { toastApiError } from '@/lib/api-error'
import {
  useCreateTagMutation,
  useDeleteTagMutation,
  useTagsQuery,
  useUpdateTagMutation,
  type Tag,
} from '@/api/merchandising'

/** Mirrors the server's rule: upper-case letters, digits and underscores, starting with a letter. */
const CODE_PATTERN = /^[A-Z][A-Z0-9_]*$/

function TagsPage() {
  useBreadcrumb([{ label: 'Tags' }])
  const { has } = usePermissions()
  const canWrite = has('catalog.attribute.write')

  const tagsQuery = useTagsQuery()
  const createTag = useCreateTagMutation()
  const updateTag = useUpdateTagMutation()
  const deleteTag = useDeleteTagMutation()

  const [code, setCode] = React.useState('')
  const [label, setLabel] = React.useState('')
  const [createError, setCreateError] = React.useState<string | null>(null)
  const [editing, setEditing] = React.useState<Tag | null>(null)
  const [editLabel, setEditLabel] = React.useState('')
  const [editError, setEditError] = React.useState<string | null>(null)
  const [deleting, setDeleting] = React.useState<Tag | null>(null)

  const tags = tagsQuery.data ?? []

  function create(event: React.FormEvent) {
    event.preventDefault()
    setCreateError(null)
    const normalised = code.trim().toUpperCase()
    if (!CODE_PATTERN.test(normalised)) {
      setCreateError(
        'A code is upper-case letters, digits and underscores, starting with a letter.'
      )
      return
    }
    if (!label.trim()) {
      setCreateError('Give the tag a label.')
      return
    }
    createTag
      .mutateAsync({ code: normalised, label: label.trim() })
      .then(() => {
        toast.success('Tag created')
        setCode('')
        setLabel('')
      })
      .catch((cause) => setCreateError(describeApiError(cause)))
  }

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-semibold">Tags</h1>
      <Card>
        <CardHeader>
          <CardTitle>Merchandising tags</CardTitle>
          <CardDescription>
            Badges such as Bestseller or Trending. Put them on a product or a variant from its
            Merchandising tab.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {tagsQuery.isLoading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : tags.length === 0 ? (
            <p className="text-sm text-muted-foreground">No tags yet.</p>
          ) : (
            <ul className="flex flex-col divide-y rounded-md border bg-background">
              {tags.map((tag) => (
                <li key={tag.id} className="flex items-center gap-3 px-3 py-2">
                  <span className="w-48 truncate font-mono text-xs text-muted-foreground">
                    {tag.code}
                  </span>
                  <span className="flex-1 truncate text-sm">{tag.label}</span>
                  {canWrite && (
                    <>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        title="Rename"
                        onClick={() => {
                          setEditing(tag)
                          setEditLabel(tag.label ?? '')
                          setEditError(null)
                        }}
                      >
                        <PencilIcon />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        title="Delete"
                        onClick={() => setDeleting(tag)}
                      >
                        <TrashIcon />
                      </Button>
                    </>
                  )}
                </li>
              ))}
            </ul>
          )}

          {canWrite && (
            <form onSubmit={create} className="flex flex-wrap items-end gap-2">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="tag-code">Code</Label>
                <Input
                  id="tag-code"
                  className="w-48"
                  placeholder="NEW_ARRIVAL"
                  value={code}
                  onChange={(event) => setCode(event.target.value)}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="tag-label">Label</Label>
                <Input
                  id="tag-label"
                  className="w-56"
                  placeholder="New arrival"
                  value={label}
                  onChange={(event) => setLabel(event.target.value)}
                />
              </div>
              <Button type="submit" disabled={createTag.isPending}>
                Add tag
              </Button>
              {createError && (
                <p role="alert" className="w-full text-sm text-destructive">
                  {createError}
                </p>
              )}
            </form>
          )}
        </CardContent>
      </Card>

      <ConfirmDialog
        open={!!editing}
        onOpenChange={(open) => !open && setEditing(null)}
        title="Rename tag"
        confirmLabel="Save"
        pending={updateTag.isPending}
        onConfirm={() =>
          updateTag
            .mutateAsync({ id: editing!.id!, label: editLabel.trim(), version: editing!.version! })
            .then(() => setEditing(null))
            .catch((cause) => setEditError(describeApiError(cause)))
        }
      >
        <div className="flex flex-col gap-2">
          <Label htmlFor="tag-edit-label">Label for {editing?.code}</Label>
          <Input
            id="tag-edit-label"
            value={editLabel}
            onChange={(event) => setEditLabel(event.target.value)}
          />
          {editError && (
            <p role="alert" className="text-sm text-destructive">
              {editError}
            </p>
          )}
        </div>
      </ConfirmDialog>

      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(open) => !open && setDeleting(null)}
        title="Delete tag?"
        confirmLabel="Delete"
        destructive
        pending={deleteTag.isPending}
        onConfirm={() =>
          deleteTag
            .mutateAsync(deleting!.id!)
            .then(() => setDeleting(null))
            // A tag in use is refused with a sentence saying so.
            .catch((error) => toastApiError(error))
        }
      >
        <p className="text-sm">
          <strong>{deleting?.label}</strong> is removed. A tag that is still on a product or variant
          cannot be deleted.
        </p>
      </ConfirmDialog>
    </div>
  )
}

export default TagsPage
