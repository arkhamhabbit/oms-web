import * as React from 'react'
import type { ColumnDef } from '@tanstack/react-table'
import { ArrowDownIcon, ArrowUpIcon, PencilIcon, PlusIcon } from 'lucide-react'

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
import { AttributeFormDialog } from '@/components/catalog/AttributeFormDialog'
import { AttributeGroupFormDialog } from '@/components/catalog/AttributeGroupFormDialog'
import { AttributeValuesPanel } from '@/components/catalog/AttributeValuesPanel'
import { useBreadcrumb } from '@/layouts/breadcrumb-context'
import { usePermissions } from '@/auth/usePermissions'
import { toastApiError } from '@/lib/api-error'
import { hasValues } from '@/lib/attribute-rules'
import { moveItem } from '@/lib/reorder'
import {
  useAttributeGroupsQuery,
  useAttributesQuery,
  useDeactivateAttributeGroupMutation,
  useDeactivateAttributeMutation,
  useReactivateAttributeGroupMutation,
  useReactivateAttributeMutation,
  useReorderAttributeGroupsMutation,
  useReorderAttributesMutation,
  type Attribute,
  type AttributeDataType,
  type AttributeGroup,
  type AttributeKind,
} from '@/api/attributes'

const PAGE_SIZE = 20
const KIND_OPTIONS: AttributeKind[] = ['OPTION', 'SPEC']

