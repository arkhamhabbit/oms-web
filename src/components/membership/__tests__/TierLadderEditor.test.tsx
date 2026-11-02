import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render as rtlRender, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { TierLadderEditor } from '@/components/membership/TierLadderEditor'
import { blankTierDraft, draftsToRequest, type TierDraft } from '@/lib/membership'

vi.mock('@/auth/usePermissions', () => ({
  usePermissions: () => ({ has: () => true }),
}))

function wrap(ui: React.ReactElement) {
  return <QueryClientProvider client={new QueryClient()}>{ui}</QueryClientProvider>
}
function render(ui: React.ReactElement) {
  return rtlRender(wrap(ui))
}

function tier(over: Partial<TierDraft> = {}): TierDraft {
  return {
    ...blankTierDraft(),
    code: 'TITAN',
    name: 'Titan',
    thresholdPoints12mo: 0,
    maintainThresholdPoints: 0,
    colourHex: '#7A1F2B',
    ...over,
  }
}

describe('TierLadderEditor — colour and badge (D7.18)', () => {
  it('edits the colour from the hex field', async () => {
    const onChange = vi.fn()
    render(<TierLadderEditor tiers={[tier({ colourHex: '' })]} onChange={onChange} />)
    await userEvent.type(screen.getByLabelText('Colour'), '#')
    expect(onChange.mock.calls.at(-1)?.[0][0].colourHex).toBe('#')
  })

  it('edits the colour from the native picker', () => {
    const onChange = vi.fn()
    render(<TierLadderEditor tiers={[tier()]} onChange={onChange} />)
    fireEvent.change(screen.getByLabelText('Pick the colour of tier 1'), {
      target: { value: '#112233' },
    })
    expect(onChange.mock.calls.at(-1)?.[0][0].colourHex).toBe('#112233')
  })

  it('needs a colour: the ladder is not a request while one is empty', () => {
    expect(draftsToRequest([tier({ colourHex: '' })])).toBeNull()
  })

  it('shows the server sentence beside the colour and the badge of the tier it names', () => {
    render(
      <TierLadderEditor
        tiers={[tier({ code: 'SPROUT' }), tier()]}
        onChange={() => {}}
        serverErrors={[
          { field: 'tiers[1].colourHex', message: 'Must be a colour written as #RRGGBB.' },
          { field: 'tiers[1].badgeMediaId', message: 'The badge must be an image.' },
        ]}
      />
    )
    const first = screen.getByRole('group', { name: 'Tier 1' })
    const second = screen.getByRole('group', { name: 'Tier 2' })
    expect(within(first).queryByText('Must be a colour written as #RRGGBB.')).toBeNull()
    expect(within(second).getByText('Must be a colour written as #RRGGBB.')).toBeInTheDocument()
    expect(within(second).getByText('The badge must be an image.')).toBeInTheDocument()
    expect(within(second).getByLabelText('Colour')).toHaveAttribute('aria-invalid', 'true')
  })

  it('offers a badge picker with a remove control, and locks it when read-only', () => {
    const badge = { id: 'm1', preview: { kind: 'IMAGE' as const }, filename: 'W3.5 badge' }
    const { rerender } = render(<TierLadderEditor tiers={[tier({ badge })]} onChange={() => {}} />)
    expect(screen.getByText('W3.5 badge')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Remove' })).toBeEnabled()
    rerender(wrap(<TierLadderEditor tiers={[tier({ badge })]} onChange={() => {}} readOnly />))
    expect(screen.getByRole('button', { name: 'Remove' })).toBeDisabled()
    expect(screen.getByLabelText('Colour')).toBeDisabled()
  })
})
