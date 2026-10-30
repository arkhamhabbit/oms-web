import { calls, json, refusal, resetFetch, respondWith } from '@/test/fake-fetch'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render as rtlRender, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it } from 'vitest'

import { BreadcrumbProvider } from '@/layouts/breadcrumb-context'
import ProfilePage from '@/pages/ProfilePage'

function render() {
  return rtlRender(
    <QueryClientProvider
      client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
    >
      <MemoryRouter>
        <BreadcrumbProvider>
          <ProfilePage />
        </BreadcrumbProvider>
      </MemoryRouter>
    </QueryClientProvider>
  )
}

beforeEach(() => {
  resetFetch()
  respondWith((call) => {
    if (call.url.pathname === '/api/admin/profile') {
      return json(200, {
        id: 'u',
        email: 'a@b.c',
        name: 'Admin',
        status: 'ACTIVE',
        permissions: [],
        roles: [],
        version: 3,
      })
    }
    return refusal(400, 'VALIDATION_FAILED', 'Some fields are not valid. Correct them and retry.', [
      { field: 'password', message: 'Must be at least 12 characters.' },
    ] as never)
  })
})

describe('change password refusals', () => {
  it('puts the 12-character sentence beside the new-password field', async () => {
    const user = userEvent.setup()
    render()

    await user.type(await screen.findByLabelText('Current password'), 'Old-Password-1')
    await user.type(screen.getByLabelText('New password'), 'short')
    await user.click(screen.getByRole('button', { name: 'Change password' }))

    expect(await screen.findByText('Must be at least 12 characters.')).toBeInTheDocument()
    await waitFor(() =>
      expect(screen.getByLabelText('New password')).toHaveAttribute('aria-invalid', 'true')
    )
    expect(calls.some((c) => c.url.pathname === '/api/admin/profile/change-password')).toBe(true)
  })

  it('labels the account status as words', async () => {
    render()
    expect(await screen.findByText('Active')).toBeInTheDocument()
  })
})
