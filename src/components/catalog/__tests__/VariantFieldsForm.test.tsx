import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render as rtlRender, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { VariantFieldsForm } from '@/components/catalog/VariantFieldsForm'
import type { Variant } from '@/api/products'

const mutateAsync = vi.fn()

vi.mock('@/api/products', () => ({
  productVariantsQueryKey: (id: string) => ['products', 'variants', id],
  useUpdateVariantMutation: () => ({ mutateAsync, isPending: false }),
}))
vi.mock('@/api/membership', () => ({
  useEffectiveLadderQuery: () => ({
    data: [
      { code: 'SPROUT', name: 'Sprout', rank: 1 },
      { code: 'APEX', name: 'Apex', rank: 3 },
    ],
    isLoading: false,
    isSuccess: true,
  }),
}))
vi.mock('@/auth/usePermissions', () => ({
  usePermissions: () => ({ has: () => true }),
}))

function render(ui: React.ReactElement) {
  return rtlRender(<QueryClientProvider client={new QueryClient()}>{ui}</QueryClientProvider>)
}

function variant(overrides: Partial<Variant> = {}): Variant {
  return { id: 'v1', version: 2, skuCode: 'TEST-PUBLIC', batchTracked: false, ...overrides }
}

describe('VariantFieldsForm — requiredTierCode (D4.18)', () => {
  beforeEach(() => {
    mutateAsync.mockReset()
    mutateAsync.mockResolvedValue({})
  })

  it('echoes a stored tier back unchanged when the operator edits something else', async () => {
    render(
      <VariantFieldsForm
        productId="p1"
        variant={variant({ requiredTierCode: 'APEX' })}
        skuCodesEditable
        canWrite
        productAudience="PUBLIC"
      />
    )

    await userEvent.type(screen.getByLabelText('Barcode'), '8901')
    await userEvent.click(screen.getByRole('button', { name: 'Save' }))

    expect(mutateAsync).toHaveBeenCalledTimes(1)
    expect(mutateAsync.mock.calls[0][0]).toMatchObject({
      requiredTierCode: 'APEX',
      barcode: '8901',
      version: 2,
    })
  })

  it('sends an explicit null for a variant with no tier of its own', async () => {
    render(
      <VariantFieldsForm
        productId="p1"
        variant={variant()}
        skuCodesEditable
        canWrite
        productAudience="PUBLIC"
      />
    )

    await userEvent.click(screen.getByRole('button', { name: 'Save' }))

    expect(mutateAsync.mock.calls[0][0].requiredTierCode).toBeNull()
  })

  it('shows the server’s refusal sentence beside Save', async () => {
    mutateAsync.mockRejectedValue({
      code: 'UNPROCESSABLE',
      message: 'A variant can only be stricter than its product.',
      traceId: 'trace-1',
      fieldErrors: [],
    })
    render(
      <VariantFieldsForm
        productId="p1"
        variant={variant()}
        skuCodesEditable
        canWrite
        productAudience="PUBLIC"
      />
    )

    await userEvent.click(screen.getByRole('button', { name: 'Save' }))

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'A variant can only be stricter than its product.'
    )
  })
})
