import { describe, expect, it } from 'vitest'
import { ApiError, defaultMessage, fieldErrorsFrom, toApiError, userMessage } from './apiError'

describe('fieldErrorsFrom', () => {
  it('turns the backend list into a lookup by field', () => {
    expect(fieldErrorsFrom([{ field: 'email', message: 'Invalid email' }, { field: 'address.pincode', message: 'Enter a valid 6-digit PIN code' }])).toEqual({
      email: 'Invalid email',
      'address.pincode': 'Enter a valid 6-digit PIN code',
    })
  })
  it('keeps the first message when a field has several problems', () => {
    expect(fieldErrorsFrom([{ field: 'password', message: 'Too short' }, { field: 'password', message: 'Needs a number' }])).toEqual({ password: 'Too short' })
  })
  it('files problems without a field under "_form"', () => {
    expect(fieldErrorsFrom([{ field: '', message: 'Nothing to update' }])).toEqual({ _form: 'Nothing to update' })
  })
  it('ignores garbage safely', () => {
    expect(fieldErrorsFrom(undefined)).toEqual({})
    expect(fieldErrorsFrom('nope')).toEqual({})
    expect(fieldErrorsFrom([null, 5, { field: 3, message: 'x' }, { field: 'a' }])).toEqual({})
  })
})

describe('toApiError', () => {
  it('uses the server message and field errors', () => {
    const error = toApiError(400, { success: false, message: 'Validation failed', errors: [{ field: 'phone', message: 'Enter a valid number' }] })
    expect(error).toBeInstanceOf(ApiError)
    expect(error.status).toBe(400)
    expect(error.kind).toBe('http')
    expect(error.message).toBe('Validation failed')
    expect(error.fieldErrors).toEqual({ phone: 'Enter a valid number' })
  })
  it('falls back to a friendly default when the body is missing or odd', () => {
    expect(toApiError(404, undefined).message).toBe(defaultMessage(404))
    expect(toApiError(500, 'plain text').message).toBe(defaultMessage(500))
    expect(toApiError(409, { message: '' }).message).toBe(defaultMessage(409))
  })
  it('keeps the raw body (used for the 503 health report)', () => {
    expect(toApiError(503, { status: 'degraded' }).body).toEqual({ status: 'degraded' })
  })
})

describe('userMessage', () => {
  const http = (status: number, message = 'Server says no') => new ApiError({ message, status, kind: 'http' })
  it('explains network and timeout problems plainly', () => {
    expect(userMessage(new ApiError({ message: 'x', status: 0, kind: 'network' }))).toContain("can't reach the server")
    expect(userMessage(new ApiError({ message: 'x', status: 0, kind: 'timeout' }))).toContain('taking too long')
  })
  it('handles the common HTTP statuses', () => {
    expect(userMessage(http(401))).toContain('log in again')
    expect(userMessage(http(429))).toContain('Too many requests')
    expect(userMessage(http(500, 'secret internal detail'))).not.toContain('secret internal detail')
  })
  it('shows the server message for 400, 403, 404 and 409', () => {
    for (const status of [400, 403, 404, 409]) expect(userMessage(http(status, 'Specific reason'))).toBe('Specific reason')
  })
  it('never leaks the text of unknown errors', () => {
    expect(userMessage(new Error('database password is hunter2'))).not.toContain('hunter2')
    expect(userMessage('weird')).toContain('unexpected')
  })
})
