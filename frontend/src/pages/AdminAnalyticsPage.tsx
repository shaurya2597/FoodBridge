import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  Activity,
  HeartHandshake,
  Package,
  RefreshCw,
  TrendingUp,
  Users,
} from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { getAdminAnalytics } from '@/services/admin'

const money = (amount: number) =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(amount)

const statusLabel = (status: string) =>
  status.toLowerCase().split('_').map((part) => part[0].toUpperCase() + part.slice(1)).join(' ')

const dateLabel = (value: string) =>
  new Date(`${value}T00:00:00+05:30`).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
  })

export function AdminAnalyticsPage() {
  const [days, setDays] = useState(30)

  const analyticsQuery = useQuery({
    queryKey: ['admin', 'analytics', days],
    queryFn: ({ signal }) => getAdminAnalytics(days, signal),
    staleTime: 30_000,
  })

  const data = analyticsQuery.data

  const stats = [
    {
      label: 'Total orders',
      value: data?.totals.orders ?? 0,
      note: `In the last ${days} days`,
      icon: Package,
    },
    {
      label: 'Revenue',
      value: money(data?.totals.revenue ?? 0),
      note: 'Recorded order revenue',
      icon: TrendingUp,
    },
    {
      label: 'Active users',
      value: data?.activeUsers.count ?? 0,
      note: `Active in ${days}-day window`,
      icon: Users,
    },
    {
      label: 'Servings saved',
      value: data?.donations.servingsSavedInRange ?? 0,
      note: `${data?.donations.servingsSavedAllTime ?? 0} saved all time`,
      icon: HeartHandshake,
    },
  ]

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="flex items-center gap-2 text-sm font-medium text-violet-700">
            <Activity size={16} /> Administration
          </div>
          <h1 className="mt-2 text-2xl font-bold text-slate-900">Analytics</h1>
          <p className="mt-1 text-sm text-slate-500">
            Monitor platform performance, orders, revenue and food donations.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <label htmlFor="analytics-days" className="text-sm text-slate-600">
            Date range
          </label>
          <select
            id="analytics-days"
            value={days}
            onChange={(event) => setDays(Number(event.target.value))}
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
          >
            <option value={7}>Last 7 days</option>
            <option value={30}>Last 30 days</option>
            <option value={90}>Last 90 days</option>
          </select>
          <button
            type="button"
            onClick={() => void analyticsQuery.refetch()}
            disabled={analyticsQuery.isFetching}
            aria-label="Refresh analytics"
            className="rounded-xl border border-slate-200 p-2 text-slate-600 hover:bg-slate-50 disabled:opacity-50"
          >
            <RefreshCw size={16} className={analyticsQuery.isFetching ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {analyticsQuery.isError && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          Could not load analytics. Please refresh and try again.
        </div>
      )}

      {analyticsQuery.isLoading ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center text-sm text-slate-500">
          Loading platform analytics...
        </div>
      ) : data ? (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {stats.map((stat) => {
              const Icon = stat.icon
              return (
                <Card key={stat.label} className="rounded-2xl border-slate-200 shadow-sm">
                  <CardContent className="flex items-start justify-between p-5">
                    <div>
                      <p className="text-sm text-slate-500">{stat.label}</p>
                      <p className="mt-2 text-2xl font-bold text-slate-900">{stat.value}</p>
                      <p className="mt-1 text-xs text-slate-500">{stat.note}</p>
                    </div>
                    <div className="rounded-xl bg-violet-50 p-3 text-violet-700">
                      <Icon size={20} />
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>

          <div className="grid gap-4 xl:grid-cols-2">
            <section className="rounded-2xl border border-slate-200 bg-white p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="font-semibold text-slate-900">Orders over time</h2>
                  <p className="mt-1 text-xs text-slate-500">Daily order volume and cancellations</p>
                </div>
                <Package className="text-violet-600" size={20} />
              </div>
              {data.ordersOverTime.length === 0 ? (
                <p className="py-10 text-center text-sm text-slate-500">No order data in this period.</p>
              ) : (
                <>
                  <div className="mt-6 flex h-48 items-end gap-1 border-b border-slate-100 pb-1">
                    {data.ordersOverTime.map((item) => {
                      const maximum = Math.max(1, ...data.ordersOverTime.map((entry) => entry.orders))
                      const height = item.orders === 0 ? 2 : Math.max(5, (item.orders / maximum) * 100)
                      return (
                        <div key={item.date} className="group relative flex h-full min-w-0 flex-1 flex-col justify-end" title={`${dateLabel(item.date)}: ${item.orders} orders, ${item.cancelled} cancelled`}>
                          <div className="flex w-full flex-col justify-end overflow-hidden rounded-t-sm" style={{ height: `${height}%` }}>
                            {item.cancelled > 0 && (
                              <div className="w-full bg-rose-400" style={{ height: `${Math.min(100, (item.cancelled / Math.max(1, item.orders)) * 100)}%` }} />
                            )}
                            <div className="min-h-0 flex-1 bg-violet-500" />
                          </div>
                          {days <= 7 && (
                            <span className="mt-2 text-center text-[10px] text-slate-400">{dateLabel(item.date)}</span>
                          )}
                          <span className="pointer-events-none absolute -top-8 left-1/2 z-10 hidden -translate-x-1/2 whitespace-nowrap rounded-lg bg-slate-900 px-2 py-1 text-[10px] text-white group-hover:block">
                            {item.orders} orders
                          </span>
                        </div>
                      )
                    })}
                  </div>
                  <div className="mt-3 flex flex-wrap gap-4 text-xs text-slate-500">
                    <span className="flex items-center gap-1.5"><span className="size-2 rounded-sm bg-violet-500" /> Orders</span>
                    <span className="flex items-center gap-1.5"><span className="size-2 rounded-sm bg-rose-400" /> Cancelled</span>
                  </div>
                </>
              )}
            </section>

            <section className="rounded-2xl border border-slate-200 bg-white p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="font-semibold text-slate-900">Revenue trend</h2>
                  <p className="mt-1 text-xs text-slate-500">Daily revenue from paid orders</p>
                </div>
                <TrendingUp className="text-emerald-600" size={20} />
              </div>
              {data.revenueTrend.length === 0 ? (
                <p className="py-10 text-center text-sm text-slate-500">No revenue data in this period.</p>
              ) : (
                <>
                  <div className="mt-6 flex h-48 items-end gap-1 border-b border-slate-100 pb-1">
                    {data.revenueTrend.map((item) => {
                      const maximum = Math.max(1, ...data.revenueTrend.map((entry) => entry.revenue))
                      const height = item.revenue === 0 ? 2 : Math.max(5, (item.revenue / maximum) * 100)
                      return (
                        <div key={item.date} className="group relative flex h-full min-w-0 flex-1 flex-col justify-end" title={`${dateLabel(item.date)}: ${money(item.revenue)}`}>
                          <div className="w-full rounded-t-sm bg-emerald-500" style={{ height: `${height}%` }} />
                          {days <= 7 && (
                            <span className="mt-2 text-center text-[10px] text-slate-400">{dateLabel(item.date)}</span>
                          )}
                          <span className="pointer-events-none absolute -top-8 left-1/2 z-10 hidden -translate-x-1/2 whitespace-nowrap rounded-lg bg-slate-900 px-2 py-1 text-[10px] text-white group-hover:block">
                            {money(item.revenue)}
                          </span>
                        </div>
                      )
                    })}
                  </div>
                  <p className="mt-3 text-xs text-slate-500">Total revenue: <strong className="text-slate-700">{money(data.totals.revenue)}</strong></p>
                </>
              )}
            </section>
          </div>

          <div className="grid gap-4 xl:grid-cols-2">
            <section className="rounded-2xl border border-slate-200 bg-white p-5">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="font-semibold text-slate-900">Popular restaurants</h2>
                  <p className="mt-1 text-xs text-slate-500">Ranked by order volume</p>
                </div>
                <Users className="text-violet-600" size={20} />
              </div>
              {data.popularRestaurants.length === 0 ? (
                <p className="py-8 text-center text-sm text-slate-500">No restaurant orders in this period.</p>
              ) : (
                <div className="mt-5 space-y-4">
                  {data.popularRestaurants.slice(0, 5).map((restaurant, index) => {
                    const maximum = Math.max(1, ...data.popularRestaurants.map((item) => item.orders))
                    return (
                      <div key={restaurant.restaurantId}>
                        <div className="mb-1.5 flex items-center justify-between gap-3 text-sm">
                          <span className="min-w-0 truncate font-medium text-slate-700">
                            <span className="mr-2 text-slate-400">{index + 1}.</span>{restaurant.name}
                          </span>
                          <span className="shrink-0 text-slate-500">{restaurant.orders} orders</span>
                        </div>
                        <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                          <div className="h-full rounded-full bg-violet-500" style={{ width: `${(restaurant.orders / maximum) * 100}%` }} />
                        </div>
                        <p className="mt-1 text-right text-xs text-slate-500">{money(restaurant.revenue)} revenue</p>
                      </div>
                    )
                  })}
                </div>
              )}
            </section>

            <section className="rounded-2xl border border-slate-200 bg-white p-5">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="font-semibold text-slate-900">Top-selling food items</h2>
                  <p className="mt-1 text-xs text-slate-500">Ranked by quantity sold</p>
                </div>
                <Package className="text-emerald-600" size={20} />
              </div>
              {data.topFoodItems.length === 0 ? (
                <p className="py-8 text-center text-sm text-slate-500">No food items sold in this period.</p>
              ) : (
                <div className="mt-5 space-y-4">
                  {data.topFoodItems.slice(0, 10).map((item, index) => {
                    const maximum = Math.max(1, ...data.topFoodItems.map((entry) => entry.quantitySold))
                    return (
                      <div key={item.foodItemId}>
                        <div className="mb-1.5 flex items-center justify-between gap-3 text-sm">
                          <div className="min-w-0">
                            <p className="truncate font-medium text-slate-700">
                              <span className="mr-2 text-slate-400">{index + 1}.</span>{item.name}
                            </p>
                            {item.restaurant && <p className="truncate text-xs text-slate-400">{item.restaurant}</p>}
                          </div>
                          <span className="shrink-0 text-slate-500">{item.quantitySold} sold</span>
                        </div>
                        <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                          <div className="h-full rounded-full bg-emerald-500" style={{ width: `${(item.quantitySold / maximum) * 100}%` }} />
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </section>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5">
          <div className="grid gap-4 xl:grid-cols-2">
            <section className="rounded-2xl border border-slate-200 bg-white p-5">
              <h2 className="font-semibold text-slate-900">Donation activity</h2>
              <p className="mt-1 text-xs text-slate-500">Daily donations and servings posted</p>
              {data.donations.overTime.length === 0 ? (
                <p className="py-8 text-center text-sm text-slate-500">No donation activity in this period.</p>
              ) : (
                <div className="mt-6 flex h-48 items-end gap-1 border-b border-slate-100 pb-1">
                  {data.donations.overTime.map((item) => {
                    const maximum = Math.max(1, ...data.donations.overTime.map((entry) => entry.donations))
                    const height = item.donations === 0 ? 2 : Math.max(5, (item.donations / maximum) * 100)
                    return (
                      <div key={item.date} className="group relative flex h-full min-w-0 flex-1 flex-col justify-end" title={`${dateLabel(item.date)}: ${item.donations} donations, ${item.servingsPosted} servings`}>
                        <div className="w-full rounded-t-sm bg-rose-500" style={{ height: `${height}%` }} />
                        {days <= 7 && <span className="mt-2 text-center text-[10px] text-slate-400">{dateLabel(item.date)}</span>}
                        <span className="pointer-events-none absolute -top-8 left-1/2 z-10 hidden -translate-x-1/2 whitespace-nowrap rounded-lg bg-slate-900 px-2 py-1 text-[10px] text-white group-hover:block">
                          {item.donations} donations · {item.servingsPosted} servings
                        </span>
                      </div>
                    )
                  })}
                </div>
              )}
              <p className="mt-3 text-xs text-slate-500">Servings saved: <strong className="text-slate-700">{data.donations.servingsSavedInRange.toLocaleString('en-IN')}</strong></p>
            </section>

            <section className="rounded-2xl border border-slate-200 bg-white p-5">
              <h2 className="font-semibold text-slate-900">Donation status breakdown</h2>
              <p className="mt-1 text-xs text-slate-500">Donations grouped by current status</p>
              {Object.entries(data.donations.byStatus).length === 0 ? (
                <p className="py-8 text-center text-sm text-slate-500">No donations recorded.</p>
              ) : (
                <div className="mt-5 space-y-3">
                  {Object.entries(data.donations.byStatus).map(([status, count]) => {
                    const maximum = Math.max(1, ...Object.values(data.donations.byStatus))
                    return (
                      <div key={status}>
                        <div className="mb-1 flex items-center justify-between text-sm">
                          <span className="font-medium text-slate-700">{statusLabel(status)}</span>
                          <span className="text-slate-500">{count}</span>
                        </div>
                        <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                          <div className="h-full rounded-full bg-rose-500" style={{ width: `${(count / maximum) * 100}%` }} />
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </section>
          </div>

          <section className="rounded-2xl border border-slate-200 bg-white p-5">
            <h2 className="font-semibold text-slate-900">Food assistance request statuses</h2>
            <p className="mt-1 text-xs text-slate-500">Current distribution of community assistance requests</p>
            {Object.entries(data.assistance.byStatus).length === 0 ? (
              <p className="py-8 text-center text-sm text-slate-500">No assistance requests recorded.</p>
            ) : (
              <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {Object.entries(data.assistance.byStatus).map(([status, count]) => (
                  <div key={status} className="rounded-xl bg-slate-50 p-4">
                    <p className="text-sm text-slate-500">{statusLabel(status)}</p>
                    <p className="mt-1 text-2xl font-semibold tabular-nums text-slate-900">{count}</p>
                  </div>
                ))}
              </div>
            )}
          </section>
            <h2 className="font-semibold text-slate-900">Analytics period</h2>
            <p className="mt-1 text-sm text-slate-500">
              {dateLabel(data.range.from.slice(0, 10))} – {dateLabel(data.range.to.slice(0, 10))}
              {' '}({data.range.timezone})
            </p>
          </div>
        </>
      ) : null}
    </div>
  )
}
