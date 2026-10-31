import * as React from 'react'
import { useNavigate } from 'react-router-dom'
import type { ColumnDef } from '@tanstack/react-table'

import { ListError } from '@/components/common/PageParts'
import { DataTable } from '@/components/data-table/DataTable'
import { BatchSelect } from '@/components/inventory/BatchSelect'
import { MovementsTable } from '@/components/inventory/MovementsTable'
import type { StockFormSeed } from '@/components/inventory/StockAdjustDialog'
import { VariantChoice, type ChosenVariant } from '@/components/inventory/VariantChoice'
import { WarehouseSelect } from '@/components/inventory/WarehouseSelect'
import { FilterSelect } from '@/components/common/FilterSelect'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { EXPIRING_SOON_DAYS_DEFAULT, LOW_STOCK_THRESHOLD_DEFAULT } from '@/api/enums.gen'
import {
  useBatchesQuery,
  useExpiringSoonQuery,
  useLowStockQuery,
  useReasonCodesQuery,
  useStockLevelsQuery,
  useStockMovementsQuery,
  useStockTotalsQuery,
  type ExpiringStock,
  type MovementType,
  type StockLevel,
  type StockTotal,
} from '@/api/inventory'
import { MOVEMENT_TYPES } from '@/lib/inventory'
import { istDayStart } from '@/lib/orders'
import type { ReasonCode } from '@/api/inventory'
import { formatDateTime } from '@/lib/dates'
import { MOVEMENT_TYPE_LABEL, REASON_CODE_LABEL } from '@/lib/labels'

const PAGE_SIZE = 20
/** The reference types the contract names for the movements filter; the id is a UUID. */
const REFERENCE_TYPES = [
  { value: 'TRANSFER', label: 'Transfer' },
  { value: 'PURCHASE_ORDER', label: 'Purchase order' },
  { value: 'RESERVATION', label: 'Reservation' },
]
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export interface StockTabActions {
  canAdjust: boolean
  canTransfer: boolean
  onAdjust: (seed?: StockFormSeed) => void
  onTransfer: (seed?: StockFormSeed) => void
}

/** The URL carries the variant as `variant` + `sku` so a link from the Totals row can open its levels. */
export interface StockTabSeed {
  variantId?: string
  sku?: string
  warehouseId?: string
  batchId?: string
  referenceType?: string
  referenceId?: string
}

function seedVariant(seed: StockTabSeed): ChosenVariant | null {
  return seed.variantId ? { id: seed.variantId, skuCode: seed.sku ?? '', name: '' } : null
}

function RowActions({ actions, seed }: { actions: StockTabActions; seed: StockFormSeed }) {
  return (
    <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
      <Button
        size="sm"
        variant="outline"
        disabled={!actions.canAdjust}
        title={actions.canAdjust ? undefined : 'Needs inventory.adjust'}
        onClick={() => actions.onAdjust(seed)}
      >
        Adjust
      </Button>
      <Button
        size="sm"
        variant="outline"
        disabled={!actions.canTransfer}
        title={actions.canTransfer ? undefined : 'Needs inventory.transfer'}
        onClick={() => actions.onTransfer(seed)}
      >
        Transfer
      </Button>
    </div>
  )
}

// ---- Totals ---------------------------------------------------------------------------

