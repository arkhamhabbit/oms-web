import { calls, json, refusal, resetFetch, respondWith } from '@/test/fake-fetch'
import { installRadixPolyfills } from '@/test/polyfills'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render as rtlRender, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { RouterProvider, createMemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it } from 'vitest'

import { BreadcrumbProvider } from '@/layouts/breadcrumb-context'
import AppSettingsPage from '@/pages/AppSettingsPage'

installRadixPolyfills()

const EMPTY = { version: 0, updatedAt: '2026-11-22T10:00:00Z' }

let record: Record<string, unknown> = EMPTY
let permissions = ['app_settings.read', 'app_settings.manage', 'audit.read']
let putHandler: (body: Record<string, unknown>) => Response = () => json(200, record)

function render() {
  const router = createMemoryRouter(
    [
      { path: '/settings/app', element: <AppSettingsPage /> },
      { path: '/elsewhere', element: <p>Elsewhere</p> },
    ],
    { initialEntries: ['/settings/app'] }
  )
  rtlRender(
    <QueryClientProvider
      client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
    >
      <BreadcrumbProvider>
        <RouterProvider router={router} />
      </BreadcrumbProvider>
    </QueryClientProvider>
  )
  return router
}

beforeEach(() => {
  resetFetch()
  record = EMPTY
  permissions = ['app_settings.read', 'app_settings.manage', 'audit.read']
  putHandler = () => json(200, record)
  respondWith((call) => {
    if (call.url.pathname === '/api/admin/profile') {
      return json(200, {
        id: 'u',
        email: 'a@b.c',
        name: 'A',
        permissions,
        roles: [],
        version: 1,
      })
    }
    if (call.url.pathname === '/api/admin/app-settings') {
      return call.method === 'PUT'
        ? putHandler(call.body as Record<string, unknown>)
        : json(200, record)
    }
    return json(200, {})
  })
})

const puts = () => calls.filter((c) => c.method === 'PUT')

