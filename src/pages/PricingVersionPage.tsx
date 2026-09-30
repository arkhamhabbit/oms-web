import * as React from 'react'
import { Link, useParams } from 'react-router-dom'
import type { ColumnDef } from '@tanstack/react-table'
import { ArrowLeftIcon, InfoIcon } from 'lucide-react'
import { toast } from 'sonner'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { DataTable } from '@/components/data-table/DataTable'
import { ConfirmDialog } from '@/components/common/ConfirmDialog'
import { NoticeBanner, noticeFromError, type Notice } from '@/components/common/NoticeBanner'
import { PricingStateBadge } from '@/components/pricing/PricingStateBadge'
import { PriceMatrixCard } from '@/components/pricing/PriceMatrixCard'
import { VariantPicker } from '@/components/pricing/VariantPicker'
import { VariantPriceEditor } from '@/components/pricing/VariantPriceEditor'
import { useBreadcrumb } from '@/layouts/breadcrumb-context'
import { usePermissions } from '@/auth/usePermissions'
import { isApiError } from '@/lib/api-error'
import { formatMoney } from '@/lib/money'
import { localInputToInstant, priceAboveBase, pricingActions } from '@/lib/pricing'
import {
  usePricingVersionPricesQuery,
  usePricingVersionQuery,
  usePublishPricingVersionMutation,
  useUpdatePricingVersionMutation,
  useWithdrawPricingVersionMutation,
  type LevelPrice,
  type PricingVersion,
  type PricingVersionState,
} from '@/api/pricing'

const PRICES_PAGE_SIZE = 20

/** A withdrawn version never took effect — it was only ever scheduled. */
const EFFECTIVE_VERB: Partial<Record<PricingVersionState, string>> = {
  SCHEDULED: 'Takes effect',
  WITHDRAWN: 'Was scheduled for',
}

function formatDate(value: string | undefined) {
  return value ? new Date(value).toLocaleString() : ''
}

function BackLink() {
  return (
    <Link
      to="/pricing"
      className="inline-flex w-fit items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
    >
      <ArrowLeftIcon className="size-4" /> Pricing
    </Link>
  )
}

function Explainer({ children }: { children: React.ReactNode }) {
  return (
    <p className="flex items-start gap-2 rounded-md bg-muted p-3 text-sm text-muted-foreground">
      <InfoIcon className="mt-0.5 size-4 shrink-0" />
      <span>{children}</span>
    </p>
  )
}

function PricingVersionPage() {
  const { id = '' } = useParams()
  const { has } = usePermissions()
  const versionQuery = usePricingVersionQuery(id)
  const version = versionQuery.data

  useBreadcrumb([{ label: 'Pricing', to: '/pricing' }, { label: version?.name ?? 'Version' }])

  const [notice, setNotice] = React.useState<Notice | undefined>()
  const [variantId, setVariantId] = React.useState<string | undefined>()

  function fail(error: unknown) {
    setNotice(noticeFromError(error, 'This pricing version'))
  }
  function reload() {
    setNotice(undefined)
    void versionQuery.refetch()
  }

  if (versionQuery.isLoading) {
    return <p className="text-sm text-muted-foreground">Loading…</p>
  }
  if (versionQuery.isError || !version) {
    return (
      <div className="flex flex-col gap-3">
        <BackLink />
        <p className="text-sm">
          {isApiError(versionQuery.error)
            ? versionQuery.error.message
            : 'This pricing version could not be loaded.'}
        </p>
      </div>
    )
  }

  const actions = pricingActions(version.state)
  const canWrite = has('pricing.write')
  const canPublish = has('pricing.publish')
  const editable = actions.editable && canWrite

  return (
    <div className="flex max-w-4xl flex-col gap-4">
      <BackLink />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-xl font-semibold">{version.name}</h1>
          <PricingStateBadge state={version.state} />
        </div>
        <LifecycleActions
          version={version}
          canPublish={canPublish}
          onError={fail}
          onDone={() => setNotice(undefined)}
        />
      </div>
      <p className="-mt-2 text-sm text-muted-foreground">
        {version.effectiveFrom
          ? `${EFFECTIVE_VERB[version.state!] ?? 'Took effect'} ${formatDate(version.effectiveFrom)}`
          : 'Not published'}
        {' · '}
        {version.priceCount ?? 0} price{version.priceCount === 1 ? '' : 's'} set
        {version.withdrawnAt && ` · withdrawn ${formatDate(version.withdrawnAt)}`}
      </p>

      {notice && (
        <NoticeBanner notice={notice} onReload={reload} onDismiss={() => setNotice(undefined)} />
      )}
      {!actions.editable && (
        <Explainer>
          A published or withdrawn version is immutable — orders may cite its prices. To change
          pricing, create a new draft; it starts as a copy of the version in effect.
        </Explainer>
      )}
      {actions.editable && !canWrite && (
        <Explainer>
          You can view this draft but not edit it — that needs the <code>pricing.write</code>{' '}
          permission.
        </Explainer>
      )}

      {editable && (
        // Keyed on the stored name/notes, not `version`: every price save moves the version, and
        // that must not discard an unsaved name edit. The save still sends the latest version.
        <DraftDetailsCard
          key={`details-${version.name}-${version.notes}`}
          version={version}
          onError={fail}
        />
      )}
      {!actions.editable && version.notes && (
        <p className="text-sm">
          <span className="font-medium">Notes: </span>
          {version.notes}
        </p>
      )}

      <PricesCard
        versionId={version.id!}
        editable={editable}
        onPick={setVariantId}
        selectedVariantId={variantId}
      />

      {variantId && (
        <>
          <VariantPriceEditor
            key={variantId}
            versionId={version.id!}
            variantId={variantId}
            editable={editable}
            onClose={() => setVariantId(undefined)}
          />
          <PriceMatrixCard
            variantId={variantId}
            at={version.state === 'SCHEDULED' ? version.effectiveFrom : undefined}
            label={
              version.state === 'SCHEDULED'
                ? 'when this version takes effect'
                : version.state === 'DRAFT'
                  ? 'in effect now (a draft is not included until published)'
                  : 'in effect now'
            }
          />
        </>
      )}
    </div>
  )
}

