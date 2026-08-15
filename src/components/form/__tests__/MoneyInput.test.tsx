import { useState } from 'react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'

import { MoneyInput } from '@/components/form/MoneyInput'

function ControlledMoneyInput({ initialMinor }: { initialMinor: number | null }) {
  const [minor, setMinor] = useState<number | null>(initialMinor)
  return (
    <>
      <MoneyInput valueMinor={minor} onValueMinorChange={setMinor} aria-label="amount" />
      <output data-testid="minor-value">{minor === null ? 'null' : minor}</output>
    </>
  )
}

describe('MoneyInput', () => {
  it('displays an initial minor-unit value in major units', () => {
    render(<ControlledMoneyInput initialMinor={449900} />)
    expect(screen.getByLabelText('amount')).toHaveValue('4499.00')
  })

  it('round-trips typed rupees back to minor units without floating-point error', async () => {
    const user = userEvent.setup()
    render(<ControlledMoneyInput initialMinor={null} />)

    const input = screen.getByLabelText('amount')
    await user.type(input, '1999.05')

    expect(screen.getByTestId('minor-value')).toHaveTextContent('199905')
  })

  it('preserves free-typed text (trailing decimal point) before it resolves', async () => {
    const user = userEvent.setup()
    render(<ControlledMoneyInput initialMinor={null} />)

    const input = screen.getByLabelText('amount')
    await user.type(input, '1999.')

    expect(input).toHaveValue('1999.')
    expect(screen.getByTestId('minor-value')).toHaveTextContent('null')
  })

  it('normalizes the display value on blur', async () => {
    const user = userEvent.setup()
    render(<ControlledMoneyInput initialMinor={null} />)

    const input = screen.getByLabelText('amount')
    await user.type(input, '1999.5')
    await user.tab()

    expect(input).toHaveValue('1999.50')
  })
})
