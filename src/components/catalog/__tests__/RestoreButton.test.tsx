import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { ArchivedNotice, RestoreButton } from '@/components/catalog/RestoreButton'
import { ApiClientError } from '@/lib/api-error'

const base = { noun: 'category', name: 'W3.0 Category' }

function refusal(message: string) {
  return new ApiClientError(
    { code: 'BUSINESS_RULE_VIOLATION', message, traceId: 'trace-1', fieldErrors: [] },
    422
  )
}

describe('RestoreButton visibility', () => {
  it('shows for an archived item when the account holds the publish key', () => {
    render(<RestoreButton {...base} status="ARCHIVED" canPublish onRestore={vi.fn()} />)
    expect(screen.getByRole('button', { name: 'Restore' })).toBeEnabled()
  })

  it('is absent without the publish key, exactly as Archive is', () => {
    render(<RestoreButton {...base} status="ARCHIVED" canPublish={false} onRestore={vi.fn()} />)
    expect(screen.queryByRole('button', { name: 'Restore' })).not.toBeInTheDocument()
  })

  it.each(['DRAFT', 'IN_REVIEW', 'ACTIVE', undefined])('is absent while %s', (status) => {
    render(<RestoreButton {...base} status={status} canPublish onRestore={vi.fn()} />)
    expect(screen.queryByRole('button', { name: 'Restore' })).not.toBeInTheDocument()
  })
})

describe('RestoreButton dialog', () => {
  it('says the item comes back Active and off sale, and restores only on confirm', async () => {
    const onRestore = vi.fn().mockResolvedValue({})
    const user = userEvent.setup()
    render(<RestoreButton {...base} status="ARCHIVED" canPublish onRestore={onRestore} />)

    await user.click(screen.getByRole('button', { name: 'Restore' }))
    const dialog = screen.getByRole('dialog')
    expect(
      within(dialog).getByText(
        'Restore W3.0 Category? It comes back as Active and stays off sale until you publish it.'
      )
    ).toBeInTheDocument()
    expect(onRestore).not.toHaveBeenCalled()

    await user.click(within(dialog).getByRole('button', { name: 'Restore' }))
    await waitFor(() => expect(onRestore).toHaveBeenCalledTimes(1))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  })

  it('cancel restores nothing', async () => {
    const onRestore = vi.fn()
    const user = userEvent.setup()
    render(<RestoreButton {...base} status="ARCHIVED" canPublish onRestore={onRestore} />)
    await user.click(screen.getByRole('button', { name: 'Restore' }))
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Cancel' }))
    expect(onRestore).not.toHaveBeenCalled()
  })
})

describe('RestoreButton refusal', () => {
  it('places the server’s sentence beside the button, not in the closed dialog', async () => {
    const sentence = 'Restore the parent category first.'
    const onRestore = vi.fn().mockRejectedValue(refusal(sentence))
    const user = userEvent.setup()
    render(<RestoreButton {...base} status="ARCHIVED" canPublish onRestore={onRestore} />)

    await user.click(screen.getByRole('button', { name: 'Restore' }))
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Restore' }))

    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent(sentence)
    expect(alert).toHaveTextContent('Trace ID: trace-1')
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(screen.getByRole('button', { name: 'Restore' })).toBeEnabled()
  })

  it('clears the sentence when the operator tries again', async () => {
    const onRestore = vi
      .fn()
      .mockRejectedValueOnce(refusal('Restore the brand first.'))
      .mockResolvedValueOnce({})
    const user = userEvent.setup()
    render(
      <RestoreButton
        noun="product"
        name="W3.0 Product"
        status="ARCHIVED"
        canPublish
        onRestore={onRestore}
      />
    )
    for (let attempt = 0; attempt < 2; attempt++) {
      await user.click(screen.getByRole('button', { name: 'Restore' }))
      await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Restore' }))
      await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    }
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })
})

describe('ArchivedNotice', () => {
  it('reads as the short notice', () => {
    render(<ArchivedNotice />)
    expect(screen.getByRole('status')).toHaveTextContent('Archived — restore to edit')
  })
})
