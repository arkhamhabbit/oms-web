import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import type { ColumnDef } from '@tanstack/react-table'

import { DataTable } from '@/components/data-table/DataTable'

interface Row {
  id: string
  name: string
  count: number
}

const rows: Row[] = [
  { id: '1', name: 'Banana', count: 3 },
  { id: '2', name: 'Apple', count: 7 },
  { id: '3', name: 'Cherry', count: 1 },
]

const columns: ColumnDef<Row, unknown>[] = [
  { accessorKey: 'name', header: 'Name' },
  { accessorKey: 'count', header: 'Count' },
]

function getBodyNameCells() {
  const table = screen.getByRole('table')
  const bodyRows = within(table).getAllByRole('row').slice(1) // drop header row
  return bodyRows.map((row) => within(row).getAllByRole('cell')[0].textContent)
}

describe('DataTable', () => {
  it('renders rows in their original order by default', () => {
    render(<DataTable columns={columns} data={rows} />)
    expect(getBodyNameCells()).toEqual(['Banana', 'Apple', 'Cherry'])
  })

  it('sorts rows ascending then descending when the column header is clicked', async () => {
    const user = userEvent.setup()
    render(<DataTable columns={columns} data={rows} />)

    const nameHeader = screen.getByRole('button', { name: 'Name' })
    await user.click(nameHeader)
    expect(getBodyNameCells()).toEqual(['Apple', 'Banana', 'Cherry'])

    await user.click(nameHeader)
    expect(getBodyNameCells()).toEqual(['Cherry', 'Banana', 'Apple'])
  })

  it('shows the empty state when there is no data', () => {
    render(<DataTable columns={columns} data={[]} emptyMessage="Nothing here" />)
    expect(screen.getByText('Nothing here')).toBeInTheDocument()
  })

  it('shows the loading state', () => {
    render(<DataTable columns={columns} data={rows} isLoading />)
    expect(screen.getByText('Loading…')).toBeInTheDocument()
  })

  it('expands a row to reveal sub-row content and collapses it again', async () => {
    const user = userEvent.setup()
    render(
      <DataTable
        columns={columns}
        data={rows}
        renderSubRow={(row) => <div>Details for {row.name}</div>}
      />
    )

    expect(screen.queryByText('Details for Banana')).not.toBeInTheDocument()

    const expandButtons = screen.getAllByRole('button', { name: 'Expand row' })
    await user.click(expandButtons[0])

    expect(screen.getByText('Details for Banana')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Collapse row' }))
    expect(screen.queryByText('Details for Banana')).not.toBeInTheDocument()
  })
})
