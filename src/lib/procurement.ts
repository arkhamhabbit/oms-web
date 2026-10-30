import type {
  GoodsReceipt,
  PostGoodsReceiptRequest,
  PurchaseOrder,
  PurchaseOrderLine,
  PurchaseOrderLineRequest,
  PurchaseOrderStatus,
} from '@/api/procurement'

export const PO_STATUSES: PurchaseOrderStatus[] = [
  'DRAFT',
  'APPROVED',
  'PARTIALLY_RECEIVED',
  'RECEIVED',
  'CANCELLED',
]

export type PoAction = 'edit' | 'approve' | 'cancel' | 'receive'

export const PO_ACTION_LABEL: Record<PoAction, string> = {
  edit: 'Edit',
  approve: 'Approve',
  cancel: 'Cancel order',
  receive: 'Receive',
}

/** The key each action needs. The contract names the same ones; see the Status note on permissions. */
export const PO_ACTION_PERMISSION: Record<PoAction, string> = {
  edit: 'procurement.po.write',
  approve: 'procurement.po.approve',
  cancel: 'procurement.po.write',
  receive: 'procurement.grn.create',
}

/**
 * The actions worth offering from a status. The server decides whether one is allowed (it
 * refuses with its own sentence, which the dialog shows), so each button is offered for every
 * status the action can ever apply to: edit and approve on a draft; cancel until anything is
 * received; receive once the order is committed and something is still owed.
 */
export function poActionsFor(status: PurchaseOrderStatus | undefined): PoAction[] {
  switch (status) {
    case 'DRAFT':
      return ['edit', 'approve', 'cancel']
    case 'APPROVED':
      return ['receive', 'cancel']
    case 'PARTIALLY_RECEIVED':
      return ['receive']
    default:
      return []
  }
}

/** Orders a receipt can still be posted against. */
export function isReceivable(status: PurchaseOrderStatus | undefined): boolean {
  return status === 'APPROVED' || status === 'PARTIALLY_RECEIVED'
}

// ---- Line arithmetic (display only: the server is the authority) ----------------------

export interface DraftLine {
  /** Local key only — never sent. */
  key: string
  variantId: string
  skuCode: string
  name: string
  quantity: string
  /** Unit cost in minor units; null while the field is empty or invalid. */
  unitCostMinor: number | null
  /** GST percentage as typed, e.g. "18" or "12.5". */
  taxRate: string
}

/** A GST percentage typed by an operator → a number in 0..100, or null. */
export function parseTaxRate(typed: string): number | null {
  if (!/^\d{1,3}(\.\d{1,2})?$/.test(typed.trim())) {
    return null
  }
  const value = Number(typed)
  return value >= 0 && value <= 100 ? value : null
}

/** Quantity typed on a draft line → a whole number ≥ 1, or null. */
export function parseLineQuantity(typed: string): number | null {
  if (!/^\d+$/.test(typed.trim())) {
    return null
  }
  const value = Number.parseInt(typed, 10)
  return value >= 1 ? value : null
}

/** Round-half-up of `minor × rate%` in integer arithmetic (rate has at most 2 decimals). */
export function taxMinor(baseMinor: number, taxRate: number): number {
  const hundredths = Math.round(taxRate * 100)
  return Math.round((baseMinor * hundredths) / 10000)
}

export interface LineTotals {
  costMinor: number
  taxMinor: number
}

export function draftLineTotals(line: DraftLine): LineTotals | null {
  const quantity = parseLineQuantity(line.quantity)
  const rate = parseTaxRate(line.taxRate)
  if (quantity === null || rate === null || line.unitCostMinor === null) {
    return null
  }
  const cost = quantity * line.unitCostMinor
  return { costMinor: cost, taxMinor: taxMinor(cost, rate) }
}

export function draftTotals(lines: DraftLine[]): LineTotals {
  return lines.reduce<LineTotals>(
    (sum, line) => {
      const totals = draftLineTotals(line)
      return totals
        ? { costMinor: sum.costMinor + totals.costMinor, taxMinor: sum.taxMinor + totals.taxMinor }
        : sum
    },
    { costMinor: 0, taxMinor: 0 }
  )
}

export function isDraftLineComplete(line: DraftLine): boolean {
  return draftLineTotals(line) !== null
}

/** The wire lines for a create / replace. Callers check `isDraftLineComplete` first. */
export function toLineRequests(lines: DraftLine[], currency: string): PurchaseOrderLineRequest[] {
  return lines.map((line) => ({
    variantId: line.variantId,
    quantityOrdered: parseLineQuantity(line.quantity)!,
    unitCost: { amountMinor: line.unitCostMinor!, currency },
    taxRate: parseTaxRate(line.taxRate)!,
  }))
}

