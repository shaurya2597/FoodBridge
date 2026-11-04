import { config } from '../utils/config'
import { createApiClient } from './apiClient'
import { tokenStore } from './tokenStorage'

const sessionExpiredListeners = new Set<() => void>()

/** Lets the app (from M2 on, the login screen logic) react when the server ends the session. Returns an "unsubscribe" function. */
export function onSessionExpired(listener: () => void): () => void {
  sessionExpiredListeners.add(listener)
  return () => {
    sessionExpiredListeners.delete(listener)
  }
}

/** The one API client used everywhere. Services call `api.get('/restaurants')`, never fetch() directly. */
export const api = createApiClient({
  baseUrl: config.apiUrl,
  tokens: tokenStore,
  onUnauthorized: () => {
    sessionExpiredListeners.forEach((listener) => listener())
  },
})
