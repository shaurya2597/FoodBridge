import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, MapPin, ShoppingBag } from 'lucide-react'
import { getCart } from '@/services/cart'
import { getAddresses } from '@/services/addresses'
import { placeOrder } from '@/services/orders'

const formatINR = (amount: number) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(amount)

export function CheckoutPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const cartQuery = useQuery({
    queryKey: ['cart'],
    queryFn: ({ signal }) => getCart(signal),
  })
  const addressQuery = useQuery({
    queryKey: ['addresses'],
    queryFn: ({ signal }) => getAddresses(signal),
  })

  const [selectedAddressId, setSelectedAddressId] = useState('')
  const [useNewAddress, setUseNewAddress] = useState(false)
  const [contactName, setContactName] = useState('')
  const [contactPhone, setContactPhone] = useState('')
  const [label, setLabel] = useState('Home')
  const [line1, setLine1] = useState('')
  const [line2, setLine2] = useState('')
  const [city, setCity] = useState('')
  const [state, setState] = useState('')
  const [pincode, setPincode] = useState('')
  const [saveAddress, setSaveAddress] = useState(true)
  const [instructions, setInstructions] = useState('')
  const [couponCode, setCouponCode] = useState('')
  const [submitError, setSubmitError] = useState('')

  const orderMutation = useMutation({
    mutationFn: placeOrder,
    onSuccess: async (response) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['cart'] }),
        queryClient.invalidateQueries({ queryKey: ['orders'] }),
        queryClient.invalidateQueries({ queryKey: ['addresses'] }),
      ])
      navigate('/customer/order-confirmation', {
        state: { orderPlaced: true, order: response.data },
      })
    },
    onError: (error: Error) => {
      setSubmitError(error.message || 'Could not place your order.')
    },
  })

  const handlePlaceOrder = () => {
    setSubmitError('')

    if (!cart || !cart.restaurant) {
      setSubmitError('Restaurant details are unavailable.')
      return
    }

    if (cart.issues.length > 0) {
      setSubmitError(cart.issues.map((issue) => issue.message).join(' '))
      return
    }

    if (!cart.meetsMinOrder) {
      setSubmitError('Your cart does not meet the restaurant minimum order.')
      return
    }

    if (contactName.trim().length < 2 || contactName.trim().length > 80) {
      setSubmitError('Enter a valid recipient name.')
      return
    }

    if (!/^[6-9]\d{9}$/.test(contactPhone)) {
      setSubmitError('Enter a valid 10-digit Indian mobile number.')
      return
    }

    const selectedAddress = addresses.find((address) => address.id === selectedAddressId)

    if (!useNewAddress && !selectedAddress) {
      setSubmitError('Please select a delivery address.')
      return
    }

    const deliveryCity = useNewAddress ? city.trim() : selectedAddress?.city ?? ''

    if (deliveryCity.toLowerCase() !== cart.restaurant.city.trim().toLowerCase()) {
      setSubmitError(`Delivery is available only in ${cart.restaurant.city}.`)
      return
    }

    if (useNewAddress) {
      if (line1.trim().length < 5 || city.trim().length < 2 || state.trim().length < 2 || !/^[1-9]\d{5}$/.test(pincode)) {
        setSubmitError('Please complete the new address with a valid 6-digit PIN code.')
        return
      }

      orderMutation.mutate({
        address: {
          label,
          line1: line1.trim(),
          ...(line2.trim() ? { line2: line2.trim() } : {}),
          city: city.trim(),
          state: state.trim(),
          pincode,
        },
        saveAddress,
        contactName: contactName.trim(),
        contactPhone,
        ...(instructions.trim() ? { instructions: instructions.trim() } : {}),
        ...(couponCode.trim() ? { couponCode: couponCode.trim() } : {}),
        paymentMethod: 'COD',
      })
      return
    }

    orderMutation.mutate({
      addressId: selectedAddressId,
      contactName: contactName.trim(),
      contactPhone,
      ...(instructions.trim() ? { instructions: instructions.trim() } : {}),
      ...(couponCode.trim() ? { couponCode: couponCode.trim() } : {}),
      paymentMethod: 'COD',
    })
  }
  const cart = cartQuery.data
  const addresses = addressQuery.data ?? []

  if (cartQuery.isLoading || addressQuery.isLoading) {
    return <div className="p-8 text-center text-gray-500">Loading checkout...</div>
  }

  if (cartQuery.isError || addressQuery.isError) {
    return <div className="p-8 text-center text-red-600">Could not load checkout details. Please retry.</div>
  }

  if (!cart || cart.items.length === 0) {
    return (
      <div className="rounded-2xl border border-gray-200 bg-white p-8 text-center">
        <ShoppingBag className="mx-auto h-10 w-10 text-gray-400" />
        <h2 className="mt-3 text-lg font-bold text-gray-900">Your cart is empty</h2>
        <button onClick={() => navigate('/customer/explore')} className="mt-4 rounded-lg bg-emerald-600 px-5 py-2.5 font-semibold text-white hover:bg-emerald-700">
          Explore food
        </button>
      </div>
    )
  }

  const fieldClass = 'mt-1 w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100'

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <button onClick={() => navigate('/customer/cart')} className="flex items-center gap-2 text-sm font-medium text-gray-600 hover:text-gray-900">
        <ArrowLeft className="h-4 w-4" /> Back to cart
      </button>

      <div>
        <h1 className="text-2xl font-bold text-gray-900">Checkout</h1>
        <p className="mt-1 text-sm text-gray-500">Complete your delivery details and place your order.</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <div className="space-y-6">
          <section className="rounded-2xl border border-gray-200 bg-white p-5">
            <h2 className="flex items-center gap-2 text-lg font-bold text-gray-900">
              <MapPin className="h-5 w-5 text-emerald-600" /> Delivery address
            </h2>
            <p className="mt-1 text-sm text-gray-500">
              Delivery is currently available in {cart.restaurant?.city ?? 'the restaurant city'}.
            </p>

            <div className="mt-4">
            <label className="text-sm font-medium text-gray-700">Coupon code</label>
            <input
              value={couponCode}
              onChange={(e) => setCouponCode(e.target.value.toUpperCase().replace(/[^A-Z0-9_-]/g, '').slice(0, 30))}
              placeholder="Enter coupon code"
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-emerald-500"
            />
            <p className="mt-1 text-xs text-gray-400">Coupon is validated when you place the order.</p>
          </div>
          <div className="mt-4 space-y-3">
              {addresses.map((address) => (
                <label key={address.id} className={`flex cursor-pointer gap-3 rounded-xl border p-4 transition ${selectedAddressId === address.id && !useNewAddress ? 'border-emerald-500 bg-emerald-50' : 'border-gray-200 hover:border-gray-300'}`}>
                  <input
                    type="radio"
                    name="deliveryAddress"
                    checked={selectedAddressId === address.id && !useNewAddress}
                    onChange={() => {
                      setSelectedAddressId(address.id)
                      setUseNewAddress(false)
                    }}
                    className="mt-1 accent-emerald-600"
                  />
                  <span className="min-w-0">
                    <span className="flex flex-wrap items-center gap-2 font-semibold text-gray-900">
                      {address.label}
                      {address.isDefault && <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs text-emerald-700">Default</span>}
                    </span>
                    <span className="mt-1 block text-sm text-gray-600">
                      {address.line1}{address.line2 ? `, ${address.line2}` : ''}
                    </span>
                    <span className="block text-sm text-gray-600">
                      {address.city}, {address.state}, {address.pincode}
                    </span>
                  </span>
                </label>
              ))}

              <label className={`flex cursor-pointer items-center gap-3 rounded-xl border p-4 ${useNewAddress ? 'border-emerald-500 bg-emerald-50' : 'border-gray-200 hover:border-gray-300'}`}>
                <input
                  type="radio"
                  name="deliveryAddress"
                  checked={useNewAddress}
                  onChange={() => setUseNewAddress(true)}
                  className="accent-emerald-600"
                />
                <span className="font-semibold text-gray-900">Deliver to a new address</span>
              </label>
            </div>

            {useNewAddress && (
              <div className="mt-5 space-y-4 border-t border-gray-100 pt-5">
                <h3 className="font-semibold text-gray-900">New delivery address</h3>
                <div>
                  <label className="text-sm font-medium text-gray-700">Address label</label>
                  <select value={label} onChange={(e) => setLabel(e.target.value)} className={fieldClass}>
                    <option>Home</option>
                    <option>Work</option>
                    <option>Hostel</option>
                    <option>Other</option>
                  </select>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700">Address line 1</label>
                  <input value={line1} onChange={(e) => setLine1(e.target.value)} placeholder="House number, street, area" className={fieldClass} />
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700">Address line 2 (optional)</label>
                  <input value={line2} onChange={(e) => setLine2(e.target.value)} placeholder="Landmark, apartment, etc." className={fieldClass} />
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className="text-sm font-medium text-gray-700">City</label>
                    <input value={city} onChange={(e) => setCity(e.target.value)} placeholder="City" className={fieldClass} />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-700">State</label>
                    <input value={state} onChange={(e) => setState(e.target.value)} placeholder="State" className={fieldClass} />
                  </div>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700">6-digit PIN code</label>
                  <input value={pincode} onChange={(e) => setPincode(e.target.value.replace(/\D/g, '').slice(0, 6))} inputMode="numeric" maxLength={6} placeholder="PIN code" className={fieldClass} />
                </div>
              </div>
            )}
            {useNewAddress && (
              <label className="mt-3 flex items-center gap-2 text-sm text-gray-700">
                <input type="checkbox" checked={saveAddress} onChange={(e) => setSaveAddress(e.target.checked)} className="accent-emerald-600" />
                Save this address for future orders
              </label>
            )}

          </section>

          <section className="rounded-2xl border border-gray-200 bg-white p-5">
            <h2 className="text-lg font-bold text-gray-900">Contact details</h2>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <div>
                <label className="text-sm font-medium text-gray-700">Recipient name</label>
                <input value={contactName} onChange={(e) => setContactName(e.target.value)} placeholder="Full name" className={fieldClass} />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700">Mobile number</label>
                <input value={contactPhone} onChange={(e) => setContactPhone(e.target.value.replace(/\D/g, '').slice(0, 10))} inputMode="numeric" maxLength={10} placeholder="10-digit mobile number" className={fieldClass} />
              </div>
            </div>
          </section>
          <section className="rounded-2xl border border-gray-200 bg-white p-5">
            <h2 className="text-lg font-bold text-gray-900">Delivery instructions</h2>
            <textarea value={instructions} onChange={(e) => setInstructions(e.target.value)} maxLength={300} rows={3} placeholder="E.g. Call when you arrive..." className="mt-3 w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm outline-none focus:border-emerald-500" />
            <p className="mt-1 text-right text-xs text-gray-400">{instructions.length}/300</p>
          </section>

        </div>

        <aside className="h-fit rounded-2xl border border-gray-200 bg-white p-5">
          <h2 className="text-lg font-bold text-gray-900">Order summary</h2>
          <p className="mt-1 text-sm text-gray-500">{cart.restaurant?.name}</p>
          <div className="mt-4">
            <label className="text-sm font-medium text-gray-700">Coupon code</label>
            <input
              value={couponCode}
              onChange={(e) => setCouponCode(e.target.value.toUpperCase().replace(/[^A-Z0-9_-]/g, '').slice(0, 30))}
              placeholder="Enter coupon code"
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-emerald-500"
            />
            <p className="mt-1 text-xs text-gray-400">Coupon is validated when you place the order.</p>
          </div>
          <div className="mt-4 space-y-3">
            {cart.items.map((item) => (
              <div key={item.id} className="flex justify-between gap-3 text-sm">
                <span className="text-gray-600">{item.name} x {item.quantity}</span>
                <span className="font-medium text-gray-900">{formatINR(Number(item.lineTotal))}</span>
              </div>
            ))}
          </div>
          <div className="mt-4 space-y-2 border-t border-gray-100 pt-4 text-sm">
            <div className="flex justify-between"><span className="text-gray-500">Subtotal</span><span>{formatINR(cart.breakdown.subtotal)}</span></div>
            <div className="flex justify-between"><span className="text-gray-500">Discount</span><span>-{formatINR(cart.breakdown.discount)}</span></div>
            <div className="flex justify-between"><span className="text-gray-500">Delivery fee</span><span>{formatINR(cart.breakdown.deliveryFee)}</span></div>
            <div className="flex justify-between"><span className="text-gray-500">Platform fee</span><span>{formatINR(cart.breakdown.platformFee)}</span></div>
            <div className="flex justify-between"><span className="text-gray-500">Tax</span><span>{formatINR(cart.breakdown.tax)}</span></div>
            <div className="flex justify-between border-t border-gray-100 pt-3 text-base font-bold">
              <span>Total</span><span className="text-emerald-700">{formatINR(cart.breakdown.total)}</span>
            </div>
          </div>
          <div className="mt-5 border-t border-gray-100 pt-4">
            <h3 className="font-semibold text-gray-900">Payment method</h3>
            <label className="mt-3 flex items-center gap-3 rounded-xl border border-emerald-500 bg-emerald-50 p-4">
              <input type="radio" checked readOnly className="accent-emerald-600" />
              <span>
                <span className="block font-semibold text-gray-900">Cash on delivery</span>
                <span className="block text-xs text-gray-500">Pay when your order arrives</span>
              </span>
            </label>

            {submitError && (
              <p role="alert" className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">
                {submitError}
              </p>
            )}

            <button
              type="button"
              onClick={handlePlaceOrder}
              disabled={orderMutation.isPending || cart.issues.length > 0 || !cart.meetsMinOrder}
              className="mt-5 w-full rounded-xl bg-emerald-600 px-5 py-3 font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {orderMutation.isPending ? 'Placing order...' : `Place order ┬╖ ${formatINR(cart.breakdown.total)}`}
            </button>
            <p className="mt-2 text-center text-xs text-gray-400">
              Your order will be placed securely with cash on delivery.
            </p>
          </div>
        </aside>
      </div>
    </div>
  )
}