function DraftDetailsCard({
  version,
  onError,
}: {
  version: PricingVersion
  onError: (error: unknown) => void
}) {
  const update = useUpdatePricingVersionMutation(version.id!)
  const [name, setName] = React.useState(version.name ?? '')
  const [notes, setNotes] = React.useState(version.notes ?? '')
  const [nameError, setNameError] = React.useState<string | undefined>()
  const dirty = name !== (version.name ?? '') || notes !== (version.notes ?? '')

  function save(event: React.FormEvent) {
    event.preventDefault()
    setNameError(undefined)
    update
      .mutateAsync({
        name: name.trim(),
        notes: notes.trim() || undefined,
        version: version.version!,
      })
      .then(() => toast.success('Draft saved'))
      .catch((error) => {
        const field = isApiError(error)
          ? error.fieldErrors.find((f) => f.field === 'name')
          : undefined
        if (field) {
          setNameError(field.message)
        } else {
          onError(error)
        }
      })
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Draft</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={save} className="flex flex-col gap-4">
          <div className="grid max-w-md gap-1.5">
            <Label htmlFor="draft-name">Name</Label>
            <Input id="draft-name" value={name} onChange={(e) => setName(e.target.value)} />
            {nameError && <p className="text-sm text-destructive">{nameError}</p>}
          </div>
          <div className="grid max-w-md gap-1.5">
            <Label htmlFor="draft-notes">Notes</Label>
            <Input id="draft-notes" value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
          <div>
            <Button type="submit" disabled={!dirty || !name.trim() || update.isPending}>
              Save draft
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}

function PricesCard({
  versionId,
  editable,
  onPick,
  selectedVariantId,
}: {
  versionId: string
  editable: boolean
  onPick: (variantId: string) => void
  selectedVariantId: string | undefined
}) {
  const [pageIndex, setPageIndex] = React.useState(0)
  const prices = usePricingVersionPricesQuery(versionId, pageIndex, PRICES_PAGE_SIZE)

  const columns: ColumnDef<LevelPrice, unknown>[] = [
    {
      id: 'sku',
      header: 'SKU',
      cell: ({ row }) => (
        <span className="font-mono">
          {row.original.skuCode}
          {row.original.variantId === selectedVariantId && (
            <Badge variant="secondary" className="ml-2">
              Open
            </Badge>
          )}
        </span>
      ),
    },
    { id: 'level', header: 'Level', cell: ({ row }) => row.original.pricingLevel },
    { id: 'price', header: 'Price', cell: ({ row }) => formatMoney(row.original.price) },
    {
      id: 'base',
      header: 'Base now',
      cell: ({ row }) => {
        const above = priceAboveBase(
          row.original.price?.amountMinor ?? null,
          row.original.baseSellingPrice?.amountMinor
        )
        return (
          <span className="flex items-center gap-1.5">
            {formatMoney(row.original.baseSellingPrice)}
            {above && <Badge variant="destructive">Above base — charged at base</Badge>}
          </span>
        )
      },
    },
  ]

  return (
    <Card>
      <CardHeader>
        <CardTitle>Prices</CardTitle>
        <CardDescription>
          The prices this version sets. Any variant or level not listed pays the base selling price.
          Choose a row to {editable ? 'edit it and ' : ''}preview what each tier pays.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {editable && (
          <div className="flex flex-col gap-1.5">
            <span className="text-sm font-medium">Price another variant</span>
            <VariantPicker onPick={onPick} />
          </div>
        )}
        {prices.isError && (
          <p role="alert" className="text-sm text-destructive">
            {isApiError(prices.error) ? prices.error.message : 'Prices could not be loaded.'}
          </p>
        )}
        <DataTable
          columns={columns}
          data={prices.data?.content ?? []}
          isLoading={prices.isLoading}
          emptyMessage="This version sets no prices — every tier pays the base selling price."
          onRowClick={(row) => onPick(row.variantId!)}
          serverPagination={{
            pageIndex,
            pageSize: PRICES_PAGE_SIZE,
            pageCount: prices.data?.totalPages ?? 0,
            totalElements: prices.data?.totalElements ?? 0,
            onPageIndexChange: setPageIndex,
          }}
        />
      </CardContent>
    </Card>
  )
}

function LifecycleActions({
  version,
  canPublish,
  onError,
  onDone,
}: {
  version: PricingVersion
  canPublish: boolean
  onError: (error: unknown) => void
  onDone: () => void
}) {
  const actions = pricingActions(version.state)
  const publish = usePublishPricingVersionMutation(version.id!)
  const withdraw = useWithdrawPricingVersionMutation(version.id!)
  const [publishOpen, setPublishOpen] = React.useState(false)
  const [withdrawOpen, setWithdrawOpen] = React.useState(false)
  const [effectiveFrom, setEffectiveFrom] = React.useState('')
  // A hint only (the server refuses a backdated publish); judged when typed, not during render.
  const [inPast, setInPast] = React.useState(false)
  // The server's refusal of the chosen time (400 on `effectiveFrom`) — shown by the input, dialog open.
  const [timeError, setTimeError] = React.useState<string | undefined>()

  if (!actions.publishable && !actions.withdrawable) {
    return null
  }

  const instant = localInputToInstant(effectiveFrom)

  function runPublish() {
    setTimeError(undefined)
    publish
      .mutateAsync({ version: version.version!, effectiveFrom: instant })
      .then((published) => {
        setPublishOpen(false)
        onDone()
        toast.success(
          published.state === 'SCHEDULED'
            ? 'Version scheduled'
            : 'Version published — now in effect'
        )
      })
      .catch((error) => {
        const field = isApiError(error)
          ? error.fieldErrors.find((f) => f.field === 'effectiveFrom')
          : undefined
        if (field) {
          setTimeError(field.message)
          return
        }
        setPublishOpen(false)
        onError(error)
      })
  }

  function runWithdraw() {
    withdraw
      .mutateAsync(version.version!)
      .then(() => {
        setWithdrawOpen(false)
        onDone()
        toast.success('Scheduled version withdrawn')
      })
      .catch((error) => {
        setWithdrawOpen(false)
        onError(error)
      })
  }

  return (
    <div className="flex items-center gap-2">
      {!canPublish && (
        <span className="text-xs text-muted-foreground">
          Publishing needs <code>pricing.publish</code>
        </span>
      )}
      {actions.publishable && (
        <Button disabled={!canPublish} onClick={() => setPublishOpen(true)}>
          Publish…
        </Button>
      )}
      {actions.withdrawable && (
        <Button variant="destructive" disabled={!canPublish} onClick={() => setWithdrawOpen(true)}>
          Withdraw…
        </Button>
      )}

      <ConfirmDialog
        open={publishOpen}
        onOpenChange={setPublishOpen}
        title="Publish pricing version"
        confirmLabel={instant ? 'Schedule' : 'Publish now'}
        pending={publish.isPending}
        onConfirm={runPublish}
      >
        <p>
          Publishing makes this version and its {version.priceCount ?? 0} price
          {version.priceCount === 1 ? '' : 's'} immutable. From the moment it takes effect, every
          member pays these prices; anything it does not price pays the base selling price.
        </p>
        <div className="grid gap-1.5 text-foreground">
          <Label htmlFor="publish-effective-from">Takes effect (your local time)</Label>
          <Input
            id="publish-effective-from"
            type="datetime-local"
            value={effectiveFrom}
            onChange={(e) => {
              const next = localInputToInstant(e.target.value)
              setEffectiveFrom(e.target.value)
              setTimeError(undefined)
              setInPast(!!next && new Date(next).getTime() < Date.now())
            }}
          />
          <span className="text-xs text-muted-foreground">
            Leave empty to publish now. A future time schedules it; the current version stays in
            effect until then, and a scheduled version can still be withdrawn.
          </span>
          {timeError && (
            <span role="alert" className="text-sm text-destructive">
              Takes effect: {timeError}
            </span>
          )}
          {inPast && !timeError && (
            <span className="text-sm text-destructive">
              That time has passed — a version can&apos;t be backdated, so the server will refuse
              it.
            </span>
          )}
        </div>
      </ConfirmDialog>

      <ConfirmDialog
        open={withdrawOpen}
        onOpenChange={setWithdrawOpen}
        title="Withdraw scheduled version"
        confirmLabel="Withdraw"
        destructive
        pending={withdraw.isPending}
        onConfirm={runWithdraw}
      >
        <p>
          {version.name} was due to take effect {formatDate(version.effectiveFrom)}. Withdrawing it
          is final: it will never take effect, and the version in effect now is untouched. It has
          priced no orders, so nothing is lost.
        </p>
      </ConfirmDialog>
    </div>
  )
}

export default PricingVersionPage
