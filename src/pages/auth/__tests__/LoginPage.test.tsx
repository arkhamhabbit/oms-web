import { calls, json, resetFetch, respondWith } from '@/test/fake-fetch'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render as rtlRender, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it } from 'vitest'

import { markSessionEnded, markSignedIn, sessionExpiredNoticeShown } from '@/auth/session-hint'
import LoginPage from '@/pages/auth/LoginPage'

function render() {
  return rtlRender(
    <QueryClientProvider
      client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
    >
      <MemoryRouter initialEntries={['/login']}>
        <LoginPage />
      </MemoryRouter>
    </QueryClientProvider>
  )
}

beforeEach(() => {
  resetFetch()
  window.localStorage.clear()
  respondWith(() => json(200, { mustChangePassword: false }))
})

describe('login page', () => {
  it('does not probe the session of a visitor who has none (no 401 in the console)', async () => {
    render()
    await screen.findByRole('button', { name: 'Sign in' })
    expect(calls.filter((c) => c.url.pathname === '/api/admin/profile')).toHaveLength(0)
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })

  it('says why the admin is back after a session ended, and clears it on the next login', async () => {
    markSignedIn()
    markSessionEnded()
    const user = userEvent.setup()
    render()

    expect(await screen.findByText('Your session expired - sign in again')).toBeInTheDocument()
    // the session is known to be gone, so there is nothing to probe
    expect(calls.filter((c) => c.url.pathname === '/api/admin/profile')).toHaveLength(0)

    await user.type(screen.getByLabelText('Email'), 'admin@habbit.local')
    await user.type(screen.getByLabelText('Password'), 'secret-password')
    await user.click(screen.getByRole('button', { name: 'Sign in' }))

    await waitFor(() => expect(sessionExpiredNoticeShown()).toBe(false))
  })
})
