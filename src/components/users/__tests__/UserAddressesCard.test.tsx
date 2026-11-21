import { json, resetFetch, respondWith } from '@/test/fake-fetch'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'

import { UserAddressesCard } from '@/components/users/UserProfileCards'

beforeEach(() => {
  resetFetch()
  respondWith(() =>
    json(200, [
      {
        id: 'a-1',
        label: 'Home',
        line1: '12 Test Street',
        landmark: 'Mukherjee Nagar',
        city: 'North West Delhi',
        state: 'Delhi',
        pincode: '110009',
        deliveryMobile: '+919999900001',
        isDefault: true,
      },
      { id: 'a-2', label: 'Old flat', line1: '9 Old Road', pincode: '400069', deliveryMobile: '+919999900001' },
    ])
  )
})

describe('the user detail addresses', () => {
  it('reads each as one line with city and state, and says so when one has none', async () => {
    render(
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <UserAddressesCard userId="u-1" />
      </QueryClientProvider>
    )
    expect(await screen.findByText('12 Test Street, Mukherjee Nagar, North West Delhi, Delhi 110009')).toBeInTheDocument()
    expect(screen.getByText('9 Old Road 400069')).toBeInTheDocument()
    expect(screen.getAllByText('No city or state on this address')).toHaveLength(1)
  })
})
