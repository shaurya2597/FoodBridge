import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import {
  Activity,
  AlertTriangle,
  HeartHandshake,
  Leaf,
  Package,
  RefreshCw,
  Store,
  Users,
  Wallet,
} from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { userMessage } from '@/services/apiError'
import { getAdminDashboard } from '@/services/admin'

const money = (amount: number, currency: string) =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(amount)

export function AdminDashboardPage() {
  const navigate = useNavigate()
  const dashboardQuery = useQuery({
    queryKey: ['admin', 'dashboard'],
    queryFn: ({ signal }) => getAdminDashboard(signal),
    staleTime: 30_000,
  })

  const data = dashboardQuery.data

  const stats = data
    ? [
        {
          label: 'Total users',
          to: '/admin/users',
          value: data.users.total,
          note: `${data.users.blocked} blocked accounts`,
          icon: Users,
        },
        {
          label: 'Restaurants',
          to: '/admin/restaurants',
          value: data.restaurants.total,
          note: `${data.restaurants.pendingApproval} awaiting approval`,
          icon: Store,
        },
        {
          label: 'Total orders',
          to: '/admin/orders',
          value: data.orders.total,
          note: `${data.orders.last24Hours} in the last 24 hours`,
          icon: Package,
        },
        {
          label: 'Revenue',
          to: '/admin/orders',
          value: money(data.revenue.total, data.revenue.currency),
          note: 'Recorded platform revenue',
          icon: Wallet,
        },
        {
          label: 'Active donations',
          to: '/admin/donations',
          value: data.donations.active,
          note: `${data.donations.servingsDonated.toLocaleString('en-IN')} servings donated`,
          icon: HeartHandshake,
        },
        {
          label: 'Completed donations',
          to: '/admin/donations',
          value: data.donations.collectedOrDistributed,
          note: 'Collected or distributed',
          icon: Leaf,
        },
        {
          label: 'NGOs awaiting verification',
          to: '/admin/ngos',
          value: data.ngos.awaitingVerification,
          note: 'Require admin review',
          icon: Activity,
        },
        {
          label: 'Open assistance requests',
          to: '/admin/complaints',
          value: data.assistance.open,
          note: `${data.complaints.pending} pending complaints`,
          icon: AlertTriangle,
        },
      ]
    : []

  if (dashboardQuery.isPending) {
    return (
      <div className="mx-auto max-w-6xl py-16 text-center text-sm text-slate-500">
        Loading admin dashboard...
      </div>
    )
  }

  if (dashboardQuery.isError) {
    return (
      <div className="mx-auto max-w-6xl rounded-2xl border border-red-200 bg-red-50 p-6">
        <h2 className="font-semibold text-red-900">
          Could not load admin dashboard
        </h2>
        <p className="mt-2 text-sm text-red-700">
          {userMessage(dashboardQuery.error)}
        </p>
        <button
          type="button"
          onClick={() => void dashboardQuery.refetch()}
          className="mt-4 rounded-lg bg-red-100 px-4 py-2 text-sm font-semibold text-red-800 hover:bg-red-200"
        >
          Try again
        </button>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-6xl">
      <div className="mb-7 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[.16em] text-emerald-700">
            Platform management
          </p>
          <h1 className="mt-2 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
            Admin dashboard
          </h1>
          <p className="mt-2 text-sm text-slate-500">
            Monitor FoodBridge activity and review important platform updates.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void dashboardQuery.refetch()}
          disabled={dashboardQuery.isFetching}
          className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
        >
          <RefreshCw
            size={16}
            className={dashboardQuery.isFetching ? 'animate-spin' : ''}
          />
          Refresh
        </button>
      </div>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {stats.map(({ label, value, note, icon: Icon, to }, index) => (
          <Card
            key={label}
            onClick={() => navigate(to)}
            role="button"
            tabIndex={0}
            onKeyDown={(event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault()
                navigate(to)
              }
            }}
            className="cursor-pointer rounded-2xl border-slate-200/80 bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600"
          >
            <CardContent className="p-5">
              <span
                className={`grid size-10 place-items-center rounded-xl ${
                  index % 2 === 0
                    ? 'bg-emerald-50 text-emerald-700'
                    : 'bg-orange-50 text-orange-700'
                }`}
              >
                <Icon size={19} />
              </span>
              <p className="mt-5 text-xs font-medium text-slate-500">
                {label}
              </p>
              <p className="mt-1 text-2xl font-bold text-slate-900">
                {typeof value === 'number'
                  ? value.toLocaleString('en-IN')
                  : value}
              </p>
              <p className="mt-1 text-xs text-slate-400">{note}</p>
            </CardContent>
          </Card>
        ))}
      </section>

      <p className="mt-6 text-right text-xs text-slate-400">
        Last updated: {new Date(data!.generatedAt).toLocaleString('en-IN')}
      </p>
    </div>
  )
}