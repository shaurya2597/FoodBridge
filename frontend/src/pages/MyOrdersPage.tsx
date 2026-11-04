import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Clock, MapPin, Package, RefreshCw, ShoppingBag, XCircle } from 'lucide-react'
import { cancelOrder, getOrders, type CustomerOrder } from '@/services/orders'
import { Link } from 'react-router-dom'
type Tab = 'active' | 'past'

const statusStyles: Record<string, string> = {
  PLACED: 'bg-blue-100 text-blue-700',
  ACCEPTED: 'bg-indigo-100 text-indigo-700',
  PREPARING: 'bg-amber-100 text-amber-700',
  READY: 'bg-emerald-100 text-emerald-700',
  OUT_FOR_DELIVERY: 'bg-purple-100 text-purple-700',
  DELIVERED: 'bg-green-100 text-green-700',
  CANCELLED: 'bg-red-100 text-red-700',
}

function formatStatus(status: string) {
  return status.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase())
}

function formatDate(value: string) {
  return new Date(value).toLocaleString('en-IN', {
    dateStyle: 'medium',
    timeStyle: 'short',
  })
}

function OrderCard({
  order,
  onCancel,
  cancelling,
}: {
  order: CustomerOrder
  onCancel: (id: string) => void
  cancelling: boolean
}) {
  const canCancel = order.status === 'PLACED' || order.status === 'ACCEPTED'

  return (
    <article className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-gray-100 p-4 sm:p-5">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-gray-400">Order number</p>
          <h3 className="mt-1 font-bold text-gray-900"><Link
  to={`/customer/orders/${order.id}`}
  className="mt-1 inline-block font-bold text-gray-900 hover:text-emerald-700"
>
  {order.orderNumber}
</Link></h3>
          <p className="mt-1 flex items-center gap-1 text-sm text-gray-500">
            <Clock className="h-3.5 w-3.5" /> {formatDate(order.createdAt)}
          </p>
        </div>
        <span className={`rounded-full px-3 py-1.5 text-xs font-semibold ${statusStyles[order.status] ?? 'bg-gray-100 text-gray-700'}`}>
          {formatStatus(order.status)}
        </span>
      </div>

      <div className="space-y-4 p-4 sm:p-5">
        <div>
          <h4 className="font-semibold text-gray-900">{order.restaurant?.name ?? 'Restaurant'}</h4>
          <p className="mt-1 flex items-center gap-1 text-sm text-gray-500">
            <MapPin className="h-3.5 w-3.5" /> {order.restaurant?.city ?? 'Location unavailable'}
          </p>
        </div>

        <div className="space-y-2 rounded-xl bg-gray-50 p-3">
          {order.items.map((item) => (
            <div key={item.id} className="flex justify-between gap-3 text-sm">
              <span className="text-gray-700">{item.name} × {item.quantity}</span>
              <span className="font-medium text-gray-900">₹{Number(item.lineTotal).toFixed(2)}</span>
            </div>
          ))}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-gray-100 pt-3">
          <div>
            <p className="text-xs text-gray-500">Total amount</p>
            <p className="text-lg font-bold text-emerald-700">₹{Number(order.total).toFixed(2)}</p>
            {order.payment && (
              <p className="mt-1 text-xs text-gray-500">
                {order.payment.method} · Payment {formatStatus(order.payment.status)}
              </p>
            )}
          </div>
          {canCancel && (
            <button
              onClick={() => onCancel(order.id)}
              disabled={cancelling}
              className="flex items-center gap-2 rounded-lg border border-red-200 px-3 py-2 text-sm font-medium text-red-600 transition hover:bg-red-50 disabled:opacity-50"
            >
              <XCircle className="h-4 w-4" />
              Cancel order
            </button>
          )}
        </div>
      </div>
    </article>
  )
}

