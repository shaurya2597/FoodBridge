import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Heart, MapPin, Clock3, Utensils, Trash2, RefreshCw } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Card, CardContent } from '@/components/ui/card'
import { userMessage } from '@/services/apiError'
import {
  getSavedItems,
  removeSavedRestaurant,
  removeSavedFood,
} from '@/services/saved'

export function SavedPage() {
  const queryClient = useQueryClient()

  const savedQuery = useQuery({
    queryKey: ['customer', 'saved'],
   queryFn: () => getSavedItems(),
    staleTime: 30_000,
  })

  const removeRestaurantMutation = useMutation({
    mutationFn: removeSavedRestaurant,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['customer', 'saved'] }),
  })

  const removeFoodMutation = useMutation({
    mutationFn: removeSavedFood,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['customer', 'saved'] }),
  })

  const restaurants = savedQuery.data?.restaurants ?? []
  const foods = savedQuery.data?.foods ?? []
  const isEmpty = restaurants.length === 0 && foods.length === 0

  return (
    <div className="space-y-8">
      <section className="rounded-[24px] bg-[#123f32] px-6 py-8 text-white shadow-lg sm:px-9">
        <div className="flex items-center gap-3">
          <span className="grid size-12 place-items-center rounded-2xl bg-white/10">
            <Heart size={24} className="text-orange-300" />
          </span>
          <div>
            <p className="text-xs font-semibold uppercase tracking-[.16em] text-emerald-200">
              Your favourites
            </p>
            <h2 className="mt-1 text-3xl font-bold tracking-tight">
              Your saved food
            </h2>
          </div>
        </div>
        <p className="mt-4 max-w-2xl text-sm leading-7 text-emerald-50/80">
          Keep your favourite restaurants and dishes together.
          Revisit them whenever you are ready to order.
        </p>
        <div className="mt-5 flex flex-wrap gap-3 text-xs font-semibold">
          <span className="rounded-full bg-white/10 px-4 py-2">
            {restaurants.length} restaurants
          </span>
          <span className="rounded-full bg-white/10 px-4 py-2">
            {foods.length} dishes
          </span>
        </div>
      </section>

      {savedQuery.isPending && (
        <p className="text-sm text-slate-500" role="status">
          Loading your saved items...
        </p>
      )}

      {savedQuery.isError && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4" role="alert">
          <p className="text-sm font-semibold text-red-800">
            Could not load your saved items.
          </p>
          <p className="mt-1 text-xs text-red-700">
            {userMessage(savedQuery.error)}
          </p>
          <button
            type="button"
            onClick={() => void savedQuery.refetch()}
            className="mt-3 inline-flex items-center gap-2 rounded-lg bg-red-100 px-3 py-2 text-xs font-semibold text-red-800 hover:bg-red-200"
          >
            <RefreshCw size={13} /> Retry
          </button>
        </div>
      )}

      {!savedQuery.isPending && !savedQuery.isError && isEmpty && (
        <Card className="rounded-2xl border-slate-200/80 bg-white shadow-sm">
          <CardContent className="px-5 py-12 text-center">
            <Heart size={36} className="mx-auto text-slate-300" />
            <h3 className="mt-4 text-lg font-bold text-slate-800">
              Nothing saved yet
            </h3>
            <p className="mx-auto mt-2 max-w-md text-sm text-slate-500">
              Save restaurants and dishes you love while exploring FoodBridge.
              They will appear here.
            </p>
            <Link
              to="/customer/explore"
              className="mt-5 inline-flex h-10 items-center rounded-full bg-[#123f32] px-5 text-sm font-semibold text-white hover:bg-emerald-900"
            >
              Explore food
            </Link>
          </CardContent>
        </Card>
      )}

      {restaurants.length > 0 && (
        <section>
          <div className="mb-4">
            <p className="text-xs font-semibold uppercase tracking-[.15em] text-emerald-700">
              Your collection
            </p>
            <h3 className="mt-1 text-xl font-bold text-slate-900">
              Saved restaurants
            </h3>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {restaurants.map((restaurant) => (
              <Card
                key={restaurant.id}
                className="overflow-hidden rounded-2xl border-slate-200/80 bg-white shadow-sm"
              >
                <div className="relative h-40 bg-slate-100">
                  {restaurant.imageUrl ? (
                    <img
                      src={restaurant.imageUrl}
                      alt={restaurant.name}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="grid h-full place-items-center text-slate-300">
                      <Utensils size={32} />
                    </div>
                  )}
                  <button
                    type="button"
                    aria-label={`Remove ${restaurant.name} from saved restaurants`}
                    disabled={removeRestaurantMutation.isPending}
                    onClick={() => removeRestaurantMutation.mutate(restaurant.id)}
                    className="absolute right-3 top-3 grid size-9 place-items-center rounded-full bg-white text-red-500 shadow hover:bg-red-50 disabled:opacity-50"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>

                <CardContent className="p-4">
                  <h4 className="font-bold text-slate-900">
                    {restaurant.name}
                  </h4>
                  <p className="mt-2 flex items-center gap-1 text-xs text-slate-500">
                    <MapPin size={13} />
                    {restaurant.city}
                  </p>
                  <p className="mt-2 flex items-center gap-1 text-xs text-slate-500">
                    <Clock3 size={13} />
                    {restaurant.deliveryTime} min delivery
                  </p>
                  <Link
                    to={`/customer/restaurant/${restaurant.id}`}
                    className="mt-4 inline-flex w-full items-center justify-center rounded-xl bg-emerald-50 px-4 py-2.5 text-sm font-semibold text-emerald-800 hover:bg-emerald-100"
                  >
                    View restaurant
                  </Link>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>
      )}

      {foods.length > 0 && (
        <section>
          <div className="mb-4">
            <p className="text-xs font-semibold uppercase tracking-[.15em] text-emerald-700">
              Your favourites
            </p>
            <h3 className="mt-1 text-xl font-bold text-slate-900">
              Saved dishes
            </h3>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {foods.map((food) => (
              <Card
                key={food.id}
                className="overflow-hidden rounded-2xl border-slate-200/80 bg-white shadow-sm"
              >
                <div className="relative h-40 bg-slate-100">
                  {food.imageUrl ? (
                    <img
                      src={food.imageUrl}
                      alt={food.name}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="grid h-full place-items-center text-slate-300">
                      <Utensils size={32} />
                    </div>
                  )}
                  <button
                    type="button"
                    aria-label={`Remove ${food.name} from saved dishes`}
                    disabled={removeFoodMutation.isPending}
                    onClick={() => removeFoodMutation.mutate(food.id)}
                    className="absolute right-3 top-3 grid size-9 place-items-center rounded-full bg-white text-red-500 shadow hover:bg-red-50 disabled:opacity-50"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>

                <CardContent className="p-4">
                  <h4 className="font-bold text-slate-900">
                    {food.name}
                  </h4>
                  <p className="mt-1 text-xs text-slate-500">
                    {food.restaurant.name} · {food.category.name}
                  </p>
                  <p className="mt-3 text-lg font-bold text-emerald-800">
                    ₹{food.price}
                  </p>
                  <Link
                   to={`/customer/food/${food.id}`}
                    className="mt-4 inline-flex w-full items-center justify-center rounded-xl bg-emerald-50 px-4 py-2.5 text-sm font-semibold text-emerald-800 hover:bg-emerald-100"
                  >
                    View dish
                  </Link>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}