function TotalsTab({ actions }: { actions: StockTabActions }) {
  const navigate = useNavigate()
  const [pageIndex, setPageIndex] = React.useState(0)
  const [search, setSearch] = React.useState('')
  const searching = search.trim() !== ''
  const totals = useStockTotalsQuery({ page: pageIndex, size: PAGE_SIZE, q: search.trim() })

  const columns: ColumnDef<StockTotal, unknown>[] = [
    {
      id: 'sku',
      header: 'SKU',
      cell: ({ row }) => <span className="font-mono">{row.original.skuCode}</span>,
    },
    { id: 'name', header: 'Product', cell: ({ row }) => row.original.variantName },
    { id: 'onHand', header: 'On hand', cell: ({ row }) => row.original.quantityOnHand },
    { id: 'sellable', header: 'Sellable', cell: ({ row }) => row.original.sellableOnHand },
    { id: 'reserved', header: 'Reserved', cell: ({ row }) => row.original.reserved },
    {
      id: 'available',
      header: 'Available',
      cell: ({ row }) => <span className="font-medium">{row.original.available}</span>,
    },
    {
      id: 'actions',
      header: '',
      cell: ({ row }) => (
        <RowActions
          actions={actions}
          seed={{
            variant: {
              id: row.original.variantId!,
              skuCode: row.original.skuCode ?? '',
              name: row.original.variantName ?? '',
              batchTracked: row.original.batchTracked,
            },
          }}
        />
      ),
    },
  ]

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-end gap-2">
        <Input
          placeholder="Search by SKU or product"
          aria-label="Search by SKU or product"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value)
            setPageIndex(0)
          }}
          className="w-64"
        />
        <p className="text-xs text-muted-foreground">
          Sellable is what the storefront may offer; available is sellable less what shoppers hold
          in open reservations.
        </p>
      </div>
      {totals.isError && <ListError error={totals.error} what="Stock totals" />}
      <DataTable
        columns={columns}
        data={totals.data?.content ?? []}
        isLoading={totals.isLoading}
        emptyMessage={
          searching ? 'No SKU or product matches that search.' : 'No stock has been recorded yet.'
        }
        onRowClick={(t) =>
          navigate(
            `/inventory/stock?tab=levels&variant=${t.variantId}&sku=${encodeURIComponent(t.skuCode ?? '')}`
          )
        }
        serverPagination={{
          pageIndex,
          pageSize: PAGE_SIZE,
          pageCount: totals.data?.totalPages ?? 0,
          totalElements: totals.data?.totalElements ?? 0,
          onPageIndexChange: setPageIndex,
        }}
      />
    </div>
  )
}

// ---- Levels ---------------------------------------------------------------------------

function LevelsTab({ actions, seed }: { actions: StockTabActions; seed: StockTabSeed }) {
  const [pageIndex, setPageIndex] = React.useState(0)
  const [variant, setVariant] = React.useState<ChosenVariant | null>(seedVariant(seed))
  const [warehouseId, setWarehouseId] = React.useState(seed.warehouseId ?? '')
  const [batchId, setBatchId] = React.useState(seed.batchId ?? '')
  const [includeEmpty, setIncludeEmpty] = React.useState(false)

  const batches = useBatchesQuery({ page: 0, size: 100, variantId: variant?.id }, !!variant)
  const levels = useStockLevelsQuery({
    page: pageIndex,
    size: PAGE_SIZE,
    variantId: variant?.id,
    warehouseId: warehouseId || undefined,
    batchId: batchId || undefined,
    includeEmpty: includeEmpty || undefined,
  })

  const columns: ColumnDef<StockLevel, unknown>[] = [
    {
      id: 'sku',
      header: 'SKU',
      cell: ({ row }) => <span className="font-mono">{row.original.skuCode}</span>,
    },
    { id: 'name', header: 'Product', cell: ({ row }) => row.original.variantName },
    {
      id: 'warehouse',
      header: 'Warehouse',
      cell: ({ row }) => (
        <span>
          <span className="font-mono">{row.original.warehouseCode}</span>{' '}
          {row.original.warehouseName}
        </span>
      ),
    },
    {
      id: 'batch',
      header: 'Batch',
      cell: ({ row }) => <span className="font-mono">{row.original.batchNumber ?? ''}</span>,
    },
    { id: 'onHand', header: 'On hand', cell: ({ row }) => <b>{row.original.quantityOnHand}</b> },
    { id: 'updated', header: 'Updated', cell: ({ row }) => formatDateTime(row.original.updatedAt) },
    {
      id: 'actions',
      header: '',
      cell: ({ row }) => (
        <RowActions
          actions={actions}
          seed={{
            variant: {
              id: row.original.variantId!,
              skuCode: row.original.skuCode ?? '',
              name: row.original.variantName ?? '',
              batchTracked: row.original.batchTracked,
            },
            warehouseId: row.original.warehouseId,
            batchId: row.original.batchId,
          }}
        />
      ),
    },
  ]

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-start gap-3">
        <div className="grid gap-1">
          <span className="text-xs text-muted-foreground">Variant</span>
          <VariantChoice
            value={variant}
            onChange={(next) => {
              setVariant(next)
              setBatchId('')
              setPageIndex(0)
            }}
            ariaLabel="Find a product or SKU to filter levels"
          />
        </div>
        <div className="grid gap-1">
          <span className="text-xs text-muted-foreground">Warehouse</span>
          <WarehouseSelect
            value={warehouseId}
            onChange={(next) => {
              setWarehouseId(next)
              setPageIndex(0)
            }}
            ariaLabel="Warehouse filter"
            allLabel="All warehouses"
          />
        </div>
        {variant && (
          <div className="grid gap-1">
            <span className="text-xs text-muted-foreground">Batch</span>
            <BatchSelect
              batches={batches.data?.content ?? []}
              value={batchId}
              onChange={(next) => {
                setBatchId(next)
                setPageIndex(0)
              }}
              ariaLabel="Batch filter"
              allLabel="All batches"
            />
          </div>
        )}
        <label className="mt-5 flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={includeEmpty}
            onChange={(e) => {
              setIncludeEmpty(e.target.checked)
              setPageIndex(0)
            }}
          />
          Include empty locations
        </label>
      </div>
      {levels.isError && <ListError error={levels.error} what="Stock levels" />}
      <DataTable
        columns={columns}
        data={levels.data?.content ?? []}
        isLoading={levels.isLoading}
        emptyMessage="No stock at any location matches these filters."
        serverPagination={{
          pageIndex,
          pageSize: PAGE_SIZE,
          pageCount: levels.data?.totalPages ?? 0,
          totalElements: levels.data?.totalElements ?? 0,
          onPageIndexChange: setPageIndex,
        }}
      />
    </div>
  )
}

