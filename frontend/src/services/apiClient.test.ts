import { describe, expect, it } from 'vitest'
import { ApiError } from './apiError'
import { buildUrl, createApiClient } from './apiClient'
import { createTokenStore } from './tokenStorage'

const b64url = (value: object) => btoa(JSON.stringify(value)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
const TOKEN = `${b64url({ alg: 'HS256', typ: 'JWT' })}.${b64url({ sub: 'user-1' })}.c2lnbmF0dXJl`
const BASE = 'http://localhost:5000/api'

interface Seen { url: string; method?: string; headers: Record<string, string>; body?: unknown }

function setup(respond: (seen: Seen) => Response | Promise<Response>, signedIn = true) {
  const calls: Seen[] = []
  const store = createTokenStore(null)
  if (signedIn) store.setToken(TOKEN)
  let unauthorizedCalls = 0
  const fetchImpl = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const seen: Seen = { url: String(input), method: init?.method, headers: (init?.headers ?? {}) as Record<string, string>, body: init?.body }
    calls.push(seen)
    return respond(seen)
  }) as typeof fetch
  const api = createApiClient({ baseUrl: BASE, tokens: store, fetchImpl, timeoutMs: 50, onUnauthorized: () => { unauthorizedCalls += 1 } })
  return { api, calls, store, unauthorized: () => unauthorizedCalls }
}

const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

describe('buildUrl', () => {
  it('joins base and path whatever the slashes, and skips empty query values', () => {
    expect(buildUrl('http://x/api/', 'restaurants')).toBe('http://x/api/restaurants')
    expect(buildUrl('http://x/api', '/restaurants', { q: 'dal', page: 2, veg: true, a: undefined, b: null, c: '' })).toBe('http://x/api/restaurants?q=dal&page=2&veg=true')
  })
  it('encodes special characters', () => {
    expect(buildUrl('http://x/api', '/foods', { q: 'a&b c' })).toBe('http://x/api/foods?q=a%26b+c')
  })
})

describe('api client: sending', () => {
  it('adds the Bearer token when signed in, and parses the JSON answer', async () => {
    const { api, calls } = setup(() => json(200, { success: true, data: [1, 2] }))
    const result = await api.get<{ data: number[] }>('/restaurants', { query: { page: 1 } })
    expect(result.data).toEqual([1, 2])
    expect(calls[0].url).toBe(`${BASE}/restaurants?page=1`)
    expect(calls[0].method).toBe('GET')
    expect(calls[0].headers.Authorization).toBe(`Bearer ${TOKEN}`)
  })
  it('sends no Authorization header when signed out or when auth is switched off', async () => {
    const out = setup(() => json(200, { success: true }), false)
    await out.api.get('/restaurants')
    expect(out.calls[0].headers.Authorization).toBeUndefined()
    const publicCall = setup(() => json(200, { success: true }))
    await publicCall.api.get('/health', { auth: false })
    expect(publicCall.calls[0].headers.Authorization).toBeUndefined()
  })
  it('sends JSON bodies with the right content type', async () => {
    const { api, calls } = setup(() => json(201, { success: true }))
    await api.post('/cart/items', { foodItemId: 'f1', quantity: 2 })
    expect(calls[0].method).toBe('POST')
    expect(calls[0].headers['Content-Type']).toBe('application/json')
    expect(JSON.parse(calls[0].body as string)).toEqual({ foodItemId: 'f1', quantity: 2 })
  })
  it('handles an empty successful answer', async () => {
    const { api } = setup(() => new Response(null, { status: 204 }))
    expect(await api.delete('/cart')).toBeUndefined()
  })
})

