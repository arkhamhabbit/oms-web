import * as React from 'react'
import type { ColumnDef } from '@tanstack/react-table'

import { DataTable } from '@/components/data-table/DataTable'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useBreadcrumb } from '@/layouts/breadcrumb-context'
import {
  useAuditEntriesQuery,
  type AuditAction,
  type AuditEntityType,
  type AuditEntry,
} from '@/api/audit'
import { AUDIT_ACTIONS, AUDIT_ENTITY_TYPES } from '@/api/enums.gen'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { isApiError } from '@/lib/api-error'
import { diffSnapshots, formatDiffValue, type DiffRow } from '@/lib/audit-diff'
import { cn } from '@/lib/utils'

const PAGE_SIZE = 25

interface Filters {
  entityType: AuditEntityType | ''
  entityId: string
  actorId: string
  action: AuditAction | ''
  from: string
  to: string
}

const emptyFilters: Filters = {
  entityType: '',
  entityId: '',
  actorId: '',
  action: '',
  from: '',
  to: '',
}

/** `datetime-local` gives a wall-clock value with no zone; the API wants a UTC instant. */
function toInstant(local: string): string | undefined {
  if (!local) {
    return undefined
  }
  const date = new Date(local)
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString()
}

/**
 * The log has no FK to team members (D3.8): an actor may have been removed since, or the
 * write may have been the system's own. The snapshot email is what was true at the time.
 */
function ActorCell({ entry }: { entry: AuditEntry }) {
  if (entry.actorType === 'SYSTEM') {
    return <Badge variant="outline">System</Badge>
  }
  if (entry.actorEmail) {
    return <span>{entry.actorEmail}</span>
  }
  if (entry.actorId) {
    return (
      <span className="text-muted-foreground" title={entry.actorId}>
        Unknown member ({entry.actorId.slice(0, 8)}…)
      </span>
    )
  }
  return <span className="text-muted-foreground">Unknown actor</span>
}

const DIFF_STYLE: Record<DiffRow['kind'], string> = {
  added: 'bg-green-500/10',
  removed: 'bg-red-500/10',
  changed: 'bg-amber-500/10',
  unchanged: '',
}

