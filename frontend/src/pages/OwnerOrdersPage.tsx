import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Clock, Loader2, Package, RefreshCw, Truck, CheckCircle2, XCircle } from 'lucide-react'
import { getOrders, updateOrderStatus, type CustomerOrder } from '@/services/orders'

const nextAction: Record<string, { status: string; label: string }> = {
  PLACED: { status: 'ACCEPTED', label: 'Accept order' },
  ACCEPTED: { status: 'PREPARING', label: 'Start preparing' },
  PREPARING: { status: 'READY', label: 'Mark ready' },
  READY: { status: 'OUT_FOR_DELIVERY', label: 'Out for delivery' },
  OUT_FOR_DELIVERY: { status: 'DELIVERED', label: 'Mark delivered' },
}

const statusStyles: Record<string, string> = {
  PLACED: 'bg-blue-100 text-blue-800',
  ACCEPTED: 'bg-indigo-100 text-indigo-800',
  PREPARING: 'bg-amber-100 text-amber-800',
  READY: 'bg-emerald-100 text-emerald-800',
  OUT_FOR_DELIVERY: 'bg-purple-100 text-purple-800',
  DELIVERED: 'bg-green-100 text-green-800',
  CANCELLED: 'bg-red-100 text-red-800',
}

function money(value: number) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(value)
}

function OrderCard({ order, onUpdate, busy }: {
  order: CustomerOrder
  onUpdate: (status: string, reason?: string) => void
  busy: boolean
}) {
  const action = nextAction[order.status]
  const paymentConfirmed = order.payment?.status === 'PAID' || order.payment?.method === 'COD'

  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-bold text-slate-900">Order #{order.orderNumber}</p>
          <p className="mt-1 text-xs text-slate-500">
            {new Date(order.createdAt).toLocaleString('en-IN')}
          </p>
        </div>
        <span className={`rounded-full px-3 py-1 text-xs font-semibold ${statusStyles[order.status] ?? 'bg-slate-100 text-slate-700'}`}>
          {order.status.replace(/_/g, ' ')}
        </span>
      </div>

      <div className="mt-4 space-y-2 border-t border-slate-100 pt-4">
        {order.items.map((item) => (
          <div key={item.id} className="flex justify-between gap-3 text-sm">
            <span className="text-slate-700">{item.quantity} × {item.name}</span>
            <span className="font-medium text-slate-900">{money(item.lineTotal)}</span>
          </div>
        ))}
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4">
        <div>
          <p className="text-lg font-extrabold text-slate-900">{money(order.total)}</p>
          <p className="text-xs text-slate-500">
            {order.payment?.method ?? 'Payment'} · {order.payment?.status ?? 'Status unavailable'}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {action && (
            <button
              type="button"
              disabled={busy || (order.status === 'PLACED' && !paymentConfirmed)}
              onClick={() => onUpdate(action.status)}
              className="inline-flex items-center gap-2 rounded-xl bg-emerald-700 px-4 py-2.5 text-xs font-semibold text-white hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {busy ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
              {action.label}
            </button>
          )}
          {['PLACED', 'ACCEPTED', 'PREPARING', 'READY'].includes(order.status) && (
            <button
              type="button"
              disabled={busy}
              onClick={() => onUpdate('CANCELLED', 'Cancelled by restaurant')}
              className="inline-flex items-center gap-2 rounded-xl border border-red-200 px-3 py-2.5 text-xs font-semibold text-red-700 hover:bg-red-50 disabled:opacity-50"
            >
              <XCircle size={14} /> Cancel
            </button>
          )}
        </div>
      </div>
      {order.status === 'PLACED' && !paymentConfirmed && (
        <p className="mt-3 text-xs text-amber-700">Payment must be confirmed before accepting this order.</p>
      )}
    </article>
  )
}

export function OwnerOrdersPage() {
  const queryClient = useQueryClient()
  const ordersQuery = useQuery({
    queryKey: ['owner-orders'],
    queryFn: ({ signal }) => getOrders({ active: true, limit: 50 }, signal),
  })

  const mutation = useMutation({
    mutationFn: ({ orderId, status, reason }: { orderId: string; status: string; reason?: string }) =>
      updateOrderStatus(orderId, status, reason),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['owner-orders'] })
      void queryClient.invalidateQueries({ queryKey: ['customer-orders'] })
    },
  })

  const orders = ordersQuery.data?.data ?? []

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-emerald-700">Restaurant workspace</p>
          <h1 className="mt-1 text-2xl font-extrabold tracking-tight text-slate-900">Manage orders</h1>
          <p className="mt-1 text-sm text-slate-500">Review incoming orders and update their progress.</p>
        </div>
        <button
          type="button"
          onClick={() => void ordersQuery.refetch()}
          disabled={ordersQuery.isFetching}
          className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
        >
          <RefreshCw size={15} className={ordersQuery.isFetching ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>

      {mutation.isError && (
        <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {mutation.error instanceof Error ? mutation.error.message : 'Could not update the order. Please try again.'}
        </div>
      )}

      {ordersQuery.isLoading ? (
        <div className="flex items-center justify-center gap-2 rounded-2xl bg-white p-12 text-sm text-slate-500">
          <Loader2 size={18} className="animate-spin" /> Loading orders...
        </div>
      ) : ordersQuery.isError ? (
        <div className="rounded-2xl border border-red-200 bg-white p-8 text-center">
          <p className="font-semibold text-red-700">Could not load orders</p>
          <p className="mt-1 text-sm text-slate-500">Check your connection and try again.</p>
          <button type="button" onClick={() => void ordersQuery.refetch()} className="mt-4 rounded-xl bg-emerald-700 px-4 py-2 text-sm font-semibold text-white">
            Try again
          </button>
        </div>
      ) : orders.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-12 text-center">
          <Package size={34} className="mx-auto text-slate-400" />
          <h2 className="mt-3 font-bold text-slate-900">No active orders</h2>
          <p className="mt-1 text-sm text-slate-500">New customer orders will appear here.</p>
        </div>
      ) : (
        <>
          <div className="flex flex-wrap gap-3 text-sm text-slate-600">
            <span className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-2">
              <Package size={15} /> {orders.length} active {orders.length === 1 ? 'order' : 'orders'}
            </span>
            <span className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-2">
              <Clock size={15} /> Updates appear after refresh
            </span>
            <span className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-2">
              <Truck size={15} /> Manage each order below
            </span>
          </div>
          <div className="space-y-4">
            {orders.map((order) => (
              <OrderCard
                key={order.id}
                order={order}
                busy={mutation.isPending && mutation.variables?.orderId === order.id}
                onUpdate={(status, reason) => mutation.mutate({ orderId: order.id, status, reason })}
              />
            ))}
          </div>
        </>
      )}
    </div>
  )
}