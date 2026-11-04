import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { ApiError } from '@/services/apiError'
import { getHealth } from '@/services/health'
import { StatusPage } from './StatusPage'

vi.mock('@/services/health', () => ({ getHealth: vi.fn() }))

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <StatusPage />
    </QueryClientProvider>,
  )
}

describe('StatusPage', () => {
  it('shows a loading message first', () => {
    vi.mocked(getHealth).mockReturnValue(new Promise(() => undefined))
    renderPage()
    expect(screen.getByText('Checking the API…')).toBeInTheDocument()
  })

  it('shows "API connected" when the backend and database are healthy', async () => {
    vi.mocked(getHealth).mockResolvedValue({ success: true, status: 'ok', database: 'up', razorpay: 'demo', demoPayments: true })
    renderPage()
    expect(await screen.findByText('API connected')).toBeInTheDocument()
    expect(screen.getByText('Demo mode (no real money)')).toBeInTheDocument()
  })

  it('explains when the backend is up but the database is down', async () => {
    vi.mocked(getHealth).mockResolvedValue({ success: false, status: 'degraded', database: 'down', razorpay: 'demo', demoPayments: true })
    renderPage()
    expect(await screen.findByText('API reachable, database down')).toBeInTheDocument()
  })

  it('gives helpful hints when the backend cannot be reached', async () => {
    vi.mocked(getHealth).mockRejectedValue(new ApiError({ message: "Can't reach the server.", status: 0, kind: 'network' }))
    renderPage()
    expect(await screen.findByText('Cannot reach the API')).toBeInTheDocument()
    expect(screen.getByText(/Is the backend running/)).toBeInTheDocument()
  })
})
