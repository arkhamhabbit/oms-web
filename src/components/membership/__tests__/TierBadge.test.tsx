import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render as rtlRender, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { Tier } from '@/api/membership'
import { TierBadge } from '@/components/membership/TierBadge'
import { TierLadderTable } from '@/components/membership/TierLadderTable'

let ladder: Tier[] = []
let canRead = true

vi.mock('@/api/membership', () => ({
  useEffectiveLadderQuery: (enabled = true) => ({ data: enabled ? ladder : undefined }),
}))
vi.mock('@/auth/usePermissions', () => ({
  usePermissions: () => ({ has: () => canRead }),
}))

function wrap(ui: React.ReactElement) {
  return <QueryClientProvider client={new QueryClient()}>{ui}</QueryClientProvider>
}
function render(ui: React.ReactElement) {
  return rtlRender(wrap(ui))
}

const SPROUT: Tier = { code: 'SPROUT', name: 'Sprout', rank: 1, colourHex: '#00A17C' }
const TITAN: Tier = {
  code: 'TITAN',
  name: 'Titan',
  rank: 5,
  colourHex: '#7A1F2B',
  badge: { mediaId: 'm1', kind: 'IMAGE', thumbUrl: 'https://cdn.example/titan.png' },
}

describe('TierBadge (D7.18)', () => {
  beforeEach(() => {
    ladder = [SPROUT, TITAN]
    canRead = true
  })

  it('is coloured from the effective ladder by the tier code and reads the ladder name', () => {
    render(<TierBadge code="SPROUT" name="stale name" />)
    const badge = screen.getByText('Sprout')
    expect(badge).toHaveAttribute('data-tier', 'SPROUT')
    expect(badge).toHaveStyle({ backgroundColor: '#00A17C' })
  })

  it('draws the badge image when the tier has one, and none when it has not', () => {
    const { container, rerender } = render(<TierBadge code="TITAN" />)
    expect(container.querySelector('img')).toHaveAttribute('src', 'https://cdn.example/titan.png')
    rerender(wrap(<TierBadge code="SPROUT" />))
    expect(container.querySelector('img')).toBeNull()
  })

  it('falls back to the neutral badge with the code when the ladder no longer has it', () => {
    render(<TierBadge code="GONE" />)
    const badge = screen.getByText('GONE')
    expect(badge).toHaveClass('bg-muted')
    expect(badge.getAttribute('style')).toBeNull()
  })

  it('is neutral too when the viewer cannot read the ladder', () => {
    canRead = false
    render(<TierBadge code="SPROUT" />)
    expect(screen.getByText('SPROUT')).toHaveClass('bg-muted')
  })

  it('renders nothing without a code', () => {
    const { container } = render(<TierBadge code={undefined} />)
    expect(container).toBeEmptyDOMElement()
  })
})

describe('TierLadderTable swatches', () => {
  it('shows each tier colour swatch and badge thumbnail', () => {
    const { container } = render(<TierLadderTable tiers={[SPROUT, TITAN]} />)
    const swatches = container.querySelectorAll('[data-slot="tier-swatch"]')
    expect(swatches).toHaveLength(2)
    expect(swatches[0]).toHaveStyle({ backgroundColor: '#00A17C' })
    expect(swatches[1]).toHaveStyle({ backgroundColor: '#7A1F2B' })
    expect(container.querySelectorAll('img')).toHaveLength(1)
    expect(screen.getByText('colour #7A1F2B')).toBeInTheDocument()
  })
})