describe('app settings page', () => {
  it('loads every field empty, grouped as the menu shows them', async () => {
    render()
    expect(await screen.findByLabelText('About Habbit')).toHaveValue('')
    for (const label of [
      'Become a Habbit Partner',
      'Habbit Magazine',
      'Every Asked Question (FAQ)',
      'Get Support',
      'Support email',
      'Support phone',
      'Privacy',
      'Terms',
      'Policies',
      'Registered legal name',
      'FSSAI licence number',
      'Instagram',
      'X',
      'YouTube',
      'LinkedIn',
      'Facebook',
    ]) {
      expect(screen.getByLabelText(label)).toHaveValue('')
    }
    expect(screen.getByText(/A field left empty is not shown in the app/)).toBeInTheDocument()
    expect(screen.getByText('Not changed yet.')).toBeInTheDocument()
  })

  it('sends the whole record with the version, empty fields as null', async () => {
    record = { version: 3, updatedAt: '2026-11-22T10:00:00Z', faqUrl: 'https://example.com/faq' }
    const user = userEvent.setup()
    render()
    await user.type(await screen.findByLabelText('Support email'), 'hello@habbithealth.com')
    await user.click(screen.getByRole('button', { name: 'Save' }))

    await waitFor(() => expect(puts()).toHaveLength(1))
    const body = puts()[0].body as Record<string, unknown>
    expect(Object.keys(body)).toHaveLength(18)
    expect(body.version).toBe(3)
    expect(body.supportEmail).toBe('hello@habbithealth.com')
    expect(body.faqUrl).toBe('https://example.com/faq')
    expect(body.aboutUrl).toBeNull()
    expect(body.fssaiLicenceNumber).toBeNull()
  })

  it('places several server refusals beside their fields at once', async () => {
    putHandler = () =>
      refusal(400, 'VALIDATION_FAILED', 'Some fields are wrong.', [
        { field: 'aboutUrl', message: 'The About Habbit link must be https.' },
        { field: 'fssaiLicenceNumber', message: 'The FSSAI number must be 14 digits.' },
      ] as never)
    const user = userEvent.setup()
    render()
    await user.type(await screen.findByLabelText('About Habbit'), 'http://example.com')
    await user.type(screen.getByLabelText('FSSAI licence number'), '12345678')
    await user.click(screen.getByRole('button', { name: 'Save' }))

    expect(await screen.findByText('The About Habbit link must be https.')).toBeInTheDocument()
    expect(screen.getByText('The FSSAI number must be 14 digits.')).toBeInTheDocument()
    expect(screen.getByLabelText('About Habbit')).toHaveAttribute('aria-invalid', 'true')
    expect(screen.getByLabelText('About Habbit')).toHaveValue('http://example.com')
  })

  it('shows a version conflict with Reload and keeps what was typed until Reload', async () => {
    putHandler = () =>
      refusal(409, 'VERSION_CONFLICT', 'This app settings record was changed by someone else.')
    const user = userEvent.setup()
    render()
    await user.type(await screen.findByLabelText('Support email'), 'a@b.co')
    await user.click(screen.getByRole('button', { name: 'Save' }))

    expect(
      await screen.findByText('This app settings record was changed by someone else.')
    ).toBeInTheDocument()
    expect(screen.getByLabelText('Support email')).toHaveValue('a@b.co')

    record = { version: 1, updatedAt: '2026-11-22T11:00:00Z', xUrl: 'https://x.com/habbit' }
    await user.click(screen.getByRole('button', { name: 'Reload' }))
    await waitFor(() => expect(screen.getByLabelText('X')).toHaveValue('https://x.com/habbit'))
    expect(screen.getByLabelText('Support email')).toHaveValue('')
  })

  it('enables Open only for an https value', async () => {
    const user = userEvent.setup()
    render()
    const open = await screen.findByRole('button', { name: 'Open About Habbit' })
    expect(open).toBeDisabled()
    await user.type(screen.getByLabelText('About Habbit'), 'http://example.com')
    expect(screen.getByRole('button', { name: 'Open About Habbit' })).toBeDisabled()
    await user.clear(screen.getByLabelText('About Habbit'))
    await user.type(screen.getByLabelText('About Habbit'), 'https://example.com')
    const link = screen.getByRole('link', { name: 'Open About Habbit' })
    expect(link).toHaveAttribute('href', 'https://example.com')
    expect(link).toHaveAttribute('target', '_blank')
    expect(calls.filter((c) => c.url.hostname === 'example.com')).toHaveLength(0)
  })

  it('guards unsaved changes on leaving', async () => {
    const user = userEvent.setup()
    const router = render()
    await user.type(await screen.findByLabelText('Support email'), 'a@b.co')
    await router.navigate('/elsewhere')
    expect(await screen.findByText('Leave without saving?')).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/settings/app')
    await user.click(screen.getByRole('button', { name: 'Leave' }))
    await waitFor(() => expect(router.state.location.pathname).toBe('/elsewhere'))
  })

  it('leaves freely when nothing was changed', async () => {
    const router = render()
    await screen.findByLabelText('About Habbit')
    await router.navigate('/elsewhere')
    await waitFor(() => expect(router.state.location.pathname).toBe('/elsewhere'))
  })

  it('says so and writes nothing when a save changes nothing', async () => {
    const user = userEvent.setup()
    render()
    await screen.findByLabelText('About Habbit')
    await user.click(screen.getByRole('button', { name: 'Save' }))
    await waitFor(() => expect(puts()).toHaveLength(0))
  })

  it('is read-only without app_settings.manage: no Save, fields not editable', async () => {
    permissions = ['app_settings.read']
    record = { version: 1, updatedAt: '2026-11-22T10:00:00Z', supportEmail: 'a@b.co' }
    render()
    const email = await screen.findByLabelText('Support email')
    expect(email).toHaveValue('a@b.co')
    expect(email).toHaveAttribute('readonly')
    expect(screen.queryByRole('button', { name: 'Save' })).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'History' })).not.toBeInTheDocument()
  })

  it('links History to the audit log filtered to this record', async () => {
    render()
    const history = await screen.findByRole('link', { name: 'History' })
    expect(history).toHaveAttribute('href', '/audit?entityType=app_settings')
  })
})
