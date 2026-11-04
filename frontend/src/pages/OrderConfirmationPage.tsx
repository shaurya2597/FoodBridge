import { useEffect } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { CheckCircle2, Clock, MapPin, Package, ShoppingBag } from 'lucide-react'
import type { CustomerOrder } from '@/services/orders'

interface ConfirmationState {
  orderPlaced?: boolean
  order?: CustomerOrder
}

export function OrderConfirmationPage() {
  const location = useLocation()
  const navigate = useNavigate()
  const state = location.state as ConfirmationState | null
  const order = state?.order

  useEffect(() => {
    if (!state?.orderPlaced || !order) {
      navigate('/customer/orders', { replace: true })
    }
  }, [state, order, navigate])

  if (!state?.orderPlaced || !order) return null

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <section className="rounded-2xl border border-emerald-100 bg-white p-8 text-center shadow-sm">
        <CheckCircle2 className="mx-auto h-16 w-16 text-emerald-600" />
        <h1 className="mt-4 text-2xl font-bold text-gray-900">Order placed successfully!</h1>
        <p className="mt-2 text-sm text-gray-500">
          Your order has been received. The restaurant will process it shortly.
        </p>
        <p className="mt-5 text-xs font-medium uppercase tracking-wide text-gray-400">Order number</p>
        <p className="mt-1 text-xl font-bold text-emerald-700">{order.orderNumber}</p>
      </section>

      <section className="rounded-2xl border border-gray-200 bg-white p-5">
        <h2 className="text-lg font-bold text-gray-900">Order details</h2>
        <div className="mt-4 flex items-start justify-between gap-3">
          <div>
            <p className="font-semibold text-gray-900">{order.restaurant.name}</p>
            <p className="mt-1 flex items-center gap-1 text-sm text-gray-500">
              <MapPin className="h-4 w-4" /> {order.restaurant.city}
            </p>
          </div>
          <span className="rounded-full bg-blue-100 px-3 py-1 text-xs font-semibold text-blue-700">
            {order.status.replace(/_/g, ' ')}
          </span>
        </div>

        <div className="mt-5 space-y-3 border-t border-gray-100 pt-4">
          {order.items.map((item) => (
            <div key={item.id} className="flex justify-between gap-3 text-sm">
              <span className="text-gray-600">{item.name} × {item.quantity}</span>
              <span className="font-medium text-gray-900">₹{Number(item.lineTotal).toFixed(2)}</span>
            </div>
          ))}
        </div>

        <div className="mt-5 flex items-center justify-between border-t border-gray-100 pt-4">
          <span className="font-semibold text-gray-900">Total paid / payable</span>
          <span className="text-xl font-bold text-emerald-700">₹{Number(order.total).toFixed(2)}</span>
        </div>

        <div className="mt-4 flex items-center gap-2 text-sm text-gray-600">
          <Package className="h-4 w-4" />
          Payment: {order.payment?.method ?? 'COD'} · {order.payment?.status ?? 'Pending'}
        </div>

        <div className="mt-3 flex items-center gap-2 text-sm text-gray-600">
          <Clock className="h-4 w-4" />
          Placed on {new Date(order.createdAt).toLocaleString('en-IN')}
        </div>
      </section>

      <div className="grid gap-3 sm:grid-cols-2">
        <Link
          to="/customer/orders"
          className="flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-5 py-3 font-semibold text-white hover:bg-emerald-700"
        >
          <Package className="h-4 w-4" /> Track order
        </Link>
        <Link
          to="/customer/explore"
          className="flex items-center justify-center gap-2 rounded-xl border border-gray-300 px-5 py-3 font-semibold text-gray-700 hover:bg-gray-50"
        >
          <ShoppingBag className="h-4 w-4" /> Continue shopping
        </Link>
      </div>
    </div>
  )
}
