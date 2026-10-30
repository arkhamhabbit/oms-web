import type { ColumnDef } from '@tanstack/react-table'

import { DataTable, type ServerPagination } from '@/components/data-table/DataTable'
import type { StockMovement } from '@/api/inventory'
import {
  formatSigned,
  isTransferHalf,
  MOVEMENT_TYPE_LABEL,
  REASON_CODE_LABEL,
} from '@/lib/inventory'
import { formatDateTime } from '@/lib/orders'

/** The ledger, newest first. A transfer's reference id is a button that opens both halves. */
function MovementsTable({
  rows,
  isLoading,
  emptyMessage = 'No movements match these filters.',
  onOpenTransfer,
  serverPagination,
}: {
  rows: StockMovement[]
  isLoading?: boolean
  emptyMessage?: string
  onOpenTransfer: (referenceId: string) => void
  serverPagination?: ServerPagination
}) {
  const columns: ColumnDef<StockMovement, unknown>[] = [
    { id: 'when', header: 'When', cell: ({ row }) => formatDateTime(row.original.occurredAt) },
    {
      id: 'type',
      header: 'Type',
      cell: ({ row }) =>
        row.original.movementType ? MOVEMENT_TYPE_LABEL[row.original.movementType] : '',
    },
    {
      id: 'sku',
      header: 'SKU',
      cell: ({ row }) => <span className="font-mono">{row.original.skuCode}</span>,
    },
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
    {
      id: 'quantity',
      header: 'Qty',
      cell: ({ row }) => <span className="font-medium">{formatSigned(row.original.quantity)}</span>,
    },
    {
      id: 'reason',
      header: 'Reason',
      cell: ({ row }) =>
        row.original.reasonCode ? REASON_CODE_LABEL[row.original.reasonCode] : '',
    },
    {
      id: 'reference',
      header: 'Reference',
      cell: ({ row }) => {
        const m = row.original
        if (!m.referenceId) {
          return ''
        }
        if (isTransferHalf(m)) {
          return (
            <button
              type="button"
              className="font-mono text-xs underline"
              aria-label={`Open transfer ${m.referenceId}`}
              onClick={() => onOpenTransfer(m.referenceId!)}
            >
              Transfer {m.referenceId.slice(0, 8)}…
            </button>
          )
        }
        return (
          <span className="font-mono text-xs" title={m.referenceId}>
            {m.referenceType ?? 'Ref'} {m.referenceId.slice(0, 8)}…
          </span>
        )
      },
    },
    { id: 'note', header: 'Note', cell: ({ row }) => row.original.note ?? '' },
  ]

  return (
    <DataTable
      columns={columns}
      data={rows}
      isLoading={isLoading}
      emptyMessage={emptyMessage}
      serverPagination={serverPagination}
    />
  )
}

export { MovementsTable }
