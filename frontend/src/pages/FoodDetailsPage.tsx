import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, Loader2, Minus, Plus, ShoppingCart, Star, UtensilsCrossed } from 'lucide-react'
import { getFoodById, type FoodItem } from '@/services/food'
import { addCartItem } from '@/services/cart'

interface CustomizationGroup {
  name: string
  options: { label: string; extraPrice: number }[]
}

type DetailedFood = FoodItem & {
  restaurant: FoodItem['restaurant'] & {
    city: string
    imageUrl: string | null
    isOpen: boolean
    deliveryTime: number
    deliveryFee: number
    minOrder: number
  }
}

export function FoodDetailsPage() {
  const { id } = useParams<{ id: string }>()
  const queryClient = useQueryClient()
  const [quantity, setQuantity] = useState(1)
  const [selections, setSelections] = useState<Record<string, string>>({})
  const [instructions, setInstructions] = useState('')
  const [replaceCart, setReplaceCart] = useState(false)
  const [message, setMessage] = useState('')

  const foodQuery = useQuery({
    queryKey: ['food', id],
    queryFn: () => getFoodById(id!),
    enabled: Boolean(id),
  })

  const food = foodQuery.data?.data as DetailedFood | undefined

  const groups: CustomizationGroup[] = Array.isArray(food?.customizations)
    ? food.customizations as CustomizationGroup[]
    : []

  const selectedOptions = groups.flatMap((group) => {
    const option = selections[group.name]
    return option ? [{ group: group.name, option }] : []
  })

  const extraPrice = groups.reduce((total, group) => {
    const selected = group.options.find((option) => option.label === selections[group.name])
    return total + (selected?.extraPrice ?? 0)
  }, 0)

  const addMutation = useMutation({
    mutationFn: () => addCartItem({
      foodItemId: id!,
      quantity,
      selections: selectedOptions,
      instructions: instructions.trim() || undefined,
      replaceCart,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cart'] })
      setMessage('Added to your cart successfully!')
      setReplaceCart(false)
    },
    onError: (error: Error) => {
      setMessage(error.message || 'Could not add this item to your cart.')
    },
  })

  if (foodQuery.isLoading) {
    return (
      <div className="flex items-center justify-center gap-2 py-20 text-gray-500">
        <Loader2 className="h-5 w-5 animate-spin" /> Loading food details...
      </div>
    )
  }

  if (foodQuery.isError || !food) {
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-center text-red-700">
        <p>Could not load this food item.</p>
        <button onClick={() => foodQuery.refetch()} className="mt-3 font-semibold underline">
          Try again
        </button>
        <div className="mt-4">
          <Link to="/customer/explore" className="text-sm underline">Back to Explore Food</Link>
        </div>
      </div>
    )
  }

  const canAdd = food.isAvailable && food.restaurant.isOpen && !addMutation.isPending

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <Link to="/customer/explore" className="inline-flex items-center gap-2 text-sm font-medium text-gray-600 hover:text-emerald-700">
        <ArrowLeft className="h-4 w-4" /> Back to Explore Food
      </Link>

      <div className="grid gap-7 rounded-2xl border border-gray-100 bg-white p-4 shadow-sm md:grid-cols-2 md:p-6">
        <div className="relative min-h-64 overflow-hidden rounded-xl bg-gray-100 md:min-h-96">
          {food.imageUrl ? (
            <img src={food.imageUrl} alt={food.name} className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full min-h-64 items-center justify-center text-gray-400">
              <UtensilsCrossed className="h-16 w-16" />
            </div>
          )}
          {food.isPopular && (
            <span className="absolute left-3 top-3 rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-800">
              Popular
            </span>
          )}
        </div>

        <div className="space-y-5">
          <div>
            <div className="flex items-center gap-2">
              <span className={`rounded-md border p-1 ${food.foodType === 'VEG' ? 'border-green-600' : 'border-red-600'}`}>
                <span className={`block h-2.5 w-2.5 rounded-full ${food.foodType === 'VEG' ? 'bg-green-600' : 'bg-red-600'}`} />
              </span>
              <span className="text-xs font-medium text-gray-500">{food.foodType === 'VEG' ? 'Vegetarian' : 'Non-vegetarian'}</span>
              {food.rating > 0 && (
                <span className="ml-auto flex items-center gap-1 text-sm text-amber-600">
                  <Star className="h-4 w-4 fill-current" /> {food.rating.toFixed(1)} ({food.ratingCount})
                </span>
              )}
            </div>
            <h1 className="mt-3 text-3xl font-bold text-gray-900">{food.name}</h1>
            <p className="mt-2 text-sm leading-6 text-gray-600">{food.description}</p>
            <p className="mt-4 text-2xl font-bold text-emerald-700">
              ₹{Number(food.price).toFixed(2)}
            </p>
          </div>

          <div className="rounded-xl bg-gray-50 p-4">
            <p className="font-semibold text-gray-900">{food.restaurant.name}</p>
            <p className="mt-1 text-sm text-gray-500">
              {food.restaurant.city} · {food.restaurant.deliveryTime} min delivery
            </p>
            <p className="mt-1 text-sm text-gray-500">
              Delivery fee: ₹{Number(food.restaurant.deliveryFee).toFixed(2)}
            </p>
            <p className={`mt-2 text-sm font-medium ${food.restaurant.isOpen ? 'text-emerald-700' : 'text-red-600'}`}>
              {food.restaurant.isOpen ? 'Currently open' : 'Currently closed'}
            </p>
          </div>

          {groups.map((group) => (
            <div key={group.name} className="space-y-2">
              <label className="block text-sm font-semibold text-gray-800">
                {group.name} <span className="font-normal text-gray-400">(Optional)</span>
              </label>
              <select
                value={selections[group.name] ?? ''}
                onChange={(event) => setSelections((previous) => ({
                  ...previous,
                  [group.name]: event.target.value,
                }))}
                className="w-full rounded-xl border border-gray-200 bg-white p-3 text-sm outline-none focus:border-emerald-500"
              >
                <option value="">No selection</option>
                {group.options.map((option) => (
                  <option key={option.label} value={option.label}>
                    {option.label}{option.extraPrice > 0 ? ` (+₹${option.extraPrice})` : ''}
                  </option>
                ))}
              </select>
            </div>
          ))}

          <div>
            <label className="mb-2 block text-sm font-semibold text-gray-800">
              Special instructions (optional)
            </label>
            <textarea
              value={instructions}
              onChange={(event) => setInstructions(event.target.value)}
              maxLength={200}
              rows={2}
              placeholder="Any special requests for the restaurant?"
              className="w-full rounded-xl border border-gray-200 p-3 text-sm outline-none focus:border-emerald-500"
            />
            <p className="mt-1 text-right text-xs text-gray-400">{instructions.length}/200</p>
          </div>

          <div className="flex items-center justify-between gap-4">
            <span className="text-sm font-semibold text-gray-700">Quantity</span>
            <div className="flex items-center gap-4">
              <button
                onClick={() => setQuantity((value) => Math.max(1, value - 1))}
                disabled={quantity <= 1}
                className="rounded-lg border border-gray-200 p-2 disabled:opacity-40"
                aria-label="Decrease quantity"
              >
                <Minus className="h-4 w-4" />
              </button>
              <span className="min-w-5 text-center font-semibold">{quantity}</span>
              <button
                onClick={() => setQuantity((value) => Math.min(20, value + 1))}
                disabled={quantity >= 20}
                className="rounded-lg border border-gray-200 p-2 disabled:opacity-40"
                aria-label="Increase quantity"
              >
                <Plus className="h-4 w-4" />
              </button>
            </div>
          </div>

          <div className="flex items-center justify-between border-t border-gray-100 pt-4">
            <span className="text-sm text-gray-500">Estimated item total</span>
            <span className="text-xl font-bold text-gray-900">
              ₹{((Number(food.price) + extraPrice) * quantity).toFixed(2)}
            </span>
          </div>

          {message && (
            <div className={`rounded-xl p-3 text-sm ${message.includes('successfully') ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>
              {message}
              {!message.includes('successfully') && message.toLowerCase().includes('another restaurant') && (
                <button
                  onClick={() => {
                    setReplaceCart(true)
                    setMessage('')
                  }}
                  className="mt-2 block font-semibold underline"
                >
                  Replace existing cart and add this item
                </button>
              )}
            </div>
          )}

          {replaceCart && (
            <p className="text-sm text-amber-700">
              Your existing cart items will be cleared before this item is added.
            </p>
          )}

          <button
            onClick={() => {
              setMessage('')
              addMutation.mutate()
            }}
            disabled={!canAdd}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-700 px-5 py-3 font-semibold text-white transition hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {addMutation.isPending ? (
              <><Loader2 className="h-5 w-5 animate-spin" /> Adding...</>
            ) : (
              <><ShoppingCart className="h-5 w-5" /> {food.restaurant.isOpen && food.isAvailable ? 'Add to Cart' : 'Currently unavailable'}</>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
