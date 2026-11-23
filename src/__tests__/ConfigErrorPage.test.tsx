import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import ConfigErrorPage from '@/ConfigErrorPage'
import { resolveConfig } from '@/lib/runtime-config'

describe('ConfigErrorPage', () => {
  it('shows the message naming the variable as one full-page alert', () => {
    const result = resolveConfig({ apiBaseUrl: null, mediaOrigin: null }, { dev: false })
    if (result.ok) throw new Error('expected a refusal')
    render(<ConfigErrorPage message={result.message} />)
    const alert = screen.getByRole('alert')
    expect(alert).toHaveTextContent('OMS_API_BASE_URL is not set')
    expect(alert).toHaveTextContent('MEDIA_ORIGIN')
  })
})