function AttributesTab() {
  const { has } = usePermissions()
  const canWrite = has('catalog.attribute.write')

  const [pageIndex, setPageIndex] = React.useState(0)
  const [kind, setKind] = React.useState<AttributeKind | 'ALL'>('ALL')
  const [groupId, setGroupId] = React.useState<string | 'ALL'>('ALL')
  const [active, setActive] = React.useState<'ALL' | 'true' | 'false'>('ALL')
  const [search, setSearch] = React.useState('')

  const isFiltered = kind !== 'ALL' || groupId !== 'ALL' || active !== 'ALL' || search !== ''

  const groupsQuery = useAttributeGroupsQuery()
  const attributesQuery = useAttributesQuery({
    page: pageIndex,
    size: PAGE_SIZE,
    kind: kind === 'ALL' ? undefined : kind,
    groupId: groupId === 'ALL' ? undefined : groupId,
    active: active === 'ALL' ? undefined : active === 'true',
    search,
  })

  const deactivate = useDeactivateAttributeMutation()
  const reactivate = useReactivateAttributeMutation()
  const reorder = useReorderAttributesMutation()

  const [formOpen, setFormOpen] = React.useState(false)
  const [editingAttribute, setEditingAttribute] = React.useState<Attribute | undefined>(undefined)

  const rows = attributesQuery.data?.content ?? []
  const groupsById = new Map((groupsQuery.data ?? []).map((g) => [g.id, g]))

  function openCreate() {
    setEditingAttribute(undefined)
    setFormOpen(true)
  }
  function openEdit(attribute: Attribute) {
    setEditingAttribute(attribute)
    setFormOpen(true)
  }

  function toggleActive(attribute: Attribute) {
    const mutation = attribute.active ? deactivate : reactivate
    mutation.mutateAsync(attribute.id!).catch((error) => toastApiError(error))
  }

  function move(index: number, direction: -1 | 1) {
    const reordered = moveItem(rows, index, direction)
    if (reordered === rows) {
      return
    }
    reorder
      .mutateAsync({ orderedIds: reordered.map((a) => a.id!) })
      .catch((error) => toastApiError(error))
  }

  const columns: ColumnDef<Attribute, unknown>[] = [
    { accessorKey: 'code', header: 'Code' },
    { accessorKey: 'name', header: 'Name' },
    { accessorKey: 'kind', header: 'Kind' },
    { accessorKey: 'dataType', header: 'Data type' },
    {
      id: 'group',
      header: 'Group',
      cell: ({ row }) => groupsById.get(row.original.groupId)?.name ?? '—',
    },
    {
      id: 'active',
      header: 'Active',
      cell: ({ row }) => (
        <Badge variant={row.original.active ? 'default' : 'outline'}>
          {row.original.active ? 'Active' : 'Inactive'}
        </Badge>
      ),
    },
    {
      id: 'actions',
      header: '',
      cell: ({ row }) => {
        const index = rows.indexOf(row.original)
        return (
          <div className="flex items-center justify-end gap-1">
            {!isFiltered && (
              <>
                <Button
                  variant="ghost"
                  size="icon"
                  disabled={!canWrite || index === 0}
                  title="Move up"
                  onClick={() => move(index, -1)}
                >
                  <ArrowUpIcon />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  disabled={!canWrite || index === rows.length - 1}
                  title="Move down"
                  onClick={() => move(index, 1)}
                >
                  <ArrowDownIcon />
                </Button>
              </>
            )}
            <Button
              variant="ghost"
              size="icon"
              disabled={!canWrite}
              title="Edit"
              onClick={() => openEdit(row.original)}
            >
              <PencilIcon />
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={!canWrite}
              onClick={() => toggleActive(row.original)}
            >
              {row.original.active ? 'Deactivate' : 'Reactivate'}
            </Button>
          </div>
        )
      },
    },
  ]

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <Input
            placeholder="Search code or name…"
            value={search}
            onChange={(event) => {
              setSearch(event.target.value)
              setPageIndex(0)
            }}
            className="w-64"
          />
          <Select
            value={kind}
            onValueChange={(value) => {
              setKind(value as AttributeKind | 'ALL')
              setPageIndex(0)
            }}
          >
            <SelectTrigger className="w-36">
              <SelectValue placeholder="Kind" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All kinds</SelectItem>
              {KIND_OPTIONS.map((k) => (
                <SelectItem key={k} value={k}>
                  {k}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={groupId}
            onValueChange={(value) => {
              setGroupId(value)
              setPageIndex(0)
            }}
          >
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Group" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All groups</SelectItem>
              {(groupsQuery.data ?? []).map((group) => (
                <SelectItem key={group.id} value={group.id!}>
                  {group.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={active}
            onValueChange={(value) => {
              setActive(value as 'ALL' | 'true' | 'false')
              setPageIndex(0)
            }}
          >
            <SelectTrigger className="w-36">
              <SelectValue placeholder="Active" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">Active or not</SelectItem>
              <SelectItem value="true">Active</SelectItem>
              <SelectItem value="false">Inactive</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Button disabled={!canWrite} onClick={openCreate}>
          <PlusIcon /> New attribute
        </Button>
      </div>

      <DataTable
        columns={columns}
        data={rows}
        isLoading={attributesQuery.isLoading}
        emptyMessage="No attributes match these filters."
        renderSubRow={(attribute) =>
          hasValues(attribute.dataType as AttributeDataType) ? (
            <AttributeValuesPanel attributeId={attribute.id!} canWrite={canWrite} />
          ) : (
            <p className="p-3 text-sm text-muted-foreground">
              {attribute.kind} attributes of type {attribute.dataType} do not have values.
            </p>
          )
        }
        serverPagination={{
          pageIndex,
          pageSize: PAGE_SIZE,
          pageCount: attributesQuery.data?.totalPages ?? 0,
          totalElements: attributesQuery.data?.totalElements ?? 0,
          onPageIndexChange: setPageIndex,
        }}
      />

      <AttributeFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        attribute={editingAttribute}
      />
    </div>
  )
}

function GroupsTab() {
  const { has } = usePermissions()
  const canWrite = has('catalog.attribute.write')

  const groupsQuery = useAttributeGroupsQuery()
  const deactivate = useDeactivateAttributeGroupMutation()
  const reactivate = useReactivateAttributeGroupMutation()
  const reorder = useReorderAttributeGroupsMutation()

  const [formOpen, setFormOpen] = React.useState(false)
  const [editingGroup, setEditingGroup] = React.useState<AttributeGroup | undefined>(undefined)

  const rows = groupsQuery.data ?? []

  function openCreate() {
    setEditingGroup(undefined)
    setFormOpen(true)
  }
  function openEdit(group: AttributeGroup) {
    setEditingGroup(group)
    setFormOpen(true)
  }

  function toggleActive(group: AttributeGroup) {
    const mutation = group.active ? deactivate : reactivate
    mutation.mutateAsync(group.id!).catch((error) => toastApiError(error))
  }

  function move(index: number, direction: -1 | 1) {
    const reordered = moveItem(rows, index, direction)
    if (reordered === rows) {
      return
    }
    reorder
      .mutateAsync({ orderedIds: reordered.map((g) => g.id!) })
      .catch((error) => toastApiError(error))
  }

  const columns: ColumnDef<AttributeGroup, unknown>[] = [
    { accessorKey: 'name', header: 'Name' },
    { accessorKey: 'displayOrder', header: 'Order' },
    {
      id: 'active',
      header: 'Active',
      cell: ({ row }) => (
        <Badge variant={row.original.active ? 'default' : 'outline'}>
          {row.original.active ? 'Active' : 'Inactive'}
        </Badge>
      ),
    },
    {
      id: 'actions',
      header: '',
      cell: ({ row }) => {
        const index = rows.indexOf(row.original)
        return (
          <div className="flex items-center justify-end gap-1">
            <Button
              variant="ghost"
              size="icon"
              disabled={!canWrite || index === 0}
              title="Move up"
              onClick={() => move(index, -1)}
            >
              <ArrowUpIcon />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              disabled={!canWrite || index === rows.length - 1}
              title="Move down"
              onClick={() => move(index, 1)}
            >
              <ArrowDownIcon />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              disabled={!canWrite}
              title="Edit"
              onClick={() => openEdit(row.original)}
            >
              <PencilIcon />
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={!canWrite}
              onClick={() => toggleActive(row.original)}
            >
              {row.original.active ? 'Deactivate' : 'Reactivate'}
            </Button>
          </div>
        )
      },
    },
  ]

  return (
    <div className="flex flex-col gap-4">
      <div className="flex justify-end">
        <Button disabled={!canWrite} onClick={openCreate}>
          <PlusIcon /> New group
        </Button>
      </div>

      <DataTable
        columns={columns}
        data={rows}
        isLoading={groupsQuery.isLoading}
        emptyMessage="No attribute groups yet."
      />

      <AttributeGroupFormDialog open={formOpen} onOpenChange={setFormOpen} group={editingGroup} />
    </div>
  )
}

function AttributesPage() {
  useBreadcrumb([{ label: 'Attributes' }])
  const [tab, setTab] = React.useState<'attributes' | 'groups'>('attributes')

  return (
    <div className="flex flex-col gap-4">
      <div className="flex gap-2">
        <Button
          variant={tab === 'attributes' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setTab('attributes')}
        >
          Attributes
        </Button>
        <Button
          variant={tab === 'groups' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setTab('groups')}
        >
          Groups
        </Button>
      </div>
      {tab === 'attributes' ? <AttributesTab /> : <GroupsTab />}
    </div>
  )
}

export default AttributesPage
