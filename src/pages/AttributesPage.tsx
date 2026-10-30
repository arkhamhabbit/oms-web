import * as React from 'react'
import type { ColumnDef } from '@tanstack/react-table'
import { ArrowDownIcon, ArrowUpIcon, PencilIcon, PlusIcon } from 'lucide-react'

import { toast } from 'sonner'

import { ConfirmDialog } from '@/components/common/ConfirmDialog'
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
import { ANY_KIND, ANY_STATE, ATTRIBUTE_DATA_TYPE_LABEL, ATTRIBUTE_KIND_LABEL, labelOf } from '@/lib/labels'

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

  const [toDeactivate, setToDeactivate] = React.useState<Attribute | undefined>()

  function toggleActive(attribute: Attribute) {
    if (attribute.active) {
      setToDeactivate(attribute)
      return
    }
    reactivate
      .mutateAsync(attribute.id!)
      .then(() => toast.success(`${attribute.name} reactivated`))
      .catch((error) => toastApiError(error))
  }

  function confirmDeactivate() {
    const attribute = toDeactivate
    if (!attribute) {
      return
    }
    deactivate
      .mutateAsync(attribute.id!)
      .then(() => toast.success(`${attribute.name} deactivated`))
      .catch((error) => toastApiError(error))
      .finally(() => setToDeactivate(undefined))
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
    {
      id: 'kind',
      header: 'Kind',
      cell: ({ row }) => labelOf(ATTRIBUTE_KIND_LABEL, row.original.kind),
    },
    {
      id: 'dataType',
      header: 'Data type',
      cell: ({ row }) => labelOf(ATTRIBUTE_DATA_TYPE_LABEL, row.original.dataType),
    },
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
              <SelectItem value="ALL">{ANY_KIND}</SelectItem>
              {KIND_OPTIONS.map((k) => (
                <SelectItem key={k} value={k}>
                  {ATTRIBUTE_KIND_LABEL[k]}
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
              <SelectItem value="ALL">{ANY_STATE}</SelectItem>
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
              {labelOf(ATTRIBUTE_KIND_LABEL, attribute.kind)} attributes of type{' '}
              {labelOf(ATTRIBUTE_DATA_TYPE_LABEL, attribute.dataType).toLowerCase()} do not have values.
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

      <ConfirmDialog
        open={!!toDeactivate}
        onOpenChange={(open) => !open && setToDeactivate(undefined)}
        title="Deactivate this attribute"
        confirmLabel="Deactivate"
        destructive
        pending={deactivate.isPending}
        onConfirm={confirmDeactivate}
      >
        <p>
          {toDeactivate?.name} stops being offered on products and variants. Values already set
          stay on the records that carry them, marked Inactive. Reactivate brings it back.
        </p>
      </ConfirmDialog>
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

  const [toDeactivate, setToDeactivate] = React.useState<AttributeGroup | undefined>()

  function toggleActive(group: AttributeGroup) {
    if (group.active) {
      setToDeactivate(group)
      return
    }
    reactivate
      .mutateAsync(group.id!)
      .then(() => toast.success(`${group.name} reactivated`))
      .catch((error) => toastApiError(error))
  }

  function confirmDeactivate() {
    const group = toDeactivate
    if (!group) {
      return
    }
    deactivate
      .mutateAsync(group.id!)
      .then(() => toast.success(`${group.name} deactivated`))
      .catch((error) => toastApiError(error))
      .finally(() => setToDeactivate(undefined))
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

      <ConfirmDialog
        open={!!toDeactivate}
        onOpenChange={(open) => !open && setToDeactivate(undefined)}
        title="Deactivate this group"
        confirmLabel="Deactivate"
        destructive
        pending={deactivate.isPending}
        onConfirm={confirmDeactivate}
      >
        <p>
          {toDeactivate?.name} stops being offered for new attributes. Attributes already in it
          stay as they are. Reactivate brings it back.
        </p>
      </ConfirmDialog>
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
