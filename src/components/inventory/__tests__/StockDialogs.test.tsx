import { calls, json, refusal, resetFetch, respondWith } from '@/test/fake-fetch'
import { installRadixPolyfills } from '@/test/polyfills'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render as rtlRender, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'

import { StockAdjustDialog } from '@/components/inventory/StockAdjustDialog'
import { StockTransferDialog } from '@/components/inventory/StockTransferDialog'
import { TransferDrawer } from '@/components/inventory/TransferDrawer'

installRadixPolyfills()

const W31 = { id: 'w-31', code: 'W31', name: 'W3.1 Warehouse', active: true }
const VERIFY = { id: 'w-v', code: 'VERIFY', name: 'Verify Warehouse', active: true }
const seed = {
  variant: { id: 'v-1', skuCode: 'W3-0-PRODUCT', name: 'Review product' },
  warehouseId: 'w-31',
}

function page(content: unknown[]) {
  return json(200, { content, page: 0, size: 100, totalElements: content.length, totalPages: 1 })
}

function render(ui: React.ReactElement) {
  return rtlRender(
    <QueryClientProvider
      client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
    >
      {ui}
    </QueryClientProvider>
  )
}

function postCalls() {
  return calls.filter((c) => c.method === 'POST')
}

async function chooseOption(
  user: ReturnType<typeof userEvent.setup>,
  trigger: string,
  option: string
) {
  await user.click(await screen.findByRole('combobox', { name: trigger }))
  await user.click(await screen.findByRole('option', { name: option }))
}

beforeEach(() => {
  resetFetch()
  respondWith((call) => {
    if (call.url.pathname === '/api/admin/warehouses') {
      return page([W31, VERIFY])
    }
    if (call.url.pathname === '/api/admin/batches') {
      return page([])
    }
    return json(200, {})
  })
})