/** Lines of an existing order as editable rows (an edit replaces the whole set). */
export function toDraftLines(lines: PurchaseOrderLine[] | undefined): DraftLine[] {
  return (lines ?? []).map((line) => ({
    key: line.id ?? crypto.randomUUID(),
    variantId: line.variantId ?? '',
    skuCode: line.skuCode ?? '',
    name: [line.productName, line.variantName].filter(Boolean).join(' · '),
    quantity: String(line.quantityOrdered ?? ''),
    unitCostMinor: line.unitCost?.amountMinor ?? null,
    taxRate: String(line.taxRate ?? 0),
  }))
}

export function remainingOf(line: PurchaseOrderLine): number {
  return (
    line.quantityOutstanding ??
    Math.max(0, (line.quantityOrdered ?? 0) - (line.quantityReceived ?? 0))
  )
}

// ---- Goods receipt form ---------------------------------------------------------------

export interface ReceiptLineDraft {
  purchaseOrderLineId: string
  skuCode: string
  name: string
  batchTracked: boolean
  variantId: string
  ordered: number
  received: number
  remaining: number
  accepted: string
  rejected: string
  /** `existing` names a batch already on file; `new` creates one inline from the dates below. */
  batchMode: 'existing' | 'new'
  batchId: string
  batchNumber: string
  manufacturedOn: string
  expiresOn: string
}

/** One row per PO line still owed something, accepted prefilled with what remains. */
export function receiptDraftFromPo(po: PurchaseOrder): ReceiptLineDraft[] {
  return (po.lines ?? [])
    .filter((line) => remainingOf(line) > 0)
    .map((line) => ({
      purchaseOrderLineId: line.id ?? '',
      skuCode: line.skuCode ?? '',
      name: [line.productName, line.variantName].filter(Boolean).join(' · '),
      batchTracked: !!line.batchTracked,
      variantId: line.variantId ?? '',
      ordered: line.quantityOrdered ?? 0,
      received: line.quantityReceived ?? 0,
      remaining: remainingOf(line),
      accepted: String(remainingOf(line)),
      rejected: '',
      batchMode: 'existing',
      batchId: '',
      batchNumber: '',
      manufacturedOn: '',
      expiresOn: '',
    }))
}

function wholeNumber(typed: string): number | null {
  return /^\d+$/.test(typed.trim()) ? Number.parseInt(typed, 10) : null
}

/** Why a receipt row cannot be sent yet, or undefined when it can. Sent rows with 0/0 are left out. */
export function receiptRowProblem(row: ReceiptLineDraft): string | undefined {
  const accepted = wholeNumber(row.accepted)
  const rejected = row.rejected.trim() === '' ? 0 : wholeNumber(row.rejected)
  if (accepted === null || rejected === null) {
    return 'Quantities are whole numbers.'
  }
  if (accepted === 0 && rejected === 0) {
    return undefined
  }
  if (accepted > 0 && row.batchTracked) {
    if (row.batchMode === 'existing' && !row.batchId) {
      return 'This SKU is batch-tracked: pick a batch or create one.'
    }
    if (row.batchMode === 'new' && !row.batchNumber.trim()) {
      return 'Enter the batch number.'
    }
  }
  return undefined
}

export function receiptRowsReady(rows: ReceiptLineDraft[]): boolean {
  const sendable = rows.filter((row) => {
    const accepted = wholeNumber(row.accepted)
    const rejected = row.rejected.trim() === '' ? 0 : wholeNumber(row.rejected)
    return (accepted ?? 0) > 0 || (rejected ?? 0) > 0
  })
  return sendable.length > 0 && rows.every((row) => receiptRowProblem(row) === undefined)
}

/** The wire body: rows with nothing accepted or rejected are left off; blank optionals are omitted. */
export function toReceiptRequest(
  rows: ReceiptLineDraft[],
  header: { receivedOn?: string; supplierInvoiceNumber?: string; notes?: string }
): PostGoodsReceiptRequest {
  const lines = rows
    .filter((row) => (wholeNumber(row.accepted) ?? 0) > 0 || (wholeNumber(row.rejected) ?? 0) > 0)
    .map((row) => {
      const accepted = wholeNumber(row.accepted) ?? 0
      const rejected = wholeNumber(row.rejected) ?? 0
      const line: PostGoodsReceiptRequest['lines'][number] = {
        purchaseOrderLineId: row.purchaseOrderLineId,
        quantityReceived: accepted,
        quantityRejected: rejected,
      }
      if (row.batchTracked && accepted > 0) {
        if (row.batchMode === 'existing') {
          line.batchId = row.batchId
        } else {
          line.batchNumber = row.batchNumber.trim()
          line.manufacturedOn = row.manufacturedOn || undefined
          line.expiresOn = row.expiresOn || undefined
        }
      }
      return line
    })
  return {
    lines,
    receivedOn: header.receivedOn || undefined,
    supplierInvoiceNumber: header.supplierInvoiceNumber?.trim() || undefined,
    notes: header.notes?.trim() || undefined,
  }
}

export function receiptTotals(receipt: GoodsReceipt): string {
  return `${receipt.quantityReceived ?? 0} accepted · ${receipt.quantityRejected ?? 0} rejected`
}
