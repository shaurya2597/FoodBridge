/**
 * THE ONLY place in the app that touches the login token's storage.
 *
 * Security trade-off (see README, "Security notes"): the token lives in the browser's localStorage so you stay
 * logged in after a refresh. Any script that runs inside the page could read it, which is why the rest of the
 * app must never render raw HTML, never log tokens, and never put them in URLs. `npm run check:security`
 * enforces those rules, including "no other file may use localStorage".
 */

export const SESSION_KEY = 'foodbridge.session.v1'

export interface StorageLike {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
  removeItem(key: string): void
}

export type TokenListener = (token: string | null) => void

const JWT_SHAPE = /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/

function decodeBase64Url(value: string): string {
  const base64 = value.replace(/-/g, '+').replace(/_/g, '/')
  return atob(base64 + '='.repeat((4 - (base64.length % 4)) % 4))
}

/** When the token stops working, as a millisecond timestamp, or null if it has no `exp` claim. We only READ it; the server is what actually verifies tokens. */
export function parseJwtExpiry(token: string): number | null {
  try {
    const payload = JSON.parse(decodeBase64Url(token.split('.')[1])) as { exp?: unknown }
    return typeof payload.exp === 'number' ? payload.exp * 1000 : null
  } catch {
    return null
  }
}

/** True for something that looks like a JWT and has not expired. Garbage in storage is ignored, never sent to the server. */
export function isUsableToken(token: string, nowMs: number): boolean {
  if (!JWT_SHAPE.test(token)) return false
  const expiry = parseJwtExpiry(token)
  return expiry === null || expiry > nowMs
}

function browserStorage(): StorageLike | null {
  try {
    return typeof window !== 'undefined' ? window.localStorage : null
  } catch {
    return null // some browsers block storage entirely (e.g. strict privacy modes)
  }
}

export function createTokenStore(storage: StorageLike | null = browserStorage(), now: () => number = () => Date.now()) {
  let memoryToken: string | null = null // used when storage is unavailable, so the app still works until the tab closes
  const listeners = new Set<TokenListener>()

  const emit = (token: string | null) => {
    for (const listener of listeners) listener(token)
  }

  function readRaw(): string | null {
    if (storage) {
      try {
        return storage.getItem(SESSION_KEY)
      } catch {
        /* storage failed: fall back to the in-memory copy below */
      }
    }
    return memoryToken
  }

  function writeRaw(token: string | null): void {
    memoryToken = token
    if (!storage) return
    try {
      if (token === null) storage.removeItem(SESSION_KEY)
      else storage.setItem(SESSION_KEY, token)
    } catch {
      /* the in-memory copy still works */
    }
  }

  function clearToken(): void {
    const hadToken = readRaw() !== null
    writeRaw(null)
    if (hadToken) emit(null)
  }

  function getToken(): string | null {
    const raw = readRaw()
    if (raw === null) return null
    if (!isUsableToken(raw, now())) {
      clearToken() // malformed or expired: remove it so it is never sent
      return null
    }
    return raw
  }

  function setToken(token: string): boolean {
    if (!isUsableToken(token, now())) {
      clearToken()
      return false
    }
    writeRaw(token)
    emit(token)
    return true
  }

  function subscribe(listener: TokenListener): () => void {
    listeners.add(listener)
    return () => {
      listeners.delete(listener)
    }
  }

  return { getToken, setToken, clearToken, subscribe }
}

export type TokenStore = ReturnType<typeof createTokenStore>

/** The one shared store used by the whole app. */
export const tokenStore: TokenStore = createTokenStore()
