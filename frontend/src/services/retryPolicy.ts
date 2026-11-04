import { ApiError } from './apiError'

/**
 * When should the app automatically try a failed request again?
 * Never for "your request was wrong" errors (400-499): retrying cannot fix them.
 * Once for network hiccups and server errors.
 */
export function shouldRetry(failureCount: number, error: unknown): boolean {
  if (error instanceof ApiError && error.status >= 400 && error.status < 500) return false
  return failureCount < 1
}
