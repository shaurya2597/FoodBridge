import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import {
  ArrowRight,
  ShoppingBag,
  Clock3,
  PackageCheck,
  XCircle,
  HeartHandshake,
  Leaf,
  Utensils,
  ClipboardList,
  RefreshCw,
} from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { userMessage } from '@/services/apiError'
import { getOrders } from '@/services/orders'
import { getAvailableDonations } from '@/services/donations'
import { getAssistanceRequests } from '@/services/assistance'

const formatNumber = (value: number) => value.toLocaleString('en-IN')

const formatDate = (value: string) =>
  new Date(value).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })

const formatStatus = (status: string) =>
  status.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, (char) => char.toUpperCase())

export function CustomerDashboard() {
  const ordersQuery = useQuery({
    queryKey: ['customer', 'dashboard', 'orders'],
    queryFn: ({ signal }) => getOrders({ page: 1, limit: 5 }, signal),
    staleTime: 30_000,
  })

  const activeOrdersQuery = useQuery({
    queryKey: ['customer', 'dashboard', 'active-orders'],
    queryFn: ({ signal }) => getOrders({ active: true, page: 1, limit: 1 }, signal),
    staleTime: 30_000,
  })

  const deliveredOrdersQuery = useQuery({
    queryKey: ['customer', 'dashboard', 'delivered-orders'],
    queryFn: ({ signal }) => getOrders({ status: 'DELIVERED', page: 1, limit: 1 }, signal),
    staleTime: 30_000,
  })

  const cancelledOrdersQuery = useQuery({
    queryKey: ['customer', 'dashboard', 'cancelled-orders'],
    queryFn: ({ signal }) => getOrders({ status: 'CANCELLED', page: 1, limit: 1 }, signal),
    staleTime: 30_000,
  })

  const donationsQuery = useQuery({
    queryKey: ['customer', 'dashboard', 'donations'],
    queryFn: ({ signal }) => getAvailableDonations({ mine: true, page: 1, limit: 1 }, signal),
    staleTime: 30_000,
  })

  const completedDonationsQuery = useQuery({
    queryKey: ['customer', 'dashboard', 'completed-donations'],
    queryFn: ({ signal }) => getAvailableDonations({ mine: true, status: 'DISTRIBUTED', page: 1, limit: 1 }, signal),
    staleTime: 30_000,
  })

  const assistanceQuery = useQuery({
    queryKey: ['customer', 'dashboard', 'assistance'],
    queryFn: ({ signal }) => getAssistanceRequests({ mine: true, page: 1, limit: 1 }, signal),
    staleTime: 30_000,
  })

  const orders = ordersQuery.data?.data ?? []
  const totalOrders = ordersQuery.data?.meta.total ?? 0
  const activeOrders = activeOrdersQuery.data?.meta.total ?? 0
  const deliveredOrders = deliveredOrdersQuery.data?.meta.total ?? 0
  const cancelledOrders = cancelledOrdersQuery.data?.meta.total ?? 0
  const totalDonations = donationsQuery.data?.meta.total ?? 0
  const completedDonations = completedDonationsQuery.data?.meta.total ?? 0
  const totalAssistance = assistanceQuery.data?.meta.total ?? 0

  const queries = [
    ordersQuery,
    activeOrdersQuery,
    deliveredOrdersQuery,
    cancelledOrdersQuery,
    donationsQuery,
    completedDonationsQuery,
    assistanceQuery,
  ]

  const isLoading = queries.some((query) => query.isPending)
  const failedQueries = queries.filter((query) => query.isError)

  const stats = [
    {
      label: 'Total orders',
      value: totalOrders,
      note: 'Orders placed with restaurants',
      icon: ShoppingBag,
    },
    {
      label: 'Active orders',
      value: activeOrders,
      note: 'Currently being processed',
      icon: Clock3,
    },
    {
      label: 'Delivered orders',
      value: deliveredOrders,
      note: 'Successfully completed',
      icon: PackageCheck,
    },
    {
      label: 'Cancelled orders',
      value: cancelledOrders,
      note: 'Cancelled orders',
      icon: XCircle,
    },
    {
      label: 'Food donations',
      value: totalDonations,
      note: 'Donations you have shared',
      icon: HeartHandshake,
    },
    {
      label: 'Distributed donations',
      value: completedDonations,
      note: 'Donations reaching communities',
      icon: Leaf,
    },
    {
      label: 'Assistance requests',
      value: totalAssistance,
      note: 'Food help requests submitted',
      icon: ClipboardList,
    },
  ]

  return (
    <div className="space-y-8">
      <section className="rounded-[24px] bg-[#123f32] px-6 py-8 text-white shadow-lg sm:px-9">
        <p className="text-xs font-semibold uppercase tracking-[.16em] text-emerald-200">
          Your FoodBridge activity
        </p>
        <h2 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">
          Your food journey, all in one place.
        </h2>
        <p className="mt-3 max-w-2xl text-sm leading-7 text-emerald-50/80">
          Track your orders, share surplus food and follow your food assistance requests.
          Every action helps build a more thoughtful food community.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link
            to="/customer/explore"
            className="inline-flex h-10 items-center rounded-full bg-[#f4a64f] px-5 text-sm font-semibold text-[#39220a] hover:bg-[#ffc071]"
          >
            Explore food <ArrowRight className="ml-2" size={15} />
          </Link>
          <Link
            to="/customer/donate"
            className="inline-flex h-10 items-center rounded-full border border-white/25 px-5 text-sm font-semibold text-white hover:bg-white/10"
          >
            Donate food
          </Link>
        </div>
      </section>

      {isLoading && (
        <p className="text-sm text-slate-500" role="status">
          Loading your dashboard statistics...
        </p>
      )}

      {failedQueries.length > 0 && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4" role="alert">
          <p className="text-sm font-semibold text-red-800">
            Some dashboard information could not be loaded.
          </p>
          <p className="mt-1 text-xs text-red-700">
            {userMessage(failedQueries[0].error)}
          </p>
          <button
            type="button"
            onClick={() => queries.forEach((query) => {
              if (query.isError) void query.refetch()
            })}
            className="mt-3 inline-flex items-center gap-2 rounded-lg bg-red-100 px-3 py-2 text-xs font-semibold text-red-800 hover:bg-red-200"
          >
            <RefreshCw size={13} /> Retry failed requests
          </button>
        </div>
      )}

      <section>
        <div className="mb-4">
          <p className="text-xs font-semibold uppercase tracking-[.15em] text-emerald-700">
            Your activity
          </p>
          <h3 className="mt-1 text-xl font-bold text-slate-900">Dashboard overview</h3>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {stats.map(({ label, value, note, icon: Icon }, index) => (
            <Card key={label} className="rounded-2xl border-slate-200/80 bg-white shadow-sm">
              <CardContent className="p-5">
                <span className={`grid size-10 place-items-center rounded-xl ${
                  index % 2 === 0
                    ? 'bg-emerald-50 text-emerald-700'
                    : 'bg-orange-50 text-orange-700'
                }`}>
                  <Icon size={19} />
                </span>
                <p className="mt-4 text-xs font-medium text-slate-500">{label}</p>
                <p className="mt-1 text-2xl font-bold text-slate-900">
                  {formatNumber(value)}
                </p>
                <p className="mt-1 text-xs text-slate-400">{note}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <section>
        <div className="mb-4 flex items-end justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[.15em] text-emerald-700">
              Your recent activity
            </p>
            <h3 className="mt-1 text-xl font-bold text-slate-900">Recent orders</h3>
          </div>
          <Link
            to="/customer/orders"
            className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 hover:text-emerald-900"
          >
            View all <ArrowRight size={14} />
          </Link>
        </div>

        <Card className="rounded-2xl border-slate-200/80 bg-white shadow-sm">
          <CardContent className="p-0">
            {orders.length === 0 && !ordersQuery.isPending ? (
              <div className="px-5 py-10 text-center">
                <ShoppingBag className="mx-auto text-slate-300" size={30} />
                <p className="mt-3 text-sm font-semibold text-slate-700">No orders yet</p>
                <p className="mt-1 text-xs text-slate-500">
                  Your restaurant orders will appear here.
                </p>
                <Link
                  to="/customer/explore"
                  className="mt-4 inline-flex items-center gap-1 text-xs font-semibold text-emerald-700"
                >
                  Explore restaurants <ArrowRight size={14} />
                </Link>
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {orders.map((order) => (
                  <div key={order.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
                    <div className="flex min-w-0 items-center gap-3">
                      <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-emerald-50 text-emerald-700">
                        <Utensils size={18} />
                      </span>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-slate-800">
                          {order.restaurant.name}
                        </p>
                        <p className="mt-1 text-xs text-slate-500">
                          #{order.orderNumber} · {formatDate(order.createdAt)}
                        </p>
                        <p className="mt-1 truncate text-xs text-slate-400">
                          {order.items.map((item) => `${item.name} × ${item.quantity}`).join(', ')}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold text-slate-900">
                        ₹{formatNumber(order.total)}
                      </p>
                      <span className="mt-1 inline-block rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-semibold text-emerald-800">
                        {formatStatus(order.status)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </section>

      <section>
        <div className="mb-4">
          <p className="text-xs font-semibold uppercase tracking-[.15em] text-emerald-700">
            Make the most of FoodBridge
          </p>
          <h3 className="mt-1 text-xl font-bold text-slate-900">Your shortcuts</h3>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {[
            { label: 'Explore food', note: 'Find restaurants and meals', to: '/customer/explore', icon: Utensils },
            { label: 'My orders', note: 'Track your restaurant orders', to: '/customer/orders', icon: ShoppingBag },
            { label: 'Donate food', note: 'Share surplus food', to: '/customer/donate', icon: HeartHandshake },
            { label: 'Request food help', note: 'Submit a food assistance request', to: '/customer/assistance', icon: Leaf },
          ].map(({ label, note, to, icon: Icon }) => (
            <Link
              key={to}
              to={to}
              className="group flex items-center justify-between rounded-2xl border border-slate-200 bg-white p-4 transition hover:-translate-y-0.5 hover:border-emerald-300 hover:shadow-md"
            >
              <span className="flex items-center gap-3">
                <span className="grid size-10 place-items-center rounded-xl bg-emerald-50 text-emerald-700">
                  <Icon size={18} />
                </span>
                <span>
                  <span className="block text-sm font-semibold text-slate-800">{label}</span>
                  <span className="mt-1 block text-[11px] text-slate-400">{note}</span>
                </span>
              </span>
              <ArrowRight size={15} className="text-slate-300 transition group-hover:text-emerald-700" />
            </Link>
          ))}
        </div>
      </section>
    </div>
  )
}
