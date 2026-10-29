import { describe, expect, it } from 'vitest'

import {
  draftLineTotals,
  draftTotals,
  isReceivable,
  parseLineQuantity,
  parseTaxRate,
  poActionsFor,
  receiptDraftFromPo,
  receiptRowProblem,
  receiptRowsReady,
  taxMinor,
  toDraftLines,
  toLineRequests,
  toReceiptRequest,
  type DraftLine,
} from '@/lib/procurement'
import type { PurchaseOrder } from '@/api/procurement'

function line(overrides: Partial<DraftLine> = {}): DraftLine {
  return {
    key: 'k',
    variantId: 'v1',
    skuCode: 'W3-0-PRODUCT',
    name: 'Review product',
    quantity: '5',
    unitCostMinor: 10000,
    taxRate: '0',
    ...overrides,
  }
}

describe('line arithmetic', () => {
  it('computes cost and GST in integer minor units', () => {
    expect(draftLineTotals(line())).toEqual({ costMinor: 50000, taxMinor: 0 })
    expect(draftLineTotals(line({ taxRate: '18' }))).toEqual({ costMinor: 50000, taxMinor: 9000 })
    // 12.5% of ₹33.33 x 3 = 99.99 -> 12.49875 -> 1250 paise, rounded half up
    expect(draftLineTotals(line({ quantity: '3', unitCostMinor: 3333, taxRate: '12.5' }))).toEqual({
      costMinor: 9999,
      taxMinor: 1250,
    })
  })

  it('has no total for an incomplete line, and skips it in the order total', () => {
    expect(draftLineTotals(line({ unitCostMinor: null }))).toBeNull()
    expect(draftLineTotals(line({ quantity: '0' }))).toBeNull()
    expect(draftLineTotals(line({ taxRate: '101' }))).toBeNull()
    expect(draftTotals([line(), line({ unitCostMinor: null })])).toEqual({
      costMinor: 50000,
      taxMinor: 0,
    })
  })

  it('parses quantities and rates strictly', () => {
    expect(parseLineQuantity('6')).toBe(6)
    expect(parseLineQuantity('0')).toBeNull()
    expect(parseLineQuantity('1.5')).toBeNull()
    expect(parseTaxRate('18')).toBe(18)
    expect(parseTaxRate('12.5')).toBe(12.5)
    expect(parseTaxRate('12.555')).toBeNull()
    expect(parseTaxRate('-1')).toBeNull()
    expect(taxMinor(1000, 5)).toBe(50)
  })

  it('sends money as {amountMinor, currency} and rupees converted exactly', () => {
    expect(toLineRequests([line({ quantity: '6' })], 'INR')).toEqual([
      {
        variantId: 'v1',
        quantityOrdered: 6,
        unitCost: { amountMinor: 10000, currency: 'INR' },
        taxRate: 0,
      },
    ])
  })

  it('turns an order’s lines back into editable rows', () => {
    const rows = toDraftLines([
      {
        id: 'l1',
        variantId: 'v1',
        skuCode: 'S',
        productName: 'P',
        variantName: 'V',
        quantityOrdered: 5,
        unitCost: { amountMinor: 10000, currency: 'INR' },
        taxRate: 18,
      },
    ])
    expect(rows[0]).toMatchObject({
      quantity: '5',
      unitCostMinor: 10000,
      taxRate: '18',
      name: 'P · V',
    })
  })
})

describe('purchase order actions', () => {
  it('offers edit, approve and cancel on a draft, and receive once it is approved', () => {
    expect(poActionsFor('DRAFT')).toEqual(['edit', 'approve', 'cancel'])
    expect(poActionsFor('APPROVED')).toEqual(['receive', 'cancel'])
    expect(poActionsFor('PARTIALLY_RECEIVED')).toEqual(['receive'])
    expect(poActionsFor('RECEIVED')).toEqual([])
    expect(poActionsFor('CANCELLED')).toEqual([])
    expect(poActionsFor(undefined)).toEqual([])
  })

  it('lets a receipt be posted only against approved or partly received orders', () => {
    expect(isReceivable('APPROVED')).toBe(true)
    expect(isReceivable('PARTIALLY_RECEIVED')).toBe(true)
    expect(isReceivable('DRAFT')).toBe(false)
    expect(isReceivable('RECEIVED')).toBe(false)
  })
})

