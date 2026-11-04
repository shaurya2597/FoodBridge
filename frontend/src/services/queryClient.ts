import { QueryClient } from '@tanstack/react-query'
import { shouldRetry } from './retryPolicy'

/** React Query keeps fetched data in a cache and handles loading/error states for us. These are the app-wide defaults. */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: shouldRetry, staleTime: 30_000, refetchOnWindowFocus: false },
    mutations: { retry: false },
  },
})
