import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach } from 'vitest'

// After every test, remove whatever the test drew on the (pretend) screen.
afterEach(() => {
  cleanup()
})
