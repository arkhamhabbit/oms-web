import { calls, json, resetFetch, respondWith } from '@/test/fake-fetch'
import { installRadixPolyfills } from '@/test/polyfills'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render as rtlRender, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { BreadcrumbProvider } from '@/layouts/breadcrumb-context'
import AuditPage from '@/pages/AuditPage'

installRadixPolyfills()
// The first render of this page pulls in the whole filter form; a cold full-suite run needs the room.
vi.setConfig({ testTimeout: 20000 })

function render() {
  return rtlRender(
    <QueryClientProvider
      client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
    >
      <MemoryRouter>
        <BreadcrumbProvider>
          <AuditPage />
        </BreadcrumbProvider>
      </MemoryRouter>
    </QueryClientProvider>
  )
}

const auditCalls = () => calls.filter((c) => c.url.pathname === '/api/admin/audit-entries')

beforeEach(() => {
  resetFetch()
  respondWith(() => json(200, { content: [], page: 0, size: 25, totalElements: 0, totalPages: 0 }))
})

describe('audit filters', () => {
  it('refuses an entity id that is not a UUID, beside the box, and does not send it', async () => {
    const user = userEvent.setup()
    render()
    await screen.findByText('No audit entries match these filters.')
    const before = auditCalls().length

    await user.click(screen.getByLabelText('Entity ID'))
    await user.paste('not-a-uuid')
    await user.click(screen.getByRole('button', { name: 'Apply filters' }))

    expect(screen.getByText('Enter a UUID')).toBeInTheDocument()
    expect(screen.getByLabelText('Entity ID')).toHaveAttribute('aria-invalid', 'true')
    expect(auditCalls()).toHaveLength(before)
  })

  it('sends a real UUID, and the same check covers the actor id', async () => {
    const user = userEvent.setup()
    render()
    await screen.findByText('No audit entries match these filters.')

    await user.click(screen.getByLabelText('Actor ID'))
    await user.paste('12345')
    await user.click(screen.getByRole('button', { name: 'Apply filters' }))
    expect(screen.getByText('Enter a UUID')).toBeInTheDocument()

    await user.clear(screen.getByLabelText('Actor ID'))
    await user.click(screen.getByLabelText('Entity ID'))
    await user.paste('0190aaaa-bbbb-4ccc-8ddd-eeeeffff0000')
    await user.click(screen.getByRole('button', { name: 'Apply filters' }))
    expect(screen.queryByText('Enter a UUID')).not.toBeInTheDocument()
    const last = auditCalls().at(-1)!
    expect(last.url.searchParams.get('entityId')).toBe('0190aaaa-bbbb-4ccc-8ddd-eeeeffff0000')
  })

  it('groups the actions by domain', async () => {
    const user = userEvent.setup()
    render()
    await user.click(await screen.findByRole('combobox', { name: 'Action' }))
    const listbox = await screen.findByRole('listbox')
    expect(listbox).toHaveTextContent('Catalog')
    expect(listbox).toHaveTextContent('Orders')
    expect(listbox).toHaveTextContent('catalog.brand.created')
  })
})