function DiffView({ entry }: { entry: AuditEntry }) {
  const [showUnchanged, setShowUnchanged] = React.useState(false)
  const all = diffSnapshots(entry.before, entry.after)
  const changed = all.filter((r) => r.kind !== 'unchanged')
  const rows = showUnchanged ? all : changed

  return (
    <div className="flex flex-col gap-2 p-2 text-sm">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
        {entry.ip && <span>IP {entry.ip}</span>}
        {entry.traceId && <span>Trace {entry.traceId}</span>}
        {entry.entityId && <span>Entity {entry.entityId}</span>}
        {all.length > changed.length && (
          <button
            type="button"
            className="text-primary underline-offset-2 hover:underline"
            onClick={() => setShowUnchanged((v) => !v)}
          >
            {showUnchanged ? 'Hide' : 'Show'} {all.length - changed.length} unchanged field
            {all.length - changed.length === 1 ? '' : 's'}
          </button>
        )}
      </div>
      {rows.length === 0 ? (
        <p className="text-muted-foreground">
          {all.length === 0
            ? 'No before/after snapshot was recorded for this entry.'
            : 'Nothing changed in the recorded snapshot.'}
        </p>
      ) : (
        <table className="w-full table-fixed text-left">
          <thead className="text-xs text-muted-foreground">
            <tr>
              <th className="w-1/4 py-1 pr-2 font-medium">Field</th>
              <th className="w-3/8 py-1 pr-2 font-medium">Before</th>
              <th className="py-1 font-medium">After</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.field} className={cn('align-top', DIFF_STYLE[row.kind])}>
                <td className="py-1 pr-2 font-mono text-xs">{row.field}</td>
                <td className="break-all py-1 pr-2 font-mono text-xs">
                  {row.kind === 'added' ? '—' : formatDiffValue(row.before)}
                </td>
                <td className="break-all py-1 font-mono text-xs">
                  {row.kind === 'removed' ? '—' : formatDiffValue(row.after)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}

function AuditPage() {
  useBreadcrumb([{ label: 'Audit' }])

  const [pageIndex, setPageIndex] = React.useState(0)
  const [draft, setDraft] = React.useState<Filters>(emptyFilters)
  const [applied, setApplied] = React.useState<Filters>(emptyFilters)

  const query = useAuditEntriesQuery({
    page: pageIndex,
    size: PAGE_SIZE,
    entityType: applied.entityType || undefined,
    entityId: applied.entityId.trim(),
    actorId: applied.actorId.trim(),
    action: applied.action || undefined,
    from: toInstant(applied.from),
    to: toInstant(applied.to),
  })

  function set<K extends keyof Filters>(key: K, value: string) {
    setDraft((prev) => ({ ...prev, [key]: value }))
  }
  function apply(event: React.FormEvent) {
    event.preventDefault()
    setPageIndex(0)
    setApplied(draft)
  }
  function clear() {
    setDraft(emptyFilters)
    setApplied(emptyFilters)
    setPageIndex(0)
  }

  const columns: ColumnDef<AuditEntry, unknown>[] = [
    {
      id: 'occurredAt',
      header: 'When',
      cell: ({ row }) =>
        row.original.occurredAt ? new Date(row.original.occurredAt).toLocaleString() : '',
    },
    { id: 'actor', header: 'Actor', cell: ({ row }) => <ActorCell entry={row.original} /> },
    {
      id: 'action',
      header: 'Action',
      cell: ({ row }) => <code className="text-xs">{row.original.action}</code>,
    },
    { accessorKey: 'entityType', header: 'Entity' },
  ]

  return (
    <div className="flex flex-col gap-4">
      <form onSubmit={apply} className="grid gap-3 rounded-md border p-3 md:grid-cols-3">
        <div className="grid gap-1.5">
          <Label htmlFor="audit-entity-type">Entity type</Label>
          <Select
            value={draft.entityType || 'ALL'}
            onValueChange={(v) => set('entityType', v === 'ALL' ? '' : (v as AuditEntityType))}
          >
            <SelectTrigger id="audit-entity-type" aria-label="Entity type">
              <SelectValue placeholder="All entity types" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All entity types</SelectItem>
              {AUDIT_ENTITY_TYPES.map((t) => (
                <SelectItem key={t} value={t}>
                  {t}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="audit-entity-id">Entity ID</Label>
          <Input
            id="audit-entity-id"
            placeholder="UUID"
            value={draft.entityId}
            onChange={(e) => set('entityId', e.target.value)}
          />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="audit-actor">Actor ID</Label>
          <Input
            id="audit-actor"
            placeholder="Team member UUID"
            value={draft.actorId}
            onChange={(e) => set('actorId', e.target.value)}
          />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="audit-action">Action</Label>
          <Select
            value={draft.action || 'ALL'}
            onValueChange={(v) => set('action', v === 'ALL' ? '' : (v as AuditAction))}
          >
            <SelectTrigger id="audit-action" aria-label="Action">
              <SelectValue placeholder="All actions" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All actions</SelectItem>
              {AUDIT_ACTIONS.map((a) => (
                <SelectItem key={a} value={a}>
                  {a}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="audit-from">From (inclusive)</Label>
          <Input
            id="audit-from"
            type="datetime-local"
            value={draft.from}
            onChange={(e) => set('from', e.target.value)}
          />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="audit-to">To (exclusive)</Label>
          <Input
            id="audit-to"
            type="datetime-local"
            value={draft.to}
            onChange={(e) => set('to', e.target.value)}
          />
        </div>
        <div className="flex gap-2 md:col-span-3">
          <Button type="submit">Apply filters</Button>
          <Button type="button" variant="outline" onClick={clear}>
            Clear
          </Button>
          <span className="self-center text-xs text-muted-foreground">
            Times are in your local zone. The log is read-only.
          </span>
        </div>
      </form>

      {query.isError && (
        <p role="alert" className="text-sm text-destructive">
          {isApiError(query.error) ? query.error.message : 'The audit log could not be loaded.'}
        </p>
      )}

      <DataTable
        columns={columns}
        data={query.data?.content ?? []}
        isLoading={query.isLoading}
        emptyMessage="No audit entries match these filters."
        renderSubRow={(entry) => <DiffView entry={entry} />}
        serverPagination={{
          pageIndex,
          pageSize: PAGE_SIZE,
          pageCount: query.data?.totalPages ?? 0,
          totalElements: query.data?.totalElements ?? 0,
          onPageIndexChange: setPageIndex,
        }}
      />
    </div>
  )
}

export default AuditPage
