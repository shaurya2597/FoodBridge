import { ApiError, toApiError } from './apiError'
import type { TokenStore } from './tokenStorage'

export type QueryParams = Record<string, string | number | boolean | null | undefined>

export interface RequestOptions {
  /** Becomes ?a=1&b=2. Empty values are left out. */
  query?: QueryParams
  /** Sent as JSON. */
  body?: unknown
  /** Lets the caller cancel the request (React Query does this automatically). */
  signal?: AbortSignal
  /** Set to false for public calls (login, health): no token is attached and a 401 does not log you out. */
  auth?: boolean
}

export interface ApiClientOptions {
  baseUrl: string
  tokens: Pick<TokenStore, 'getToken' | 'clearToken'>
  fetchImpl?: typeof fetch
  timeoutMs?: number
  /** Called after a 401 on a request that carried a token (the session ended). The token is already cleared. */
  onUnauthorized?: () => void
}

export function buildUrl(baseUrl: string, path: string, query?: QueryParams): string {
  const base = baseUrl.replace(/\/+$/, '')
  const cleanPath = path.startsWith('/') ? path : `/${path}`
  const params = new URLSearchParams()
  if (query) {
    for (const [key, value] of Object.entries(query)) {
      if (value === undefined || value === null || value === '') continue
      params.set(key, String(value))
    }
  }
  const queryString = params.toString()
  return `${base}${cleanPath}${queryString ? `?${queryString}` : ''}`
}

/**
 * A small wrapper around fetch() that every call to the backend goes through. It:
 *  - adds the Authorization header (only here, only when a valid token exists),
 *  - turns failures into ApiError objects,
 *  - clears the token and tells the app when the server says the session is over (401),
 *  - never logs or copies the token anywhere.
 */
export function createApiClient(options: ApiClientOptions) {
  const { baseUrl, tokens, timeoutMs = 15_000, onUnauthorized } = options
  const doFetch: typeof fetch = options.fetchImpl ?? ((input, init) => fetch(input, init))

  async function request<T>(method: string, path: string, opts: RequestOptions = {}): Promise<T> {
    const token = opts.auth === false ? null : tokens.getToken()
    const headers: Record<string, string> = { Accept: 'application/json' }
    if (token) headers.Authorization = `Bearer ${token}`
    let body: string | undefined
    if (opts.body !== undefined) {
      headers['Content-Type'] = 'application/json'
      body = JSON.stringify(opts.body)
    }

    const controller = new AbortController()
    let timedOut = false
    const timer = setTimeout(() => {
      timedOut = true
      controller.abort()
    }, timeoutMs)
    const forwardAbort = () => controller.abort()
    if (opts.signal) {
      if (opts.signal.aborted) controller.abort()
      else opts.signal.addEventListener('abort', forwardAbort, { once: true })
    }

    let response: Response
    try {
      response = await doFetch(buildUrl(baseUrl, path, opts.query), { method, headers, body, signal: controller.signal })
    } catch (error) {
      if (timedOut) throw new ApiError({ message: 'The server took too long to respond.', status: 0, kind: 'timeout' })
      if (opts.signal?.aborted) throw error // the caller cancelled on purpose; that is not a failure to report
      throw new ApiError({ message: "Can't reach the server.", status: 0, kind: 'network' })
    } finally {
      clearTimeout(timer)
      opts.signal?.removeEventListener('abort', forwardAbort)
    }

    const text = await response.text().catch(() => '')
    let parsed: unknown
    let parseFailed = false
    if (text) {
      try {
        parsed = JSON.parse(text)
      } catch {
        parseFailed = true
      }
    }

    if (!response.ok) {
      if (response.status === 401 && token) {
        tokens.clearToken()
        onUnauthorized?.()
      }
      throw toApiError(response.status, parseFailed ? undefined : parsed)
    }
    if (parseFailed) throw new ApiError({ message: 'The server sent an unreadable response.', status: response.status, kind: 'parse' })
    return parsed as T
  }

  return {
    request,
    get: <T>(path: string, opts?: RequestOptions) => request<T>('GET', path, opts),
    post: <T>(path: string, body?: unknown, opts?: RequestOptions) => request<T>('POST', path, { ...opts, body }),
    put: <T>(path: string, body?: unknown, opts?: RequestOptions) => request<T>('PUT', path, { ...opts, body }),
    patch: <T>(path: string, body?: unknown, opts?: RequestOptions) => request<T>('PATCH', path, { ...opts, body }),
    delete: <T>(path: string, opts?: RequestOptions) => request<T>('DELETE', path, opts),
  }
}

export type ApiClient = ReturnType<typeof createApiClient>
