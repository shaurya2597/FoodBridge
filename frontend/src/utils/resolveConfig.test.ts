import { describe, expect, it } from 'vitest'
import { DEFAULT_API_URL, resolveConfig } from './resolveConfig'

describe('resolveConfig', () => {
  it('uses the default when nothing is set', () => {
    expect(resolveConfig(undefined)).toEqual({ apiUrl: DEFAULT_API_URL, apiOrigin: 'http://localhost:5000' })
    expect(resolveConfig('   ').apiUrl).toBe(DEFAULT_API_URL)
  })
  it('trims trailing slashes and finds the server origin', () => {
    expect(resolveConfig('https://api.example.com/v1///')).toEqual({ apiUrl: 'https://api.example.com/v1', apiOrigin: 'https://api.example.com' })
  })
  it('rejects values that are not web addresses, with a helpful message', () => {
    expect(() => resolveConfig('localhost:5000/api')).toThrow(/VITE_API_URL/)
    expect(() => resolveConfig('not a url')).toThrow(/valid web address/)
    expect(() => resolveConfig('ftp://example.com')).toThrow(/http:\/\//)
    expect(() => resolveConfig('javascript:alert(1)')).toThrow()
  })
})
