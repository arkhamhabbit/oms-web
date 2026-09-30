import * as React from 'react'
import { Link } from 'react-router-dom'
import type { ColumnDef } from '@tanstack/react-table'
import { InfoIcon, PlusIcon, XIcon } from 'lucide-react'
import { toast } from 'sonner'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { DataTable } from '@/components/data-table/DataTable'
import { NoticeBanner, noticeFromError, type Notice } from '@/components/common/NoticeBanner'
import { UserStatusBadge } from '@/components/users/UserStatusBadge'
import { usePermissions } from '@/auth/usePermissions'
import { isApiError } from '@/lib/api-error'
import { useUsersQuery } from '@/api/users'
import {
  useAllowCustomerMutation,
  useAllowedCustomersQuery,
  useDisallowCustomerMutation,
  type AllowedCustomer,
} from '@/api/products'

const PAGE_SIZE = 20

/**
 * A product's customer allowlist (1.0d). Only consulted while the audience is
 * `CUSTOMER_RESTRICTED`, but kept for any audience — so it stays editable, with a note saying
 * it is currently inert. A deleted account stays listed, flagged, and no longer passes (D4.17(3)).
 */
function ProductAllowlistCard({
  productId,
  restricted,
  canWrite,
}: {
  productId: string
  restricted: boolean
  canWrite: boolean
}) {
  const [pageIndex, setPageIndex] = React.useState(0)
  const [notice, setNotice] = React.useState<Notice | undefined>()
  const list = useAllowedCustomersQuery(productId, pageIndex, PAGE_SIZE)
  const allow = useAllowCustomerMutation(productId)
  const disallow = useDisallowCustomerMutation(productId)

  function add(userId: string) {
    setNotice(undefined)
    allow
      .mutateAsync(userId)
      .then(() => toast.success('Customer added to the allowlist'))
      .catch((error) => setNotice(noticeFromError(error, 'This product')))
  }

  function remove(customer: AllowedCustomer) {
    setNotice(undefined)
    disallow
      .mutateAsync(customer.userId!)
      .then(() => toast.success('Customer removed from the allowlist'))
      .catch((error) => setNotice(noticeFromError(error, 'This product')))
  }

  const listedIds = new Set((list.data?.content ?? []).map((c) => c.userId))

  const columns: ColumnDef<AllowedCustomer, unknown>[] = [
    {
      id: 'customer',
      header: 'Customer',
      cell: ({ row }) =>
        row.original.deleted ? (
          <span className="text-muted-foreground">Deleted account</span>
        ) : (
          <Link to={`/users/${row.original.userId}`} className="underline-offset-2 hover:underline">
            <span className="font-mono">{row.original.mobile}</span>
            {row.original.name && <span className="ml-2">{row.original.name}</span>}
          </Link>
        ),
    },
    {
      id: 'status',
      header: 'Status',
      cell: ({ row }) =>
        row.original.deleted ? (
          <Badge variant="destructive">Deleted — no longer passes</Badge>
        ) : (
          <UserStatusBadge status={row.original.status} />
        ),
    },
    {
      id: 'addedAt',
      header: 'Added',
      cell: ({ row }) =>
        row.original.addedAt ? new Date(row.original.addedAt).toLocaleString() : '',
    },
    {
      id: 'actions',
      header: '',
      cell: ({ row }) =>
        canWrite && (
          <Button
            size="sm"
            variant="ghost"
            aria-label={`Remove ${row.original.mobile ?? 'deleted account'}`}
            disabled={disallow.isPending}
            onClick={() => remove(row.original)}
          >
            <XIcon /> Remove
          </Button>
        ),
    },
  ]

  return (
    <Card>
      <CardHeader>
        <CardTitle>Customer allowlist</CardTitle>
        <CardDescription>
          The customers who can see this product while its audience is Customer restricted.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {!restricted && (
          <p className="flex items-start gap-2 rounded-md bg-muted p-3 text-sm text-muted-foreground">
            <InfoIcon className="mt-0.5 size-4 shrink-0" />
            <span>
              This product is not Customer restricted, so the list below is kept but not consulted —
              it takes effect when the audience is set to Customer restricted and saved.
            </span>
          </p>
        )}
        {notice && (
          <NoticeBanner
            notice={notice}
            onReload={() => {
              setNotice(undefined)
              void list.refetch()
            }}
            onDismiss={() => setNotice(undefined)}
          />
        )}
        {canWrite && <CustomerSearch listedIds={listedIds} pending={allow.isPending} onAdd={add} />}
        {list.isError && (
          <p role="alert" className="text-sm text-destructive">
            {isApiError(list.error) ? list.error.message : 'The allowlist could not be loaded.'}
          </p>
        )}
        <DataTable
          columns={columns}
          data={list.data?.content ?? []}
          isLoading={list.isLoading}
          emptyMessage="No customers on the allowlist."
          serverPagination={{
            pageIndex,
            pageSize: PAGE_SIZE,
            pageCount: list.data?.totalPages ?? 0,
            totalElements: list.data?.totalElements ?? 0,
            onPageIndexChange: setPageIndex,
          }}
        />
      </CardContent>
    </Card>
  )
}

/** Finds a customer by mobile, email or name through the users search. */
function CustomerSearch({
  listedIds,
  pending,
  onAdd,
}: {
  listedIds: Set<string | undefined>
  pending: boolean
  onAdd: (userId: string) => void
}) {
  const { has } = usePermissions()
  const [search, setSearch] = React.useState('')

  if (!has('identity.user.read')) {
    return (
      <p className="text-sm text-muted-foreground">
        Adding a customer needs the <code>identity.user.read</code> permission to find them.
      </p>
    )
  }

  return (
    <div className="flex flex-col gap-2">
      <Input
        placeholder="Find a customer by mobile, email or name…"
        aria-label="Find a customer to allow"
        value={search}
        onChange={(event) => setSearch(event.target.value)}
        className="w-80"
      />
      {search.trim().length >= 2 && (
        <CustomerResults
          search={search.trim()}
          listedIds={listedIds}
          pending={pending}
          onAdd={(id) => {
            onAdd(id)
            setSearch('')
          }}
        />
      )}
    </div>
  )
}

function CustomerResults({
  search,
  listedIds,
  pending,
  onAdd,
}: {
  search: string
  listedIds: Set<string | undefined>
  pending: boolean
  onAdd: (userId: string) => void
}) {
  const users = useUsersQuery({ page: 0, size: 8, search })
  const results = users.data?.content ?? []

  if (users.isLoading) {
    return <p className="text-sm text-muted-foreground">Searching…</p>
  }
  if (results.length === 0) {
    return <p className="text-sm text-muted-foreground">No customer matches “{search}”.</p>
  }
  return (
    <ul className="flex max-w-xl flex-col divide-y rounded-md border">
      {results.map((user) => (
        <li key={user.id} className="flex items-center gap-3 px-3 py-2 text-sm">
          <span className="font-mono">{user.mobile}</span>
          <span className="flex-1 truncate">{user.name}</span>
          <UserStatusBadge status={user.status} />
          {listedIds.has(user.id) ? (
            <span className="text-xs text-muted-foreground">Already listed</span>
          ) : (
            <Button size="sm" variant="outline" disabled={pending} onClick={() => onAdd(user.id!)}>
              <PlusIcon /> Allow
            </Button>
          )}
        </li>
      ))}
    </ul>
  )
}

export { ProductAllowlistCard }
