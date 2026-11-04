import { describe, expect, it } from 'vitest'
import { SESSION_KEY, createTokenStore, isUsableToken, parseJwtExpiry } from './tokenStorage'
import type { StorageLike } from './tokenStorage'

const b64url = (value: object) => btoa(JSON.stringify(value)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
/** Builds a token that LOOKS like a real one (the signature part is fake; the browser never verifies it anyway). */
const makeToken = (expSeconds?: number) => `${b64url({ alg: 'HS256', typ: 'JWT' })}.${b64url({ sub: 'user-1', ...(expSeconds !== undefined && { exp: expSeconds }) })}.c2lnbmF0dXJl`

function memoryStorage(): StorageLike & { data: Map<string, string> } {
  const data = new Map<string, string>()
  return {
    data,
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => void data.set(key, value),
    removeItem: (key) => void data.delete(key),
  }
}

const NOW = 1_800_000_000_000 // a fixed "current time" in milliseconds
const future = NOW / 1000 + 3600
const past = NOW / 1000 - 10

describe('token shape and expiry', () => {
  it('reads the expiry claim, or null when there is none', () => {
    expect(parseJwtExpiry(makeToken(future))).toBe(future * 1000)
    expect(parseJwtExpiry(makeToken())).toBeNull()
    expect(parseJwtExpiry('not-a-token')).toBeNull()
  })
  it('accepts only well-formed, unexpired tokens', () => {
    expect(isUsableToken(makeToken(future), NOW)).toBe(true)
    expect(isUsableToken(makeToken(), NOW)).toBe(true)
    expect(isUsableToken(makeToken(past), NOW)).toBe(false)
    expect(isUsableToken('garbage', NOW)).toBe(false)
    expect(isUsableToken('a.b', NOW)).toBe(false)
    expect(isUsableToken('', NOW)).toBe(false)
  })
})

describe('token store', () => {
  it('saves, returns and clears the token', () => {
    const storage = memoryStorage()
    const store = createTokenStore(storage, () => NOW)
    const token = makeToken(future)
    expect(store.getToken()).toBeNull()
    expect(store.setToken(token)).toBe(true)
    expect(store.getToken()).toBe(token)
    expect(storage.data.get(SESSION_KEY)).toBe(token)
    store.clearToken()
    expect(store.getToken()).toBeNull()
    expect(storage.data.has(SESSION_KEY)).toBe(false)
  })

  it('refuses to store garbage or expired tokens, and clears any old one', () => {
    const storage = memoryStorage()
    const store = createTokenStore(storage, () => NOW)
    store.setToken(makeToken(future))
    expect(store.setToken('garbage')).toBe(false)
    expect(store.getToken()).toBeNull()
    expect(store.setToken(makeToken(past))).toBe(false)
    expect(storage.data.size).toBe(0)
  })

  it('removes an expired token the moment it is read, so it is never sent', () => {
    const storage = memoryStorage()
    let now = NOW
    const store = createTokenStore(storage, () => now)
    store.setToken(makeToken(future))
    now = NOW + 2 * 3600 * 1000
    expect(store.getToken()).toBeNull()
    expect(storage.data.size).toBe(0)
  })

  it('ignores junk that something else wrote into storage', () => {
    const storage = memoryStorage()
    storage.data.set(SESSION_KEY, '<script>alert(1)</script>')
    const store = createTokenStore(storage, () => NOW)
    expect(store.getToken()).toBeNull()
    expect(storage.data.size).toBe(0)
  })

  it('tells subscribers when the token changes or is cleared, and stops after unsubscribe', () => {
    const store = createTokenStore(memoryStorage(), () => NOW)
    const seen: (string | null)[] = []
    const stop = store.subscribe((token) => seen.push(token))
    const token = makeToken(future)
    store.setToken(token)
    store.clearToken()
    store.clearToken() // nothing to clear: no extra notification
    stop()
    store.setToken(token)
    expect(seen).toEqual([token, null])
  })

  it('keeps working in memory when browser storage is blocked', () => {
    const blocked: StorageLike = {
      getItem: () => { throw new Error('blocked') },
      setItem: () => { throw new Error('blocked') },
      removeItem: () => { throw new Error('blocked') },
    }
    const store = createTokenStore(blocked, () => NOW)
    const token = makeToken(future)
    expect(store.setToken(token)).toBe(true)
    expect(store.getToken()).toBe(token)
    store.clearToken()
    expect(store.getToken()).toBeNull()
  })

  it('works with no storage at all', () => {
    const store = createTokenStore(null, () => NOW)
    const token = makeToken(future)
    store.setToken(token)
    expect(store.getToken()).toBe(token)
  })
})
