import * as React from 'react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { MediaThumb } from '@/components/media/MediaThumb'
import { useMediaQuery, type Media, type MediaKind, type MediaStatus } from '@/api/media'
import { formatBytes, formatDuration } from '@/lib/content-rules'
import { cn } from '@/lib/utils'
import { MEDIA_STATUS_LABEL, labelOf } from '@/lib/labels'

const PAGE_SIZE = 24
/** Searching by filename filters what is loaded, so it loads a wide page rather than a narrow one. */
const SEARCH_SIZE = 200

export interface MediaLibraryGridProps {
  /** Kinds the caller can use; the filter offers only these. */
  kinds: MediaKind[]
  /** Fixed status filter. The picker passes READY; the library page lets the operator choose. */
  status?: MediaStatus
  showStatusFilter?: boolean
  onSelect?: (media: Media) => void
  selectedId?: string
  /** Rendered under each tile — the library page puts its delete action here. */
  renderActions?: (media: Media) => React.ReactNode
}

const ALL = 'ALL'

/** A paged grid of library items: kind filter, filename search, video poster and duration. */
function MediaLibraryGrid({
  kinds,
  status,
  showStatusFilter,
  onSelect,
  selectedId,
  renderActions,
}: MediaLibraryGridProps) {
  const [pageIndex, setPageIndex] = React.useState(0)
  const [kind, setKind] = React.useState<MediaKind | typeof ALL>(
    kinds.length === 1 ? kinds[0] : ALL
  )
  const [statusFilter, setStatusFilter] = React.useState<MediaStatus | typeof ALL>(ALL)
  const [search, setSearch] = React.useState('')
  const searching = search.trim() !== ''

  const effectiveStatus = status ?? (statusFilter === ALL ? undefined : statusFilter)
  const query = useMediaQuery({
    page: searching ? 0 : pageIndex,
    size: searching ? SEARCH_SIZE : PAGE_SIZE,
    kind: kind === ALL ? undefined : kind,
    status: effectiveStatus,
  })

  const all = query.data?.content ?? []
  const items = searching
    ? all.filter((m) => (m.filename ?? '').toLowerCase().includes(search.trim().toLowerCase()))
    : all
  const totalPages = query.data?.totalPages ?? 1

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <Input
          placeholder="Search by filename"
          aria-label="Search by filename"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          className="w-56"
        />
        {kinds.length > 1 && (
          <Select
            value={kind}
            onValueChange={(value) => {
              setKind(value as MediaKind | typeof ALL)
              setPageIndex(0)
            }}
          >
            <SelectTrigger className="w-36" aria-label="Kind">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All kinds</SelectItem>
              <SelectItem value="IMAGE">Images</SelectItem>
              <SelectItem value="VIDEO">Videos</SelectItem>
            </SelectContent>
          </Select>
        )}
        {showStatusFilter && (
          <Select
            value={statusFilter}
            onValueChange={(value) => {
              setStatusFilter(value as MediaStatus | typeof ALL)
              setPageIndex(0)
            }}
          >
            <SelectTrigger className="w-36" aria-label="Status">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>Any status</SelectItem>
              <SelectItem value="READY">{MEDIA_STATUS_LABEL.READY}</SelectItem>
              <SelectItem value="PENDING">{MEDIA_STATUS_LABEL.PENDING}</SelectItem>
              <SelectItem value="FAILED">{MEDIA_STATUS_LABEL.FAILED}</SelectItem>
            </SelectContent>
          </Select>
        )}
      </div>

      {query.isLoading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : items.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          {searching ? 'No file name matches.' : 'Nothing in the library yet.'}
        </p>
      ) : (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {items.map((media) => {
            const selectable = !!onSelect && media.status === 'READY'
            return (
              <li
                key={media.id}
                className={cn(
                  'flex flex-col gap-1.5 rounded-md border p-2',
                  selectedId === media.id && 'border-primary ring-2 ring-primary/30'
                )}
              >
                <button
                  type="button"
                  disabled={!selectable}
                  onClick={() => onSelect?.(media)}
                  className="text-left disabled:cursor-default"
                  aria-label={selectable ? `Choose ${media.filename}` : (media.filename ?? 'Media')}
                >
                  <MediaThumb
                    media={media}
                    size="card"
                    alt={media.filename}
                    className="aspect-square h-auto w-full"
                  />
                </button>
                <p className="truncate text-xs font-medium" title={media.filename}>
                  {media.filename}
                </p>
                <p className="flex flex-wrap items-center gap-1 text-[11px] text-muted-foreground">
                  {media.status !== 'READY' && (
                    <Badge variant={media.status === 'FAILED' ? 'destructive' : 'outline'}>
                      {labelOf(MEDIA_STATUS_LABEL, media.status)}
                    </Badge>
                  )}
                  {media.kind === 'VIDEO' && media.durationMs !== undefined && (
                    <span>{formatDuration(media.durationMs)}</span>
                  )}
                  <span>{formatBytes(media.bytes)}</span>
                </p>
                {media.status === 'FAILED' && media.failureReason && (
                  <p className="text-[11px] text-destructive">{media.failureReason}</p>
                )}
                {renderActions?.(media)}
              </li>
            )
          })}
        </ul>
      )}

      {!searching && totalPages > 1 && (
        <div className="flex items-center justify-end gap-2">
          <span className="text-xs text-muted-foreground">
            Page {pageIndex + 1} of {totalPages}
          </span>
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={pageIndex === 0}
            onClick={() => setPageIndex((p) => p - 1)}
          >
            Previous
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={pageIndex >= totalPages - 1}
            onClick={() => setPageIndex((p) => p + 1)}
          >
            Next
          </Button>
        </div>
      )}
    </div>
  )
}

export { MediaLibraryGrid }
