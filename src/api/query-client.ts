import { QueryClient } from '@tanstack/react-query'

import { ApiClientError } from '@/lib/api-error'

/**
 * Sensible defaults for an admin tool, not a public app: no refetch-on-focus (an admin
 * tab left open overnight shouldn't silently start refetching every list), and no retry
 * on a 4xx — a permission or validation failure will not change on its own.
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: (failureCount, error) => {
        if (error instanceof ApiClientError && error.status >= 400 && error.status < 500) {
          return false
        }
        return failureCount < 2
      },
    },
    mutations: {
      retry: false,
    },
  },
})
