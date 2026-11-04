import { describe, expect, it } from 'vitest'
import { ApiError } from './apiError'
import { shouldRetry } from './retryPolicy'

const http = (status: number) => new ApiError({ message: 'x', status, kind: 'http' })

describe('shouldRetry', () => {
  it('never retries mistakes the user must fix (4xx)', () => {
    for (const status of [400, 401, 403, 404, 409, 429]) expect(shouldRetry(0, http(status))).toBe(false)
  })
  it('retries server and network problems once', () => {
    expect(shouldRetry(0, http(500))).toBe(true)
    expect(shouldRetry(0, new ApiError({ message: 'x', status: 0, kind: 'network' }))).toBe(true)
    expect(shouldRetry(1, http(500))).toBe(false)
  })
})
