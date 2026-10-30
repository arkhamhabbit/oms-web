import * as React from 'react'
import { CheckCircle2Icon } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { isApiError } from '@/lib/api-error'
import { useUserAddressesQuery, useUserProfileIntakeQuery, type ProfileIntake } from '@/api/users'
import { INTAKE_KIND, summarizeIntakePayload } from './intake-summary'
import { formatDateTime } from '@/lib/dates'

const PAGE_SIZE = 10
const when = (value: string | undefined) => formatDateTime(value) || '—'

const OUTCOME: Record<
  NonNullable<ProfileIntake['outcome']>,
  { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }
> = {
  PENDING: { label: 'PENDING', variant: 'outline' },
  APPLIED: { label: 'APPLIED', variant: 'default' },
  REJECTED: { label: 'REJECTED', variant: 'destructive' },
}

/** The consumer's address book as OMS holds it. Read-only: edits are consumer-side (D5.14). */
function UserAddressesCard({ userId }: { userId: string }) {
  const query = useUserAddressesQuery(userId)
  const addresses = query.data ?? []

  return (
    <Card>
      <CardHeader>
        <CardTitle>Addresses</CardTitle>
        <CardDescription>
          Read-only — the customer edits their addresses in the app and OMS applies the change.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {query.isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}
        {query.isError && (
          <p role="alert" className="text-sm text-destructive">
            {isApiError(query.error) ? query.error.message : 'Addresses could not be loaded.'}
          </p>
        )}
        {query.data && addresses.length === 0 && (
          <p className="text-sm text-muted-foreground">No saved addresses.</p>
        )}
        {addresses.map((address) => (
          <div key={address.id} className="rounded-md border p-3 text-sm">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-medium">{address.label || 'Address'}</span>
              {address.isDefault && <Badge>Default</Badge>}
            </div>
            <p>{address.line1}</p>
            {address.landmark && <p className="text-muted-foreground">{address.landmark}</p>}
            <p>{address.pincode}</p>
            <p className="mt-1 flex flex-wrap items-center gap-1.5 text-muted-foreground">
              Delivery mobile <span className="font-mono">{address.deliveryMobile}</span>
              {address.deliveryMobileVerified ? (
                <span className="inline-flex items-center gap-1 text-foreground">
                  <CheckCircle2Icon className="size-4" aria-hidden /> Verified
                </span>
              ) : (
                <span>(not verified)</span>
              )}
            </p>
          </div>
        ))}
      </CardContent>
    </Card>
  )
}

/** The intake history: every profile change the app sent, and what OMS did with it. */
function UserProfileChangesCard({ userId }: { userId: string }) {
  const [page, setPage] = React.useState(0)
  const query = useUserProfileIntakeQuery(userId, page, PAGE_SIZE)
  const rows = query.data?.content ?? []
  const totalPages = query.data?.totalPages ?? 0

  return (
    <Card>
      <CardHeader>
        <CardTitle>Profile changes</CardTitle>
        <CardDescription>
          Changes the customer made in the app, newest first, and whether OMS applied them.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {query.isError && (
          <p role="alert" className="text-sm text-destructive">
            {isApiError(query.error) ? query.error.message : 'Profile changes could not be loaded.'}
          </p>
        )}
        {query.isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}
        {query.data && rows.length === 0 && (
          <p className="text-sm text-muted-foreground">No profile changes yet.</p>
        )}
        {rows.length > 0 && (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Change</TableHead>
                <TableHead>Outcome</TableHead>
                <TableHead>Tries</TableHead>
                <TableHead>Submitted</TableHead>
                <TableHead>Concluded</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => {
                const outcome = row.outcome ? OUTCOME[row.outcome] : undefined
                return (
                  <TableRow key={row.id}>
                    <TableCell className="whitespace-normal">
                      <div className="font-medium">{row.kind ? INTAKE_KIND[row.kind] : '—'}</div>
                      <div className="text-muted-foreground">
                        {summarizeIntakePayload(row.kind, row.payload, row.address)}
                      </div>
                    </TableCell>
                    <TableCell className="whitespace-normal">
                      <Badge variant={outcome?.variant ?? 'outline'}>
                        {outcome?.label ?? row.outcome}
                      </Badge>
                      {row.outcome === 'REJECTED' && (
                        <div className="mt-1 text-sm text-destructive">
                          <span className="font-mono font-semibold">{row.reason}</span>
                          {row.reasonMessage && <p>{row.reasonMessage}</p>}
                        </div>
                      )}
                    </TableCell>
                    <TableCell>{row.attempts ?? 0}</TableCell>
                    <TableCell>{when(row.submittedAt)}</TableCell>
                    <TableCell>{when(row.concludedAt)}</TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        )}
        {totalPages > 1 && (
          <div className="flex items-center justify-end gap-2 text-sm">
            <Button
              variant="outline"
              size="sm"
              disabled={page === 0}
              onClick={() => setPage((p) => p - 1)}
            >
              Previous
            </Button>
            <span>
              Page {page + 1} of {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={page + 1 >= totalPages}
              onClick={() => setPage((p) => p + 1)}
            >
              Next
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

export { UserAddressesCard, UserProfileChangesCard }
