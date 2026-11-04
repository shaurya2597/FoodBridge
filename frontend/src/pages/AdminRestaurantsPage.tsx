import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { CheckCircle, RefreshCw, Search, Store, XCircle } from 'lucide-react'
import {
  getAdminRestaurants,
  setAdminRestaurantStatus,
  type AdminRestaurant,
} from '@/services/admin'

type StatusFilter = 'ALL' | AdminRestaurant['status']

const statusStyles: Record<AdminRestaurant['status'], string> = {
  PENDING: 'bg-amber-100 text-amber-800',
  APPROVED: 'bg-green-100 text-green-800',
  REJECTED: 'bg-red-100 text-red-800',
  SUSPENDED: 'bg-slate-200 text-slate-700',
}

export function AdminRestaurantsPage() {
  const queryClient = useQueryClient()
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState<StatusFilter>('ALL')
  const [page, setPage] = useState(1)

  const restaurantsQuery = useQuery({
    queryKey: ['admin', 'restaurants', search, status, page],
    queryFn: ({ signal }) =>
      getAdminRestaurants({
        q: search.trim() || undefined,
        status: status === 'ALL' ? undefined : status,
        page,
        limit: 10,
      }, signal),
  })

  const statusMutation = useMutation({
    mutationFn: ({
      id,
      nextStatus,
      reason,
    }: {
      id: string
      nextStatus: 'APPROVED' | 'REJECTED' | 'SUSPENDED'
      reason?: string
    }) => setAdminRestaurantStatus(id, nextStatus, reason),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['admin', 'restaurants'] })
      await queryClient.invalidateQueries({ queryKey: ['admin', 'dashboard'] })
    },
  })

  const restaurants = restaurantsQuery.data?.data ?? []
  const meta = restaurantsQuery.data?.meta

  function moderateRestaurant(
    restaurant: AdminRestaurant,
    nextStatus: 'APPROVED' | 'REJECTED' | 'SUSPENDED',
  ) {
    const action = nextStatus.toLowerCase()
    const reason =
      nextStatus === 'APPROVED'
        ? undefined
        : window.prompt(`Enter a reason to ${action} "${restaurant.name}":`)?.trim()

    if (nextStatus !== 'APPROVED' && (!reason || reason.length < 3)) {
      window.alert('Please enter a reason of at least 3 characters.')
      return
    }

    if (!window.confirm(`Are you sure you want to ${action} ${restaurant.name}?`)) {
      return
    }

    statusMutation.mutate({ id: restaurant.id, nextStatus, reason })
  }

  if (restaurantsQuery.isLoading) {
    return <div className="p-8 text-center text-sm text-slate-500">Loading restaurants...</div>
  }

  if (restaurantsQuery.isError) {
    return (
      <div className="m-6 rounded-2xl border border-red-200 bg-red-50 p-5 text-sm text-red-700">
        Could not load restaurants. Please refresh and try again.
        <button
          onClick={() => restaurantsQuery.refetch()}
          className="ml-3 inline-flex items-center gap-2 font-semibold underline"
        >
          <RefreshCw size={14} /> Retry
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-6 p-4 sm:p-6 lg:p-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-slate-500">Administration</p>
          <h1 className="mt-1 text-2xl font-bold text-slate-900">Restaurants</h1>
          <p className="mt-1 text-sm text-slate-500">
            Review restaurant applications and manage approval status.
          </p>
        </div>
        <div className="rounded-xl bg-white px-4 py-3 shadow-sm ring-1 ring-slate-200">
          <p className="text-xs text-slate-500">Total restaurants</p>
          <p className="text-xl font-bold text-slate-900">{meta?.total ?? 0}</p>
        </div>
      </div>

      <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <input
            value={search}
            onChange={(event) => {
              setSearch(event.target.value)
              setPage(1)
            }}
            placeholder="Search restaurant or owner email..."
            className="w-full rounded-xl border border-slate-200 py-2.5 pl-10 pr-3 text-sm outline-none focus:border-orange-400"
          />
        </div>
        <select
          value={status}
          onChange={(event) => {
            setStatus(event.target.value as StatusFilter)
            setPage(1)
          }}
          className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-orange-400"
        >
          <option value="ALL">All statuses</option>
          <option value="PENDING">Pending</option>
          <option value="APPROVED">Approved</option>
          <option value="REJECTED">Rejected</option>
          <option value="SUSPENDED">Suspended</option>
        </select>
      </div>

      {statusMutation.isError && (
        <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700">
          Could not update restaurant status. Please refresh and try again.
        </p>
      )}

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
        {restaurants.length === 0 ? (
          <div className="p-10 text-center">
            <Store className="mx-auto text-slate-300" size={32} />
            <p className="mt-3 font-semibold text-slate-700">No restaurants found</p>
            <p className="mt-1 text-sm text-slate-500">Try changing your search or status filter.</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {restaurants.map((restaurant) => (
              <article key={restaurant.id} className="p-4 sm:p-5">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                  <div className="flex min-w-0 gap-3">
                    <img
                      src={restaurant.imageUrl}
                      alt=""
                      className="h-16 w-16 shrink-0 rounded-xl bg-slate-100 object-cover"
                    />
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="font-semibold text-slate-900">{restaurant.name}</h2>
                        <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${statusStyles[restaurant.status]}`}>
                          {restaurant.status}
                        </span>
                      </div>
                      <p className="mt-1 text-sm text-slate-500">
                        {restaurant.city} · {restaurant.cuisines.join(', ')}
                      </p>
                      <p className="mt-1 text-sm text-slate-600">
                        Owner: {restaurant.owner.name} · {restaurant.owner.email}
                      </p>
                      <p className="mt-1 text-xs text-slate-500">
                        {restaurant._count.foods} menu items · {restaurant._count.orders} orders
                      </p>
                      {restaurant.moderationNote && (
                        <p className="mt-2 text-xs text-red-700">
                          Moderation note: {restaurant.moderationNote}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2 lg:justify-end">
                    {restaurant.status !== 'APPROVED' && (
                      <button
                        disabled={statusMutation.isPending}
                        onClick={() => moderateRestaurant(restaurant, 'APPROVED')}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-green-600 px-3 py-2 text-xs font-semibold text-white hover:bg-green-700 disabled:opacity-50"
                      >
                        <CheckCircle size={14} /> Approve
                      </button>
                    )}
                    {restaurant.status !== 'REJECTED' && (
                      <button
                        disabled={statusMutation.isPending}
                        onClick={() => moderateRestaurant(restaurant, 'REJECTED')}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-red-600 px-3 py-2 text-xs font-semibold text-white hover:bg-red-700 disabled:opacity-50"
                      >
                        <XCircle size={14} /> Reject
                      </button>
                    )}
                    {restaurant.status !== 'SUSPENDED' && restaurant.status === 'APPROVED' && (
                      <button
                        disabled={statusMutation.isPending}
                        onClick={() => moderateRestaurant(restaurant, 'SUSPENDED')}
                        className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                      >
                        Suspend
                      </button>
                    )}
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>

      <div className="flex items-center justify-between gap-3 text-sm">
        <p className="text-slate-500">
          Page {meta?.page ?? page} of {meta?.totalPages ?? 1} · {meta?.total ?? 0} restaurants
        </p>
        <div className="flex gap-2">
          <button
            disabled={page <= 1}
            onClick={() => setPage((current) => current - 1)}
            className="rounded-lg border border-slate-200 px-3 py-2 font-medium disabled:opacity-40"
          >
            Previous
          </button>
          <button
            disabled={!meta || page >= meta.totalPages}
            onClick={() => setPage((current) => current + 1)}
            className="rounded-lg border border-slate-200 px-3 py-2 font-medium disabled:opacity-40"
          >
            Next
          </button>
        </div>
      </div>
    </div>
  )
}