describe('StockAdjustDialog', () => {
  async function fill(user: ReturnType<typeof userEvent.setup>, quantity: string) {
    await chooseOption(user, 'Reason code', 'Cycle count')
    await user.type(screen.getByLabelText('Quantity'), quantity)
  }

  it('keeps Post disabled until a reason and a non-zero quantity are given', async () => {
    const user = userEvent.setup()
    render(<StockAdjustDialog open onOpenChange={() => {}} seed={seed} />)
    const post = screen.getByRole('button', { name: 'Post movement' })
    expect(post).toBeDisabled()
    await user.type(screen.getByLabelText('Quantity'), '0')
    await chooseOption(user, 'Reason code', 'Cycle count')
    expect(post).toBeDisabled()
    await user.clear(screen.getByLabelText('Quantity'))
    await user.type(screen.getByLabelText('Quantity'), '-1')
    expect(post).toBeEnabled()
  })

  it('makes the type fix the sign: a plain 1 on Damage is sent as -1', async () => {
    respondWith(() => json(200, { id: 'm1' }))
    const user = userEvent.setup()
    render(<StockAdjustDialog open onOpenChange={() => {}} seed={seed} />)
    await chooseOption(user, 'Movement type', 'Damage')
    await chooseOption(user, 'Reason code', 'Damaged in warehouse')
    await user.type(screen.getByLabelText('Quantity'), '1')
    expect(screen.getByText('Will post −1.')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Post movement' }))
    await waitFor(() => expect(postCalls()).toHaveLength(1))
    expect(postCalls()[0].body).toMatchObject({
      variantId: 'v-1',
      warehouseId: 'w-31',
      movementType: 'DAMAGE',
      reasonCode: 'DAMAGED_IN_WAREHOUSE',
      quantity: -1,
    })
    expect(postCalls()[0].headers.get('Idempotency-Key')).toBeTruthy()
  })

  it("shows the server's insufficient-stock sentence right under the quantity, and mints a fresh key for the next attempt", async () => {
    const sentence = 'Cannot remove 10 from W31: only 3 on hand.'
    respondWith((call) =>
      call.method === 'POST'
        ? refusal(422, 'BUSINESS_RULE_VIOLATION', sentence)
        : call.url.pathname === '/api/admin/warehouses'
          ? page([W31])
          : page([])
    )
    const user = userEvent.setup()
    render(<StockAdjustDialog open onOpenChange={() => {}} seed={seed} />)
    await fill(user, '-10')
    await user.click(screen.getByRole('button', { name: 'Post movement' }))

    const alert = await screen.findByText(sentence)
    const quantityBlock = screen.getByLabelText('Quantity').parentElement!.parentElement!
    expect(quantityBlock).toContainElement(alert)
    expect(within(quantityBlock).getByRole('alert')).toHaveTextContent(sentence)
    // The dialog stays open so the operator can correct the figure.
    expect(screen.getByRole('button', { name: 'Post movement' })).toBeEnabled()

    await user.click(screen.getByRole('button', { name: 'Post movement' }))
    await waitFor(() => expect(postCalls()).toHaveLength(2))
    expect(postCalls()[1].headers.get('Idempotency-Key')).not.toBe(
      postCalls()[0].headers.get('Idempotency-Key')
    )
  })

  it('keeps the same key when the request never reached the server', async () => {
    respondWith((call) => {
      if (call.method === 'POST') {
        throw new TypeError('Failed to fetch')
      }
      return call.url.pathname === '/api/admin/warehouses' ? page([W31]) : page([])
    })
    const user = userEvent.setup()
    render(<StockAdjustDialog open onOpenChange={() => {}} seed={seed} />)
    await fill(user, '-1')
    await user.click(screen.getByRole('button', { name: 'Post movement' }))
    await screen.findByText(/Could not reach the server/)
    await user.click(screen.getByRole('button', { name: 'Post movement' }))
    await waitFor(() => expect(postCalls()).toHaveLength(2))
    expect(postCalls()[1].headers.get('Idempotency-Key')).toBe(
      postCalls()[0].headers.get('Idempotency-Key')
    )
  })

  it('asks for a batch when the variant is batch-tracked and sends the one chosen', async () => {
    respondWith((call) => {
      if (call.url.pathname === '/api/admin/batches') {
        return page([{ id: 'b-1', batchNumber: 'W31-B1', variantId: 'v-1', expired: false }])
      }
      if (call.url.pathname === '/api/admin/warehouses') {
        return page([W31])
      }
      return json(200, { id: 'm1' })
    })
    const user = userEvent.setup()
    render(<StockAdjustDialog open onOpenChange={() => {}} seed={seed} />)
    await chooseOption(user, 'Batch', 'W31-B1')
    await fill(user, '-1')
    await user.click(screen.getByRole('button', { name: 'Post movement' }))
    await waitFor(() => expect(postCalls()).toHaveLength(1))
    expect(postCalls()[0].body).toMatchObject({ batchId: 'b-1' })
  })
})

describe('StockTransferDialog', () => {
  it('sends a positive quantity between two different warehouses and reports the reference', async () => {
    let referenceId: string | undefined
    respondWith((call) =>
      call.method === 'POST'
        ? json(200, { referenceId: 'ref-1' })
        : call.url.pathname === '/api/admin/warehouses'
          ? page([W31, VERIFY])
          : page([])
    )
    const user = userEvent.setup()
    render(
      <StockTransferDialog
        open
        onOpenChange={() => {}}
        seed={seed}
        onDone={(id) => {
          referenceId = id
        }}
      />
    )
    const post = screen.getByRole('button', { name: 'Transfer' })
    expect(post).toBeDisabled()
    await chooseOption(user, 'To warehouse', 'VERIFY — Verify Warehouse')
    await user.type(screen.getByLabelText('Quantity'), '2')
    expect(post).toBeEnabled()
    await user.click(post)
    await waitFor(() => expect(postCalls()).toHaveLength(1))
    expect(postCalls()[0].body).toMatchObject({
      variantId: 'v-1',
      fromWarehouseId: 'w-31',
      toWarehouseId: 'w-v',
      quantity: 2,
    })
    await waitFor(() => expect(referenceId).toBe('ref-1'))
  })

  it('refuses a minus sign client-side (the direction is the pair of warehouses)', async () => {
    const user = userEvent.setup()
    render(<StockTransferDialog open onOpenChange={() => {}} seed={seed} />)
    await chooseOption(user, 'To warehouse', 'VERIFY — Verify Warehouse')
    await user.type(screen.getByLabelText('Quantity'), '-2')
    expect(screen.getByRole('button', { name: 'Transfer' })).toBeDisabled()
  })

  it("shows the server's sentence under the quantity when the source is short", async () => {
    const sentence = 'Cannot transfer 5 from W31: only 1 on hand.'
    respondWith((call) =>
      call.method === 'POST'
        ? refusal(422, 'BUSINESS_RULE_VIOLATION', sentence)
        : call.url.pathname === '/api/admin/warehouses'
          ? page([W31, VERIFY])
          : page([])
    )
    const user = userEvent.setup()
    render(<StockTransferDialog open onOpenChange={() => {}} seed={seed} />)
    await chooseOption(user, 'To warehouse', 'VERIFY — Verify Warehouse')
    await user.type(screen.getByLabelText('Quantity'), '5')
    await user.click(screen.getByRole('button', { name: 'Transfer' }))
    const alert = await screen.findByText(sentence)
    expect(screen.getByLabelText('Quantity').parentElement!.parentElement!).toContainElement(alert)
  })
})

describe('TransferDrawer', () => {
  it('opens both halves from a reference id', async () => {
    respondWith(() =>
      json(200, {
        referenceId: 'ref-1',
        out: {
          movementType: 'TRANSFER_OUT',
          warehouseCode: 'W31',
          skuCode: 'W3-0-PRODUCT',
          quantity: -2,
        },
        in: {
          movementType: 'TRANSFER_IN',
          warehouseCode: 'VERIFY',
          skuCode: 'W3-0-PRODUCT',
          quantity: 2,
        },
      })
    )
    render(<TransferDrawer referenceId="ref-1" onClose={() => {}} />)
    const out = await screen.findByRole('region', { name: 'Out' })
    const incoming = screen.getByRole('region', { name: 'In' })
    expect(within(out).getByText('W31')).toBeInTheDocument()
    expect(within(out).getByText('−2')).toBeInTheDocument()
    expect(within(incoming).getByText('VERIFY')).toBeInTheDocument()
    expect(within(incoming).getByText('+2')).toBeInTheDocument()
    expect(calls[0].url.pathname).toBe('/api/admin/stock/transfers/ref-1')
  })

  it('says so inside the drawer when the transfer was not found', async () => {
    respondWith(() => refusal(404, 'NOT_FOUND', 'Transfer ref-9 was not found.'))
    render(<TransferDrawer referenceId="ref-9" onClose={() => {}} />)
    expect(await screen.findByText('Transfer ref-9 was not found.')).toBeInTheDocument()
  })
})