export function MyOrdersPage() {
  const [tab, setTab] = useState<Tab>('active')
  const [cancellingId, setCancellingId] = useState<string | null>(null)
  const [reason, setReason] = useState('')
  const [message, setMessage] = useState('')
  const queryClient = useQueryClient()

  const ordersQuery = useQuery({
    queryKey: ['customer-orders', tab],
    queryFn: ({ signal }) => getOrders({
      active: tab === 'active',
      page: 1,
      limit: 50,
    }, signal),
  })

  const cancelMutation = useMutation({
    mutationFn: (id: string) => cancelOrder(id, reason.trim() || undefined),
    onSuccess: async () => {
      setMessage('Order cancelled successfully.')
      setCancellingId(null)
      setReason('')
      await queryClient.invalidateQueries({ queryKey: ['customer-orders'] })
      await queryClient.invalidateQueries({ queryKey: ['orders'] })
    },
    onError: () => {
      setMessage('Could not cancel this order. Please refresh and try again.')
    },
  })

  const orders = ordersQuery.data?.data ?? []

  function openCancel(id: string) {
    setMessage('')
    setReason('')
    setCancellingId(id)
  }

  function confirmCancel() {
    if (!cancellingId) return
    if (reason.trim() && reason.trim().length < 3) {
      setMessage('Please enter at least 3 characters, or leave the reason empty.')
      return
    }
    cancelMutation.mutate(cancellingId)
  }

  return (
    <div className="space-y-6">
      <section className="rounded-2xl bg-gradient-to-r from-slate-900 to-emerald-800 p-6 text-white sm:p-8">
        <p className="text-sm font-semibold text-emerald-200">YOUR FOOD JOURNEY</p>
        <h1 className="mt-2 text-3xl font-bold">My Orders</h1>
        <p className="mt-2 text-sm text-slate-200">Track your current orders and revisit your past meals.</p>
      </section>

      <div className="flex gap-2 border-b border-gray-200">
        <button
          onClick={() => { setTab('active'); setMessage('') }}
          className={`border-b-2 px-4 py-3 text-sm font-semibold ${tab === 'active' ? 'border-emerald-600 text-emerald-700' : 'border-transparent text-gray-500'}`}
        >
          Active orders
        </button>
        <button
          onClick={() => { setTab('past'); setMessage('') }}
          className={`border-b-2 px-4 py-3 text-sm font-semibold ${tab === 'past' ? 'border-emerald-600 text-emerald-700' : 'border-transparent text-gray-500'}`}
        >
          Past orders
        </button>
      </div>

      {message && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
          {message}
        </div>
      )}

      {cancellingId && (
        <div className="space-y-3 rounded-xl border border-red-200 bg-red-50 p-4">
          <h3 className="font-semibold text-red-900">Cancel this order?</h3>
          <p className="text-sm text-red-800">This action cannot be undone. You can optionally provide a reason.</p>
          <textarea
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            placeholder="Reason for cancellation (optional)"
            rows={2}
            maxLength={200}
            className="w-full rounded-lg border border-red-200 bg-white p-3 text-sm outline-none focus:border-red-400"
          />
          <div className="flex gap-2">
            <button
              onClick={confirmCancel}
              disabled={cancelMutation.isPending}
              className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50"
            >
              {cancelMutation.isPending ? 'Cancelling...' : 'Confirm cancellation'}
            </button>
            <button
              onClick={() => { setCancellingId(null); setReason(''); setMessage('') }}
              disabled={cancelMutation.isPending}
              className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700"
            >
              Keep order
            </button>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-gray-900">
          {tab === 'active' ? 'Current orders' : 'Order history'}
        </h2>
        <button
          onClick={() => ordersQuery.refetch()}
          className="flex items-center gap-2 text-sm font-medium text-emerald-700 hover:text-emerald-800"
        >
          <RefreshCw className="h-4 w-4" /> Refresh
        </button>
      </div>

      {ordersQuery.isLoading && (
        <div className="flex items-center justify-center gap-2 py-16 text-gray-500">
          <RefreshCw className="h-5 w-5 animate-spin" /> Loading your orders...
        </div>
      )}

      {ordersQuery.isError && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-5 text-sm text-red-700">
          Could not load your orders.
          <button onClick={() => ordersQuery.refetch()} className="ml-2 font-semibold underline">Try again</button>
        </div>
      )}

      {!ordersQuery.isLoading && !ordersQuery.isError && orders.length === 0 && (
        <div className="rounded-2xl border border-dashed border-gray-300 py-16 text-center">
          {tab === 'active' ? (
            <Package className="mx-auto h-10 w-10 text-gray-400" />
          ) : (
            <ShoppingBag className="mx-auto h-10 w-10 text-gray-400" />
          )}
          <h3 className="mt-3 font-semibold text-gray-800">No {tab} orders yet</h3>
          <p className="mt-1 text-sm text-gray-500">Your orders will appear here when you place them.</p>
        </div>
      )}

      <div className="grid gap-4">
        {orders.map((order) => (
          <OrderCard
            key={order.id}
            order={order}
            onCancel={openCancel}
            cancelling={cancelMutation.isPending}
          />
        ))}
      </div>
    </div>
  )
}
