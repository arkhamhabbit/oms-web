import * as React from 'react'
import { TrashIcon } from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { ConfirmDialog } from '@/components/common/ConfirmDialog'
import { MediaLibraryGrid } from '@/components/media/MediaLibraryGrid'
import { MediaUploader } from '@/components/media/MediaUploader'
import { useBreadcrumb } from '@/layouts/breadcrumb-context'
import { usePermissions } from '@/auth/usePermissions'
import { toastApiError } from '@/lib/api-error'
import { useDeleteMediaMutation, useMediaReferencesQuery, type Media } from '@/api/media'

function DeleteMediaDialog({ media, onClose }: { media: Media | null; onClose: () => void }) {
  const references = useMediaReferencesQuery(media?.id)
  const deleteMedia = useDeleteMediaMutation()
  const used = references.data ?? []

  return (
    <ConfirmDialog
      open={!!media}
      onOpenChange={(open) => !open && onClose()}
      title="Delete this file?"
      confirmLabel="Delete"
      destructive
      pending={deleteMedia.isPending}
      confirmDisabled={references.isLoading || used.length > 0}
      onConfirm={() =>
        deleteMedia
          .mutateAsync(media!.id!)
          .then(() => {
            toast.success('File deleted')
            onClose()
          })
          .catch((error) => toastApiError(error))
      }
    >
      <p className="text-sm">
        <strong>{media?.filename}</strong> and its stored copies are removed. This cannot be undone.
      </p>
      {references.isLoading ? (
        <p className="mt-2 text-sm text-muted-foreground">Checking where it is used…</p>
      ) : used.length > 0 ? (
        <div className="mt-2 rounded-md border border-destructive/40 bg-destructive/5 p-2 text-sm">
          <p className="font-medium text-destructive">
            It is still in use, so it cannot be deleted. Replace or remove it in:
          </p>
          <ul className="mt-1 list-disc pl-5">
            {used.map((reference, index) => (
              <li key={index}>
                {reference.owner} — {reference.place}
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <p className="mt-2 text-sm text-muted-foreground">Nothing uses it.</p>
      )}
    </ConfirmDialog>
  )
}

function MediaLibraryPage() {
  useBreadcrumb([{ label: 'Media' }])
  const { has } = usePermissions()
  const canWrite = has('catalog.media.write')
  const [deleting, setDeleting] = React.useState<Media | null>(null)

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-semibold">Media library</h1>
      {canWrite && (
        <Card>
          <CardHeader>
            <CardTitle>Upload</CardTitle>
            <CardDescription>
              Files go straight from your browser to storage. Images and videos are checked and
              prepared before they can be used.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <MediaUploader kinds={['IMAGE', 'VIDEO']} />
          </CardContent>
        </Card>
      )}
      <Card>
        <CardContent className="pt-6">
          <MediaLibraryGrid
            kinds={['IMAGE', 'VIDEO']}
            showStatusFilter
            renderActions={(media) =>
              canWrite ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="self-start"
                  onClick={() => setDeleting(media)}
                >
                  <TrashIcon /> Delete
                </Button>
              ) : null
            }
          />
        </CardContent>
      </Card>
      <DeleteMediaDialog media={deleting} onClose={() => setDeleting(null)} />
    </div>
  )
}

export default MediaLibraryPage