// ---- Low stock ------------------------------------------------------------------------

function wholeOrUndefined(typed: string): number | undefined {
  return /^\d+$/.test(typed.trim()) ? Number.parseInt(typed, 10) : undefined
}

function LowStockTab() {
  const [pageIndex, setPageIndex] = React.useState(0)
  const [threshold, setThreshold] = React.useState(String(LOW_STOCK_THRESHOLD_DEFAULT))
  const [warehouseId, setWarehouseId] = React.useState('')
  const low = useLowStockQuery({
    page: pageIndex,
    size: PAGE_SIZE,
    threshold: wholeOrUndefined(threshold),
    warehouseId: warehouseId || undefined,
  })

  const columns: ColumnDef<StockLevel, unknown>[] = [
    {
      id: 'sku',
      header: 'SKU',
      cell: ({ row }) => <span className="font-mono">{row.original.skuCode}</span>,
    },
    { id: 'name', header: 'Product', cell: ({ row }) => row.original.variantName },
    {
      id: 'warehouse',
      header: 'Warehouse',
      cell: ({ row }) => <span className="font-mono">{row.original.warehouseCode}</span>,
    },
    {
      id: 'batch',
      header: 'Batch',
      cell: ({ row }) => <span className="font-mono">{row.original.batchNumber ?? ''}</span>,
    },
    { id: 'onHand', header: 'On hand', cell: ({ row }) => <b>{row.original.quantityOnHand}</b> },
  ]

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-end gap-3">
        <label className="grid gap-1 text-xs text-muted-foreground">
          At or below
          <Input
            inputMode="numeric"
            aria-label="Low stock threshold"
            placeholder={String(LOW_STOCK_THRESHOLD_DEFAULT)}
            value={threshold}
            onChange={(e) => {
              setThreshold(e.target.value)
              setPageIndex(0)
            }}
            className="w-40"
          />
        </label>
        <WarehouseSelect
          value={warehouseId}
          onChange={(next) => {
            setWarehouseId(next)
            setPageIndex(0)
          }}
          ariaLabel="Warehouse filter"
          allLabel="All warehouses"
        />
        <p className="text-xs text-muted-foreground">
          One flat threshold for every SKU, lowest first. A location that never held anything does
          not appear.
        </p>
      </div>
      {low.isError && <ListError error={low.error} what="Low stock" />}
      <DataTable
        columns={columns}
        data={low.data?.content ?? []}
        isLoading={low.isLoading}
        emptyMessage="Nothing is at or below that level."
        serverPagination={{
          pageIndex,
          pageSize: PAGE_SIZE,
          pageCount: low.data?.totalPages ?? 0,
          totalElements: low.data?.totalElements ?? 0,
          onPageIndexChange: setPageIndex,
        }}
      />
    </div>
  )
}

