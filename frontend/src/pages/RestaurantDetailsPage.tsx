import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, Clock, Loader2, MapPin, ShoppingCart, Star, UtensilsCrossed } from 'lucide-react'
import { getRestaurantById } from '@/services/restaurants'
import { addCartItem } from '@/services/cart'

export function RestaurantDetailsPage() {
  const { id } = useParams<{ id: string }>()
  const queryClient = useQueryClient()
  const [message, setMessage] = useState('')

  const restaurantQuery = useQuery({
    queryKey: ['restaurant', id],
    queryFn: () => getRestaurantById(id!),
    enabled: Boolean(id),
  })

  const restaurant = restaurantQuery.data?.data

  const addMutation = useMutation({
    mutationFn: (foodItemId: string) => addCartItem({ foodItemId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cart'] })
      setMessage('Item added to your cart successfully!')
    },
    onError: (error: Error) => {
      setMessage(error.message || 'Could not add this item to your cart.')
    },
  })

  if (restaurantQuery.isLoading) {
    return (
      <div className="flex items-center justify-center gap-2 py-20 text-gray-500">
        <Loader2 className="h-5 w-5 animate-spin" /> Loading restaurant...
      </div>
    )
  }

  if (restaurantQuery.isError || !restaurant) {
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-center text-red-700">
        <p>Could not load this restaurant.</p>
        <button onClick={() => restaurantQuery.refetch()} className="mt-3 font-semibold underline">
          Try again
        </button>
        <div className="mt-4">
          <Link to="/customer/explore" className="text-sm underline">Back to Explore Food</Link>
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <Link to="/customer/explore" className="inline-flex items-center gap-2 text-sm font-medium text-gray-600 hover:text-emerald-700">
        <ArrowLeft className="h-4 w-4" /> Back to Explore Food
      </Link>

      <section className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
        <div className="relative h-52 bg-gray-100 sm:h-72">
          {restaurant.bannerUrl || restaurant.imageUrl ? (
            <img
              src={restaurant.bannerUrl || restaurant.imageUrl}
              alt={restaurant.name}
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="flex h-full items-center justify-center text-gray-400">
              <UtensilsCrossed className="h-16 w-16" />
            </div>
          )}
          <span className={`absolute right-4 top-4 rounded-full px-3 py-1 text-sm font-semibold ${restaurant.isOpen ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-700'}`}>
            {restaurant.isOpen ? 'Open' : 'Closed'}
          </span>
        </div>

        <div className="space-y-4 p-5 sm:p-7">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">{restaurant.name}</h1>
            <p className="mt-2 text-sm leading-6 text-gray-600">{restaurant.description}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {restaurant.cuisines.map((cuisine) => (
                <span key={cuisine} className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-800">
                  {cuisine}
                </span>
              ))}
              {restaurant.isVegOnly && (
                <span className="rounded-full bg-green-50 px-3 py-1 text-xs font-medium text-green-800">
                  Pure vegetarian
                </span>
              )}
            </div>
          </div>

          <div className="grid gap-3 border-t border-gray-100 pt-4 text-sm text-gray-600 sm:grid-cols-2 lg:grid-cols-4">
            <div className="flex items-center gap-2">
              <Star className="h-4 w-4 text-amber-500" />
              <span>{restaurant.rating > 0 ? `${restaurant.rating.toFixed(1)} (${restaurant.ratingCount} ratings)` : 'New restaurant'}</span>
            </div>
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-emerald-700" />
              <span>{restaurant.deliveryTime} min delivery</span>
            </div>
            <div className="flex items-center gap-2">
              <MapPin className="h-4 w-4 text-emerald-700" />
              <span>{restaurant.address}, {restaurant.city}</span>
            </div>
            <div>
              Delivery fee: ₹{Number(restaurant.deliveryFee).toFixed(2)}
            </div>
          </div>
          <p className="text-xs text-gray-500">
            Minimum order: ₹{Number(restaurant.minOrder).toFixed(2)} · Price for two: ₹{restaurant.priceForTwo}
          </p>
        </div>
      </section>

      <section className="space-y-5">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Menu</h2>
          <p className="mt-1 text-sm text-gray-500">Explore dishes from {restaurant.name}</p>
        </div>

        {message && (
          <div className={`rounded-xl p-3 text-sm ${message.includes('successfully') ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>
            {message}
          </div>
        )}

        {restaurant.categories.length === 0 && (
          <div className="rounded-xl border border-gray-200 bg-white p-8 text-center text-gray-500">
            No menu categories are available yet.
          </div>
        )}

        {restaurant.categories.map((category) => (
          <div key={category.id} className="space-y-3">
            <h3 className="text-lg font-bold text-gray-800">{category.name}</h3>
            {category.foods.length === 0 ? (
              <p className="text-sm text-gray-500">No dishes available in this category.</p>
            ) : (
              <div className="grid gap-4 md:grid-cols-2">
                {category.foods.map((food) => (
                  <article key={food.id} className="flex gap-4 rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
                    <div className="h-28 w-28 shrink-0 overflow-hidden rounded-xl bg-gray-100">
                      {food.imageUrl ? (
                        <img src={food.imageUrl} alt={food.name} className="h-full w-full object-cover" />
                      ) : (
                        <div className="flex h-full items-center justify-center text-gray-400">
                          <UtensilsCrossed className="h-8 w-8" />
                        </div>
                      )}
                    </div>
                    <div className="flex min-w-0 flex-1 flex-col">
                      <div className="flex items-center gap-2">
                        <span className={`h-3 w-3 shrink-0 rounded-full ${food.foodType === 'VEG' ? 'bg-green-600' : 'bg-red-600'}`} />
                        {food.isPopular && (
                          <span className="text-xs font-semibold text-amber-700">Popular</span>
                        )}
                      </div>
                      <h4 className="mt-1 font-semibold text-gray-900">{food.name}</h4>
                      <p className="mt-1 line-clamp-2 text-xs text-gray-500">{food.description}</p>
                      <div className="mt-auto flex items-center justify-between gap-2 pt-3">
                        <span className="font-bold text-gray-900">₹{Number(food.price).toFixed(2)}</span>
                        <button
                          onClick={() => {
                            setMessage('')
                            addMutation.mutate(food.id)
                          }}
                          disabled={!restaurant.isOpen || !food.isAvailable || addMutation.isPending}
                          className="inline-flex items-center gap-1 rounded-lg bg-emerald-700 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          {addMutation.isPending && addMutation.variables === food.id ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : (
                            <ShoppingCart className="h-3 w-3" />
                          )}
                          {food.isAvailable && restaurant.isOpen ? 'Add' : 'Unavailable'}
                        </button>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </div>
        ))}
      </section>
    </div>
  )
}