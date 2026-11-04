import type { HealthStatus } from '../types/api'
import { api } from './api'
import { ApiError } from './apiError'

function looksLikeHealth(value: unknown): value is HealthStatus {
  return typeof value === 'object' && value !== null && 'status' in value && 'database' in value
}

/**
 * Asks the backend "are you alive, and is your database up?". A 503 ("degraded") still carries useful
 * information, so it is returned instead of thrown.
 */
export async function getHealth(signal?: AbortSignal): Promise<HealthStatus> {
  try {
    return await api.get<HealthStatus>('/health', { auth: false, signal })
  } catch (error) {
    if (error instanceof ApiError && error.status === 503 && looksLikeHealth(error.body)) return error.body
    throw error
  }
}
