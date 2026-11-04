export interface AppConfig {
  /** Where the backend API lives, without a trailing slash, e.g. http://localhost:5000/api */
  apiUrl: string
  /** Just the server part, e.g. http://localhost:5000 (the live-update socket connects here later). */
  apiOrigin: string
}

export const DEFAULT_API_URL = 'http://localhost:5000/api'

/** Checks the VITE_API_URL setting and gives a clear message if it is wrong, instead of failing mysteriously later. */
export function resolveConfig(raw: string | undefined, fallback: string = DEFAULT_API_URL): AppConfig {
  const value = (raw ?? '').trim() || fallback
  let url: URL
  try {
    url = new URL(value)
  } catch {
    throw new Error(`VITE_API_URL is not a valid web address: "${value}". Example: ${DEFAULT_API_URL}`)
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error(`VITE_API_URL must start with http:// or https:// (got "${value}").`)
  }
  return { apiUrl: value.replace(/\/+$/, ''), apiOrigin: url.origin }
}