// ---- Expiring soon --------------------------------------------------------------------

function ExpiringTab() {
  const [pageIndex, setPageIndex] = React.useState(0)
  const [days, setDays] = React.useState(String(EXPIRING_SOON_DAYS_DEFAULT))
  const [warehouseId, setWarehouseId] = React.useState('')
  const expiring = useExpiringSoonQuery({
    page: pageIndex,
    size: PAGE_SIZE,
    withinDays: wholeOrUndefined(days),
    warehouseId: warehouseId || undefined,
  })

  const columns: ColumnDef<ExpiringStock, unknown>[] = [
    {
      id: 'sku',
      header: 'SKU',
      cell: ({ row }) => <span className="font-mono">{row.original.skuCode}</span>,
    },
    { id: 'name', header: 'Product', cell: ({ row }) => row.original.variantName },
    {
      id: 'warehouse',
      header: 'Warehouse',
      cell: ({ row }) => <span className="font-mono">{row.original.warehouseCode}</span>,
    },
    {
      id: 'batch',
      header: 'Batch',
      cell: ({ row }) => <span className="font-mono">{row.original.batchNumber}</span>,
    },
    { id: 'expires', header: 'Expires', cell: ({ row }) => formatDateTime(row.original.expiresAt) },
    { id: 'onHand', header: 'On hand', cell: ({ row }) => <b>{row.original.quantityOnHand}</b> },
  ]

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-end gap-3">
        <label className="grid gap-1 text-xs text-muted-foreground">
          Expiring within (days)
          <Input
            inputMode="numeric"
            aria-label="Expiring within days"
            placeholder={String(EXPIRING_SOON_DAYS_DEFAULT)}
            value={days}
            onChange={(e) => {
              setDays(e.target.value)
              setPageIndex(0)
            }}
            className="w-44"
          />
        </label>
        <WarehouseSelect
          value={warehouseId}
          onChange={(next) => {
            setWarehouseId(next)
            setPageIndex(0)
          }}
          ariaLabel="Warehouse filter"
          allLabel="All warehouses"
        />
      </div>
      {expiring.isError && <ListError error={expiring.error} what="Expiring stock" />}
      <DataTable
        columns={columns}
        data={expiring.data?.content ?? []}
        isLoading={expiring.isLoading}
        emptyMessage="No batch with stock on hand expires in that window."
        serverPagination={{
          pageIndex,
          pageSize: PAGE_SIZE,
          pageCount: expiring.data?.totalPages ?? 0,
          totalElements: expiring.data?.totalElements ?? 0,
          onPageIndexChange: setPageIndex,
        }}
      />
    </div>
  )
}

// ---- Movements ------------------------------------------------------------------------

