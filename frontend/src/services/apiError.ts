import type { FieldIssue } from '../types/api'

export type ApiErrorKind = 'network' | 'timeout' | 'http' | 'parse'

export interface ApiErrorInit {
  message: string
  status: number
  kind: ApiErrorKind
  fieldErrors?: Record<string, string>
  details?: unknown
  body?: unknown
}

/**
 * Every failed call to the backend becomes one of these, so the rest of the app only has to
 * understand a single kind of error. `status` is the HTTP status (0 when the server was never reached).
 */
export class ApiError extends Error {
  readonly status: number
  readonly kind: ApiErrorKind
  /** Per-field messages for forms, keyed by field path such as "address.pincode". "_form" holds problems not tied to one field. */
  readonly fieldErrors: Record<string, string>
  readonly details: unknown
  /** The raw JSON the server sent (never includes our own token). */
  readonly body: unknown

  constructor(init: ApiErrorInit) {
    super(init.message)
    this.name = 'ApiError'
    this.status = init.status
    this.kind = init.kind
    this.fieldErrors = init.fieldErrors ?? {}
    this.details = init.details
    this.body = init.body
  }
}

export function defaultMessage(status: number): string {
  if (status === 400) return 'The request was not valid.'
  if (status === 401) return 'Please log in to continue.'
  if (status === 403) return 'You do not have permission to do that.'
  if (status === 404) return 'We could not find that.'
  if (status === 409) return 'That conflicts with the current state. Please refresh and try again.'
  if (status === 429) return 'Too many requests. Please wait a moment and try again.'
  if (status >= 500) return 'Something went wrong on our side.'
  return 'Something went wrong.'
}

/** Turns the backend's [{field, message}] list into { field: message }. The first message for a field wins. */
export function fieldErrorsFrom(errors: unknown): Record<string, string> {
  const result: Record<string, string> = {}
  if (!Array.isArray(errors)) return result
  for (const item of errors as Partial<FieldIssue>[]) {
    if (!item || typeof item !== 'object') continue
    if (typeof item.field !== 'string' || typeof item.message !== 'string') continue
    const key = item.field === '' ? '_form' : item.field
    if (!(key in result)) result[key] = item.message
  }
  return result
}

interface FailureBody {
  message?: unknown
  errors?: unknown
  details?: unknown
}

export function toApiError(status: number, body: unknown): ApiError {
  const parsed: FailureBody = typeof body === 'object' && body !== null ? (body as FailureBody) : {}
  const message = typeof parsed.message === 'string' && parsed.message ? parsed.message : defaultMessage(status)
  return new ApiError({ message, status, kind: 'http', fieldErrors: fieldErrorsFrom(parsed.errors), details: parsed.details, body })
}

/** A short, friendly sentence that is safe to show on screen for any error. */
export function userMessage(error: unknown): string {
  if (!(error instanceof ApiError)) return 'Something unexpected happened. Please try again.'
  if (error.kind === 'network') return "We can't reach the server. Check your internet connection and that the backend is running."
  if (error.kind === 'timeout') return 'The server is taking too long to respond. Please try again.'
  if (error.kind === 'parse') return 'We got an unexpected response from the server.'
  if (error.status === 401) return 'Your session has ended. Please log in again.'
  if (error.status === 429) return 'Too many requests. Please wait a moment and try again.'
  if (error.status >= 500) return 'Something went wrong on our side. Please try again in a moment.'
  return error.message // 400, 403, 404, 409: the server's own message is specific and safe to show
}
