import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { ActiveToggle } from '@/components/common/ActiveToggle'
import { ApiClientError } from '@/lib/api-error'
import { navItems } from '@/layouts/nav-items'

const base = {
  noun: 'warehouse' as const,
  name: 'W3.1 Warehouse',
  permission: 'warehouse.write',
  deactivateWarning: 'It can no longer receive or send stock.',
}

describe('ActiveToggle', () => {
  it('shows the server’s refusal inside the confirm dialog and leaves the warehouse active', async () => {
    const sentence = 'Cannot deactivate W31: it still holds 4 units across 1 location.'
    const onToggle = vi
      .fn()
      .mockRejectedValue(
        new ApiClientError(
          { code: 'BUSINESS_RULE_VIOLATION', message: sentence, traceId: 't', fieldErrors: [] },
          422
        )
      )
    const user = userEvent.setup()
    render(<ActiveToggle {...base} active allowed onToggle={onToggle} />)
    await user.click(screen.getByRole('button', { name: 'Deactivate' }))
    expect(screen.getByText('It can no longer receive or send stock.')).toBeInTheDocument()
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Deactivate' }))

    expect(await screen.findByText(sentence)).toBeInTheDocument()
    expect(onToggle).toHaveBeenCalledWith('deactivate')
    // Still open, so the operator reads the refusal where they asked.
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })

  it('closes and reports on success', async () => {
    const onToggle = vi.fn().mockResolvedValue({})
    const user = userEvent.setup()
    render(<ActiveToggle {...base} active={false} allowed onToggle={onToggle} />)
    await user.click(screen.getByRole('button', { name: 'Reactivate' }))
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Reactivate' }))
    await waitFor(() => expect(onToggle).toHaveBeenCalledWith('reactivate'))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  })

  it('renders disabled with the permission hint when the account lacks the key', () => {
    render(<ActiveToggle {...base} active allowed={false} onToggle={vi.fn()} />)
    const button = screen.getByRole('button', { name: 'Deactivate' })
    expect(button).toBeDisabled()
    expect(button).toHaveAttribute('title', 'Needs warehouse.write')
  })
})

describe('navigation', () => {
  it('puts each Inventory and Procurement entry behind its own read permission', () => {
    const entry = (label: string) => navItems.find((i) => i.label === label)
    expect(entry('Warehouses')).toMatchObject({ permission: 'warehouse.read', group: 'Inventory' })
    expect(entry('Stock')).toMatchObject({ permission: 'inventory.read', group: 'Inventory' })
    expect(entry('Batches')).toMatchObject({ permission: 'inventory.read', group: 'Inventory' })
    expect(entry('Suppliers')).toMatchObject({
      permission: 'procurement.supplier.read',
      group: 'Procurement',
    })
    expect(entry('Purchase orders')).toMatchObject({
      permission: 'procurement.po.read',
      group: 'Procurement',
    })
    expect(entry('Goods receipts')).toMatchObject({
      permission: 'procurement.grn.read',
      group: 'Procurement',
    })
  })

  it('keeps each group’s entries together, so one heading covers them', () => {
    for (const group of ['Inventory', 'Procurement']) {
      const positions = navItems.flatMap((item, i) => (item.group === group ? [i] : []))
      expect(positions[positions.length - 1] - positions[0]).toBe(positions.length - 1)
    }
  })
})
