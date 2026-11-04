import { useQuery } from '@tanstack/react-query'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, Clock, MapPin, Package, RefreshCw } from 'lucide-react'
import { getOrderById } from '@/services/orders'

const steps = ['PLACED', 'ACCEPTED', 'PREPARING', 'READY', 'OUT_FOR_DELIVERY', 'DELIVERED']

function formatStatus(status: string) {
  return status.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase())
}

export function OrderDetailsPage() {
  const { id } = useParams<{ id: string }>()

  const orderQuery = useQuery({
    queryKey: ['customer-order', id],
    queryFn: ({ signal }) => getOrderById(id!, signal),
    enabled: Boolean(id),
    refetchInterval: 30000,
  })

  if (orderQuery.isLoading) {
    return <div className="py-16 text-center text-gray-500">Loading order details...</div>
  }

  if (orderQuery.isError || !orderQuery.data?.data) {
    return (
      <div className="space-y-4 rounded-xl border border-red-200 bg-red-50 p-6 text-red-700">
        <p>Could not load this order.</p>
        <button onClick={() => orderQuery.refetch()} className="font-semibold underline">
          Try again
        </button>
        <Link to="/customer/orders" className="block text-sm underline">Back to My Orders</Link>
      </div>
    )
  }

  const order = orderQuery.data.data
  const currentIndex = steps.indexOf(order.status)
  const cancelled = order.status === 'CANCELLED'

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Link to="/customer/orders" className="inline-flex items-center gap-2 text-sm font-medium text-gray-600 hover:text-emerald-700">
        <ArrowLeft className="h-4 w-4" /> Back to My Orders
      </Link>

      <section className="rounded-2xl bg-gradient-to-r from-slate-900 to-emerald-800 p-6 text-white">
        <p className="text-sm text-emerald-200">ORDER TRACKING</p>
        <h1 className="mt-2 text-2xl font-bold">{order.orderNumber}</h1>
        <p className="mt-2 text-sm text-slate-200">
          {order.restaurant?.name ?? 'Restaurant'} · {new Date(order.createdAt).toLocaleString('en-IN')}
        </p>
        <div className="mt-4 flex items-center justify-between gap-3">
          <span className="rounded-full bg-white/15 px-3 py-1.5 text-sm font-semibold">
            {formatStatus(order.status)}
          </span>
          <button
            onClick={() => orderQuery.refetch()}
            className="flex items-center gap-2 text-sm hover:text-emerald-200"
          >
            <RefreshCw className="h-4 w-4" /> Refresh
          </button>
        </div>
      </section>

      <section className="rounded-2xl border border-gray-200 bg-white p-5">
        <h2 className="text-lg font-bold text-gray-900">Order progress</h2>

        {cancelled ? (
          <p className="mt-4 rounded-lg bg-red-50 p-4 font-semibold text-red-700">
            This order has been cancelled.
          </p>
        ) : (
          <div className="mt-5 space-y-4">
            {steps.map((step, index) => {
              const completed = currentIndex >= index

              return (
                <div key={step} className="flex items-center gap-3">
                  <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold ${
                    completed ? 'bg-emerald-600 text-white' : 'bg-gray-100 text-gray-400'
                  }`}>
                    {completed ? '✓' : index + 1}
                  </div>
                  <span className={`text-sm font-medium ${
                    completed ? 'text-gray-900' : 'text-gray-400'
                  }`}>
                    {formatStatus(step)}
                  </span>
                  {index === currentIndex && (
                    <span className="ml-auto text-xs font-semibold text-emerald-700">Current</span>
                  )}
                </div>
              )
            })}
          </div>
        )}
        <p className="mt-4 text-xs text-gray-400">
          Order status refreshes automatically every 30 seconds.
        </p>
      </section>

      <section className="rounded-2xl border border-gray-200 bg-white p-5">
        <h2 className="text-lg font-bold text-gray-900">Items ordered</h2>
        <p className="mt-1 flex items-center gap-1 text-sm text-gray-500">
          <MapPin className="h-4 w-4" /> {order.restaurant?.city ?? 'Location unavailable'}
        </p>

        <div className="mt-4 space-y-3">
          {order.items.map((item) => (
            <div key={item.id} className="flex justify-between gap-3 border-b border-gray-100 pb-3 text-sm">
              <span className="text-gray-700">{item.name} × {item.quantity}</span>
              <span className="font-medium">₹{Number(item.lineTotal).toFixed(2)}</span>
            </div>
          ))}
        </div>

        <div className="mt-4 flex justify-between font-bold">
          <span>Total payable</span>
          <span className="text-emerald-700">₹{Number(order.total).toFixed(2)}</span>
        </div>

        <div className="mt-4 flex items-center gap-2 text-sm text-gray-600">
          <Package className="h-4 w-4" />
          Payment: {order.payment?.method ?? 'COD'} · {formatStatus(order.payment?.status ?? 'PENDING')}
        </div>
        <div className="mt-2 flex items-center gap-2 text-sm text-gray-500">
          <Clock className="h-4 w-4" /> Placed on {new Date(order.createdAt).toLocaleString('en-IN')}
        </div>
      </section>
    </div>
  )
}