describe('api client: failures', () => {
  it('turns a validation error into an ApiError with field messages', async () => {
    const { api } = setup(() => json(400, { success: false, message: 'Validation failed', errors: [{ field: 'phone', message: 'Enter a valid number' }] }))
    const error = await api.post('/auth/register', {}).catch((e: unknown) => e)
    expect(error).toBeInstanceOf(ApiError)
    expect((error as ApiError).status).toBe(400)
    expect((error as ApiError).fieldErrors).toEqual({ phone: 'Enter a valid number' })
  })
  it('on 401 with a token: clears it and tells the app the session ended', async () => {
    const t = setup(() => json(401, { success: false, message: 'Your session has ended. Please log in again.' }))
    const error = await t.api.get('/auth/me').catch((e: unknown) => e)
    expect((error as ApiError).status).toBe(401)
    expect(t.store.getToken()).toBeNull()
    expect(t.unauthorized()).toBe(1)
  })
  it('on 401 without a token (e.g. wrong password at login): does nothing extra', async () => {
    const t = setup(() => json(401, { success: false, message: 'Invalid email or password' }), false)
    await t.api.post('/auth/login', {}, { auth: false }).catch(() => undefined)
    expect(t.unauthorized()).toBe(0)
  })
  it('a public call (auth: false) never logs you out, even if you hold a token', async () => {
    const t = setup(() => json(401, { success: false, message: 'Invalid email or password' }))
    await t.api.post('/auth/login', {}, { auth: false }).catch(() => undefined)
    expect(t.store.getToken()).toBe(TOKEN)
    expect(t.unauthorized()).toBe(0)
  })
  it('403, 404 and 409 keep the session', async () => {
    for (const status of [403, 404, 409]) {
      const t = setup(() => json(status, { success: false, message: 'Nope' }))
      await t.api.get('/x').catch(() => undefined)
      expect(t.store.getToken()).toBe(TOKEN)
      expect(t.unauthorized()).toBe(0)
    }
  })
  it('keeps the body of a 503 so the health page can show "database down"', async () => {
    const { api } = setup(() => json(503, { success: false, status: 'degraded', database: 'down' }))
    const error = (await api.get('/health', { auth: false }).catch((e: unknown) => e)) as ApiError
    expect(error.status).toBe(503)
    expect(error.body).toEqual({ success: false, status: 'degraded', database: 'down' })
  })
  it('copes with a non-JSON error page', async () => {
    const { api } = setup(() => new Response('<html>Bad gateway</html>', { status: 502 }))
    const error = (await api.get('/x').catch((e: unknown) => e)) as ApiError
    expect(error.status).toBe(502)
    expect(error.message).toBe('Something went wrong on our side.')
  })
  it('reports an unreadable success response', async () => {
    const { api } = setup(() => new Response('not json', { status: 200 }))
    const error = (await api.get('/x').catch((e: unknown) => e)) as ApiError
    expect(error.kind).toBe('parse')
  })
  it('reports a network failure as status 0', async () => {
    const { api } = setup(() => { throw new TypeError('Failed to fetch') })
    const error = (await api.get('/x').catch((e: unknown) => e)) as ApiError
    expect(error).toBeInstanceOf(ApiError)
    expect(error.kind).toBe('network')
    expect(error.status).toBe(0)
  })
  it('gives up on a server that never answers', async () => {
    const calls: string[] = []
    const store = createTokenStore(null)
    const hanging = ((_input: RequestInfo | URL, init?: RequestInit) =>
      new Promise<Response>((_resolve, reject) => {
        calls.push('start')
        init?.signal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')))
      })) as typeof fetch
    const client = createApiClient({ baseUrl: BASE, tokens: store, fetchImpl: hanging, timeoutMs: 20 })
    const error = (await client.get('/x').catch((e: unknown) => e)) as ApiError
    expect(error.kind).toBe('timeout')
    expect(calls.length).toBe(1)
  })
  it('lets deliberate cancellation pass through instead of reporting an error', async () => {
    const store = createTokenStore(null)
    const hanging = ((_input: RequestInfo | URL, init?: RequestInit) =>
      new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')))
      })) as typeof fetch
    const client = createApiClient({ baseUrl: BASE, tokens: store, fetchImpl: hanging, timeoutMs: 1000 })
    const controller = new AbortController()
    const pending = client.get('/x', { signal: controller.signal }).catch((e: unknown) => e)
    controller.abort()
    const error = await pending
    expect(error).not.toBeInstanceOf(ApiError)
    expect((error as Error).name).toBe('AbortError')
  })
})

describe('api client: token safety', () => {
  it('never copies the token into an error, its message, or its raw body', async () => {
    const { api } = setup(() => json(500, { success: false, message: 'Boom' }))
    const error = (await api.get('/x').catch((e: unknown) => e)) as ApiError
    const everything = JSON.stringify({ message: error.message, body: error.body, details: error.details, fields: error.fieldErrors, name: error.name })
    expect(everything).not.toContain(TOKEN)
    expect(everything).not.toContain('Bearer')
  })
})