function MovementsTab({
  seed,
  onOpenTransfer,
}: {
  seed: StockTabSeed
  onOpenTransfer: (referenceId: string) => void
}) {
  const [pageIndex, setPageIndex] = React.useState(0)
  const [variant, setVariant] = React.useState<ChosenVariant | null>(seedVariant(seed))
  const [warehouseId, setWarehouseId] = React.useState(seed.warehouseId ?? '')
  const [type, setType] = React.useState<MovementType | ''>('')
  const [reason, setReason] = React.useState<ReasonCode | ''>('')
  const [referenceType, setReferenceType] = React.useState(seed.referenceType ?? '')
  const [referenceId, setReferenceId] = React.useState(seed.referenceId ?? '')
  const [fromDate, setFromDate] = React.useState('')
  const [toDate, setToDate] = React.useState('')

  const reasonCodes = useReasonCodesQuery()
  // The server takes a reference id only as a full id; anything else is held back, not sent.
  const idTyped = referenceId.trim()
  const idIsValid = UUID.test(idTyped)

  const movements = useStockMovementsQuery({
    page: pageIndex,
    size: PAGE_SIZE,
    variantId: variant?.id,
    warehouseId: warehouseId || undefined,
    batchId: seed.batchId,
    movementType: type === '' ? undefined : type,
    from: istDayStart(fromDate),
    // The date box names the last day wanted; the server's `to` is exclusive.
    to: istDayStart(toDate, 1),
    reason: reason === '' ? undefined : reason,
    referenceType: referenceType || undefined,
    referenceId: idIsValid ? idTyped : undefined,
  })
  // Every reason the server pairs with some movement type.
  const reasonOptions = [...new Set((reasonCodes.data ?? []).flatMap((p) => p.reasons ?? []))]

  function filter<T>(set: (value: T) => void) {
    return (value: T) => {
      set(value)
      setPageIndex(0)
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-start gap-3">
        <div className="grid gap-1">
          <span className="text-xs text-muted-foreground">Variant</span>
          <VariantChoice
            value={variant}
            onChange={filter(setVariant)}
            ariaLabel="Find a product or SKU to filter movements"
          />
        </div>
        <div className="grid gap-1">
          <span className="text-xs text-muted-foreground">Warehouse</span>
          <WarehouseSelect
            value={warehouseId}
            onChange={filter(setWarehouseId)}
            ariaLabel="Warehouse filter"
            allLabel="All warehouses"
          />
        </div>
        <div className="grid gap-1">
          <span className="text-xs text-muted-foreground">Type</span>
          <FilterSelect
            value={type}
            onChange={filter(setType)}
            ariaLabel="Type filter"
            allLabel="All types"
            options={MOVEMENT_TYPES.map((t) => ({ value: t, label: MOVEMENT_TYPE_LABEL[t] }))}
          />
        </div>
        <div className="grid gap-1">
          <span className="text-xs text-muted-foreground">Reason</span>
          <FilterSelect
            value={reason}
            onChange={filter(setReason)}
            ariaLabel="Reason filter"
            allLabel="All reasons"
            options={reasonOptions.map((c) => ({ value: c, label: REASON_CODE_LABEL[c] }))}
          />
        </div>
        <div className="grid gap-1">
          <span className="text-xs text-muted-foreground">Reference type</span>
          <FilterSelect
            value={referenceType}
            onChange={filter(setReferenceType)}
            ariaLabel="Reference type filter"
            allLabel="Any reference"
            options={REFERENCE_TYPES}
          />
        </div>
        <label className="grid gap-1 text-xs text-muted-foreground">
          Reference id
          <Input
            aria-label="Reference id filter"
            placeholder="Full reference id"
            value={referenceId}
            onChange={(e) => filter(setReferenceId)(e.target.value)}
            className="w-80 font-mono text-xs"
          />
          {idTyped !== '' && !idIsValid && (
            <span role="status" className="text-destructive">
              Not applied: enter the full id (36 characters).
            </span>
          )}
        </label>
        <label className="grid gap-1 text-xs text-muted-foreground">
          From
          <Input
            type="date"
            aria-label="From date"
            value={fromDate}
            onChange={(e) => filter(setFromDate)(e.target.value)}
            className="w-40"
          />
        </label>
        <label className="grid gap-1 text-xs text-muted-foreground">
          To (inclusive)
          <Input
            type="date"
            aria-label="To date"
            value={toDate}
            onChange={(e) => filter(setToDate)(e.target.value)}
            className="w-40"
          />
        </label>
      </div>
      {seed.batchId && (
        <p className="text-xs text-muted-foreground">
          Showing one batch only. <span className="font-mono">{seed.batchId}</span>
        </p>
      )}
      {movements.isError && <ListError error={movements.error} what="Movements" />}
      <MovementsTable
        rows={movements.data?.content ?? []}
        isLoading={movements.isLoading}
        onOpenTransfer={onOpenTransfer}
        serverPagination={{
          pageIndex,
          pageSize: PAGE_SIZE,
          pageCount: movements.data?.totalPages ?? 0,
          totalElements: movements.data?.totalElements ?? 0,
          onPageIndexChange: setPageIndex,
        }}
      />
    </div>
  )
}

export { ExpiringTab, LevelsTab, LowStockTab, MovementsTab, TotalsTab }