describe('goods receipt drafting', () => {
  const po: PurchaseOrder = {
    id: 'po1',
    lines: [
      {
        id: 'l1',
        skuCode: 'A',
        variantId: 'v1',
        quantityOrdered: 6,
        quantityReceived: 2,
        quantityOutstanding: 4,
      },
      {
        id: 'l2',
        skuCode: 'B',
        variantId: 'v2',
        quantityOrdered: 3,
        quantityReceived: 3,
        quantityOutstanding: 0,
      },
      {
        id: 'l3',
        skuCode: 'C',
        variantId: 'v3',
        quantityOrdered: 5,
        quantityReceived: 0,
        quantityOutstanding: 5,
        batchTracked: true,
      },
    ],
  }

  it('lists only lines still owed, accepted prefilled with the remainder', () => {
    const rows = receiptDraftFromPo(po)
    expect(rows.map((r) => [r.skuCode, r.accepted, r.remaining])).toEqual([
      ['A', '4', 4],
      ['C', '5', 5],
    ])
  })

  it('needs a batch for a tracked line that takes stock', () => {
    const [, tracked] = receiptDraftFromPo(po)
    expect(receiptRowProblem(tracked)).toMatch(/batch-tracked/)
    expect(receiptRowProblem({ ...tracked, batchId: 'b1' })).toBeUndefined()
    expect(receiptRowProblem({ ...tracked, batchMode: 'new' })).toMatch(/batch number/i)
    expect(
      receiptRowProblem({ ...tracked, batchMode: 'new', batchNumber: 'W31-B1' })
    ).toBeUndefined()
    // Nothing accepted: no batch needed.
    expect(receiptRowProblem({ ...tracked, accepted: '0' })).toBeUndefined()
  })

  it('is ready only when something is accepted or rejected and no row has a problem', () => {
    const [plain] = receiptDraftFromPo(po)
    expect(receiptRowsReady([plain])).toBe(true)
    expect(receiptRowsReady([{ ...plain, accepted: '0' }])).toBe(false)
    expect(receiptRowsReady([{ ...plain, accepted: '0', rejected: '1' }])).toBe(true)
    expect(receiptRowsReady([{ ...plain, accepted: 'x' }])).toBe(false)
  })

  it('builds the request: partial accept, blanks omitted, batch by id or inline but never both', () => {
    const [plain, tracked] = receiptDraftFromPo(po)
    const request = toReceiptRequest(
      [
        { ...plain, accepted: '4' },
        { ...tracked, batchMode: 'new', batchNumber: ' W31-B1 ', expiresOn: '2027-06-30' },
      ],
      { receivedOn: '2026-10-29', supplierInvoiceNumber: ' ', notes: '' }
    )
    expect(request.supplierInvoiceNumber).toBeUndefined()
    expect(request.notes).toBeUndefined()
    expect(request.receivedOn).toBe('2026-10-29')
    expect(request.lines[0]).toEqual({
      purchaseOrderLineId: 'l1',
      quantityReceived: 4,
      quantityRejected: 0,
    })
    expect(request.lines[1]).toMatchObject({
      purchaseOrderLineId: 'l3',
      batchNumber: 'W31-B1',
      expiresOn: '2027-06-30',
    })
    expect(request.lines[1]).not.toHaveProperty('batchId')

    const byId = toReceiptRequest([{ ...tracked, batchId: 'b1' }], {})
    expect(byId.lines[0]).toMatchObject({ batchId: 'b1' })
    expect(byId.lines[0]).not.toHaveProperty('batchNumber')
  })
})
