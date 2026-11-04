import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowLeft, Loader2, Minus, Plus, ShoppingBag, Trash2, UtensilsCrossed } from 'lucide-react'
import { clearCart, getCart, removeCartItem, updateCartItem } from '@/services/cart'

const money = (value: number) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(value)

export function CartPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const cartQuery = useQuery({
    queryKey: ['cart'],
    queryFn: ({ signal }) => getCart(signal),
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, quantity }: { id: string; quantity: number }) =>
      updateCartItem(id, quantity),
    onSuccess: (cart) => queryClient.setQueryData(['cart'], cart),
  })

  const removeMutation = useMutation({
    mutationFn: removeCartItem,
    onSuccess: (cart) => queryClient.setQueryData(['cart'], cart),
  })

  const clearMutation = useMutation({
    mutationFn: clearCart,
    onSuccess: (cart) => queryClient.setQueryData(['cart'], cart),
  })

  if (cartQuery.isLoading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  if (cartQuery.isError) {
    return (
      <div className="mx-auto max-w-3xl p-8 text-center">
        <p className="text-red-600">Could not load your cart.</p>
        <button onClick={() => cartQuery.refetch()} className="mt-4 rounded-lg bg-primary px-5 py-2 text-white">
          Retry
        </button>
      </div>
    )
  }

  const cart = cartQuery.data
  const items = cart?.items ?? []

  if (!items.length) {
    return (
      <div className="mx-auto flex max-w-2xl flex-col items-center px-6 py-20 text-center">
        <ShoppingBag className="mb-5 h-16 w-16 text-muted-foreground" />
        <h1 className="text-2xl font-bold">Your cart is empty</h1>
        <p className="mt-2 text-muted-foreground">Discover delicious food and add something you love.</p>
        <Link to="/customer/explore" className="mt-6 rounded-xl bg-primary px-6 py-3 font-semibold text-white">
          Explore Food
        </Link>
      </div>
    )
  }

  const busy = updateMutation.isPending || removeMutation.isPending || clearMutation.isPending
  const breakdown = cart!.breakdown

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-4 sm:p-6">
      <div className="flex items-center gap-3">
        <Link to="/customer/explore" className="rounded-lg border p-2 hover:bg-muted">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold">Your Cart</h1>
          <p className="text-sm text-muted-foreground">{cart!.itemCount} items</p>
        </div>
      </div>

      {cart!.restaurant && (
        <div className="flex items-center gap-3 rounded-xl border bg-card p-4">
          <UtensilsCrossed className="h-6 w-6 text-primary" />
          <div>
            <p className="font-semibold">{cart!.restaurant.name}</p>
            <p className="text-sm text-muted-foreground">
              {cart!.restaurant.city} · {cart!.restaurant.deliveryTime} min delivery
            </p>
          </div>
          <span className={`ml-auto text-sm font-medium ${cart!.restaurant.isOpen ? 'text-green-600' : 'text-red-600'}`}>
            {cart!.restaurant.isOpen ? 'Open' : 'Closed'}
          </span>
        </div>
      )}

      {cart!.issues.length > 0 && (
        <div className="space-y-2 rounded-xl border border-red-300 bg-red-50 p-4 text-sm text-red-800">
          <p className="font-semibold">Some items need attention</p>
          {cart!.issues.map((issue, index) => <p key={`${issue.code}-${index}`}>• {issue.message}</p>)}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[1fr_350px]">
        <section className="space-y-4">
          {items.map((item) => (
            <article key={item.id} className="flex gap-4 rounded-xl border bg-card p-4">
              <img
                src={item.imageUrl || ''}
                alt={item.name}
                className="h-24 w-24 rounded-lg bg-muted object-cover"
              />
              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-semibold">{item.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {item.foodType === 'VEG' ? '🟢 Veg' : '🔴 Non-veg'}
                    </p>
                  </div>
                  <p className="font-semibold">{money(item.lineTotal)}</p>
                </div>

                {item.selections.length > 0 && (
                  <p className="mt-1 text-xs text-muted-foreground">
                    {item.selections.map((selection) => `${selection.group}: ${selection.option}`).join(' · ')}
                  </p>
                )}
                {item.instructions && (
                  <p className="mt-1 text-xs text-muted-foreground">Note: {item.instructions}</p>
                )}

                <div className="mt-3 flex items-center justify-between">
                  <div className="flex items-center gap-3 rounded-lg border px-2 py-1">
                    <button
                      aria-label="Decrease quantity"
                      disabled={busy || item.quantity <= 1}
                      onClick={() => updateMutation.mutate({ id: item.id, quantity: item.quantity - 1 })}
                      className="disabled:opacity-40"
                    >
                      <Minus className="h-4 w-4" />
                    </button>
                    <span className="min-w-5 text-center text-sm font-semibold">{item.quantity}</span>
                    <button
                      aria-label="Increase quantity"
                      disabled={busy || item.quantity >= 20}
                      onClick={() => updateMutation.mutate({ id: item.id, quantity: item.quantity + 1 })}
                      className="disabled:opacity-40"
                    >
                      <Plus className="h-4 w-4" />
                    </button>
                  </div>
                  <button
                    disabled={busy}
                    onClick={() => removeMutation.mutate(item.id)}
                    className="flex items-center gap-1 text-sm text-red-600 hover:text-red-700 disabled:opacity-40"
                  >
                    <Trash2 className="h-4 w-4" /> Remove
                  </button>
                </div>
              </div>
            </article>
          ))}

          <div className="flex justify-between">
            <Link to="/customer/explore" className="text-sm font-medium text-primary hover:underline">
              + Add more food
            </Link>
            <button
              disabled={busy}
              onClick={() => {
                if (window.confirm('Remove all items from your cart?')) clearMutation.mutate()
              }}
              className="text-sm text-red-600 hover:underline disabled:opacity-40"
            >
              Clear cart
            </button>
          </div>

          {(updateMutation.isError || removeMutation.isError || clearMutation.isError) && (
            <p className="text-sm text-red-600">Could not update your cart. Please try again.</p>
          )}
        </section>

        <aside className="h-fit space-y-4 rounded-xl border bg-card p-5">
          <h2 className="text-lg font-bold">Bill Details</h2>
          <div className="space-y-3 text-sm">
            <div className="flex justify-between"><span>Item total</span><span>{money(breakdown.subtotal)}</span></div>
            {breakdown.discount > 0 && (
              <div className="flex justify-between text-green-600"><span>Discount</span><span>-{money(breakdown.discount)}</span></div>
            )}
            <div className="flex justify-between"><span>Delivery fee</span><span>{money(breakdown.deliveryFee)}</span></div>
            <div className="flex justify-between"><span>Platform fee</span><span>{money(breakdown.platformFee)}</span></div>
            <div className="flex justify-between"><span>Tax</span><span>{money(breakdown.tax)}</span></div>
            <div className="border-t pt-3 text-base font-bold flex justify-between"><span>Grand total</span><span>{money(breakdown.total)}</span></div>
          </div>

          {cart!.restaurant && !cart!.meetsMinOrder && (
            <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-800">
              Minimum order is {money(cart!.restaurant.minOrder)}. Add more food to continue.
            </p>
          )}

          <button
            disabled={!cart!.meetsMinOrder || cart!.issues.length > 0 || !cart!.restaurant?.isOpen}
            onClick={() => navigate('/customer/checkout')}
            className="w-full rounded-xl bg-emerald-600 px-5 py-3 font-semibold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Proceed to Checkout
          </button>
          <p className="text-center text-xs text-muted-foreground">Final prices are confirmed securely at checkout.</p>
        </aside>
      </div>
    </div>
  )
}
