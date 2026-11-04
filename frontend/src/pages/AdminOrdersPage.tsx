import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Eye, RefreshCw, ShoppingBag } from 'lucide-react'
import { getAdminOrders, getAdminOrderDetail } from '@/services/admin'

const statuses = [
  'ALL', 'PLACED', 'ACCEPTED', 'PREPARING', 'READY',
  'OUT_FOR_DELIVERY', 'DELIVERED', 'CANCELLED',
]

const statusStyles: Record<string, string> = {
  PLACED: 'bg-blue-100 text-blue-800',
  ACCEPTED: 'bg-indigo-100 text-indigo-800',
  PREPARING: 'bg-amber-100 text-amber-800',
  READY: 'bg-purple-100 text-purple-800',
  OUT_FOR_DELIVERY: 'bg-cyan-100 text-cyan-800',
  DELIVERED: 'bg-green-100 text-green-800',
  CANCELLED: 'bg-red-100 text-red-800',
}

export function AdminOrdersPage() {
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('ALL')
  const [page, setPage] = useState(1)
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const ordersQuery = useQuery({
    queryKey: ['admin', 'orders', search, status, page],
    queryFn: ({ signal }) =>
      getAdminOrders({
        q: search.trim() || undefined,
        status: status === 'ALL' ? undefined : status,
        page,
        limit: 10,
      }, signal),
  })

  const detailQuery = useQuery({
    queryKey: ['admin', 'order', selectedId],
    queryFn: ({ signal }) => getAdminOrderDetail(selectedId!, signal),
    enabled: Boolean(selectedId),
  })

  const orders = ordersQuery.data?.data ?? []
  const meta = ordersQuery.data?.meta
  const detail = detailQuery.data

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Orders Management</h1>
          <p className="mt-1 text-sm text-slate-500">
            Monitor customer orders and payment information.
          </p>
        </div>
        <div className="flex items-center gap-2 text-sm text-slate-500">
          <ShoppingBag size={18} />
          {meta ? `${meta.total} total orders` : 'Loading orders...'}
        </div>
      </div>

      <div className="flex flex-wrap gap-3">
        <input
          value={search}
          onChange={(event) => {
            setSearch(event.target.value)
            setPage(1)
          }}
          placeholder="Search order number or customer..."
          className="min-w-0 flex-1 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm outline-none focus:border-slate-400"
        />
      </div>

      <div className="flex flex-wrap gap-2">
        {statuses.map((item) => (
          <button
            key={item}
            onClick={() => {
              setStatus(item)
              setPage(1)
            }}
            className={`rounded-full px-3 py-2 text-xs font-medium ${
              status === item
                ? 'bg-slate-900 text-white'
                : 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
            }`}
          >
            {item.replaceAll('_', ' ')}
          </button>
        ))}
      </div>

      {ordersQuery.isLoading ? (
        <div className="rounded-xl border bg-white p-10 text-center text-slate-500">
          Loading orders...
        </div>
      ) : ordersQuery.isError ? (
        <div className="rounded-xl border border-red-200 bg-red-50 p-5 text-sm text-red-700">
          Could not load orders.
          <button onClick={() => void ordersQuery.refetch()} className="ml-2 underline">
            <RefreshCw className="inline" size={14} /> Retry
          </button>
        </div>
      ) : orders.length === 0 ? (
        <div className="rounded-xl border bg-white p-10 text-center">
          <ShoppingBag className="mx-auto mb-3 text-slate-400" size={32} />
          <p className="font-medium text-slate-800">No orders found</p>
          <p className="mt-1 text-sm text-slate-500">Try changing the search or status filter.</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-5 py-4">Order</th>
                  <th className="px-5 py-4">Customer</th>
                  <th className="px-5 py-4">Restaurant</th>
                  <th className="px-5 py-4">Total</th>
                  <th className="px-5 py-4">Payment</th>
                  <th className="px-5 py-4">Status</th>
                  <th className="px-5 py-4">Date</th>
                  <th className="px-5 py-4">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {orders.map((order) => (
                  <tr key={order.id} className="hover:bg-slate-50">
                    <td className="px-5 py-4 font-semibold text-slate-900">
                      {order.orderNumber}
                    </td>
                    <td className="px-5 py-4">
                      <p className="font-medium text-slate-800">{order.customer.name}</p>
                      <p className="text-xs text-slate-500">{order.customer.email}</p>
                    </td>
                    <td className="px-5 py-4 text-slate-700">{order.restaurant.name}</td>
                    <td className="px-5 py-4 font-semibold text-slate-800">
                      ₹{order.total.toFixed(2)}
                    </td>
                    <td className="px-5 py-4">
                      <p className="text-slate-700">{order.payment?.method ?? '—'}</p>
                      <p className="text-xs text-slate-500">{order.payment?.status ?? '—'}</p>
                    </td>
                    <td className="px-5 py-4">
                      <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                        statusStyles[order.status] ?? 'bg-slate-100 text-slate-700'
                      }`}>
                        {order.status.replaceAll('_', ' ')}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-5 py-4 text-xs text-slate-500">
                      {new Date(order.createdAt).toLocaleDateString('en-IN')}
                    </td>
                    <td className="px-5 py-4">
                      <button
                        onClick={() => setSelectedId(order.id)}
                        className="inline-flex items-center gap-1 rounded-lg border px-3 py-1.5 text-xs font-medium hover:bg-slate-50"
                      >
                        <Eye size={14} /> View
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex items-center justify-between border-t px-5 py-4">
            <p className="text-xs text-slate-500">
              Page {meta?.page ?? page} of {meta?.totalPages ?? 1}
            </p>
            <div className="flex gap-2">
              <button
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
                className="rounded-lg border px-3 py-1.5 text-sm disabled:opacity-40"
              >
                Previous
              </button>
              <button
                disabled={!meta || page >= meta.totalPages}
                onClick={() => setPage((p) => p + 1)}
                className="rounded-lg border px-3 py-1.5 text-sm disabled:opacity-40"
              >
                Next
              </button>
            </div>
          </div>
        </div>
      )}

      {selectedId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="max-h-[85vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white p-6 shadow-xl">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-slate-900">Order Details</h2>
              <button onClick={() => setSelectedId(null)} className="rounded-lg px-3 py-1 text-slate-500 hover:bg-slate-100">
                Close
              </button>
            </div>

            {detailQuery.isLoading ? (
              <p className="py-8 text-center text-sm text-slate-500">Loading details...</p>
            ) : detailQuery.isError ? (
              <p className="py-8 text-center text-sm text-red-600">Could not load order details.</p>
            ) : detail ? (
              <div className="mt-5 space-y-5 text-sm">
                <div className="rounded-xl bg-slate-50 p-4">
                  <p className="font-semibold">{detail.orderNumber}</p>
                  <p className="mt-1 text-slate-600">{detail.customer.name} · {detail.customer.email}</p>
                  <p className="text-slate-600">{detail.restaurant.name} · {detail.restaurant.city}</p>
                  <p className="mt-2 font-semibold">{detail.status.replaceAll('_', ' ')}</p>
                </div>

                <div>
                  <h3 className="mb-2 font-semibold">Items</h3>
                  {detail.items.map((item) => (
                    <div key={item.id} className="flex justify-between border-b py-2">
                      <span>{item.name} × {item.quantity}</span>
                      <span>₹{item.lineTotal.toFixed(2)}</span>
                    </div>
                  ))}
                </div>

                <div className="space-y-1 rounded-xl border p-4">
                  <div className="flex justify-between"><span>Subtotal</span><span>₹{detail.subtotal.toFixed(2)}</span></div>
                  <div className="flex justify-between"><span>Delivery fee</span><span>₹{detail.deliveryFee.toFixed(2)}</span></div>
                  <div className="flex justify-between"><span>Tax</span><span>₹{detail.tax.toFixed(2)}</span></div>
                  <div className="flex justify-between"><span>Platform fee</span><span>₹{detail.platformFee.toFixed(2)}</span></div>
                  <div className="flex justify-between"><span>Discount</span><span>−₹{detail.discount.toFixed(2)}</span></div>
                  <div className="flex justify-between border-t pt-2 font-bold"><span>Total</span><span>₹{detail.total.toFixed(2)}</span></div>
                </div>

                <div>
                  <h3 className="mb-2 font-semibold">Payment</h3>
                  <p>{detail.payment?.method ?? '—'} · {detail.payment?.status ?? '—'}</p>
                  {detail.payment?.isDemo && <p className="mt-1 text-xs text-amber-700">Demo payment</p>}
                </div>
              </div>
            ) : null}
          </div>
        </div>
      )}
    </div>
  )
}