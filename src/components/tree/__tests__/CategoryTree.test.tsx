import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { CategoryTree } from '@/components/tree/CategoryTree'
import { categoryTreeFixture } from '@/fixtures/categories'

describe('CategoryTree', () => {
  it('renders nodes from all three levels of the fixture', () => {
    render(<CategoryTree data={categoryTreeFixture} height={600} />)

    // Level 1
    expect(screen.getByText('Food & Nutrition')).toBeInTheDocument()
    // Level 2
    expect(screen.getByText('Protein')).toBeInTheDocument()
    // Level 3
    expect(screen.getByText('Whey Protein')).toBeInTheDocument()
  })

  it('shows status and live badges for a node', () => {
    render(<CategoryTree data={categoryTreeFixture} height={600} />)

    expect(screen.getAllByText('ACTIVE').length).toBeGreaterThan(0)
    expect(screen.getAllByText('LIVE').length).toBeGreaterThan(0)
  })
})
