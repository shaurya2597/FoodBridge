import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Search, Star, UtensilsCrossed, Leaf, Loader2, Heart } from 'lucide-react'
import { saveFood, removeSavedFood, getSavedItems } from '@/services/saved'
import { getFoods, type FoodFilters } from '@/services/food'

export function ExploreFoodPage() {
  const [search, setSearch] = useState('')
  const [foodType, setFoodType] = useState<FoodFilters['type']>()
    const queryClient = useQueryClient()

  const savedQuery = useQuery({
    queryKey: ['customer', 'saved'],
    queryFn: getSavedItems,
  })

  const savedFoodIds = new Set(
    savedQuery.data?.foods.map((food) => food.id) ?? [],
  )

  const saveFoodMutation = useMutation({
    mutationFn: ({ id, saved }: { id: string; saved: boolean }) =>
      saved ? removeSavedFood(id) : saveFood(id),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ['customer', 'saved'] }),
  })

  const foodsQuery = useQuery({
    queryKey: ['foods', search, foodType],
    queryFn: ({ signal }) =>
      getFoods({ q: search.trim() || undefined, type: foodType, page: 1, limit: 30 }, signal),
  })

  const foods = foodsQuery.data?.data ?? []

  return (
    <div className="space-y-6">
      <section className="rounded-2xl bg-gradient-to-r from-emerald-700 to-teal-600 p-6 text-white sm:p-8">
        <p className="text-sm font-semibold text-emerald-100">GOOD FOOD, GOOD MOOD</p>
        <h1 className="mt-2 text-3xl font-bold">Explore delicious food</h1>
        <p className="mt-2 max-w-xl text-sm text-emerald-50">
          Discover meals from restaurants around you and find something you love.
        </p>
      </section>

      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search dishes..."
            className="w-full rounded-xl border border-gray-200 bg-white py-3 pl-10 pr-4 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
          />
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setFoodType(undefined)}
            className={`rounded-xl px-4 py-2 text-sm font-medium ${!foodType ? 'bg-emerald-700 text-white' : 'border border-gray-200 bg-white text-gray-600'}`}
          >
            All
          </button>
          <button
            onClick={() => setFoodType('VEG')}
            className={`rounded-xl px-4 py-2 text-sm font-medium ${foodType === 'VEG' ? 'bg-emerald-700 text-white' : 'border border-gray-200 bg-white text-gray-600'}`}
          >
            Veg
          </button>
          <button
            onClick={() => setFoodType('NON_VEG')}
            className={`rounded-xl px-4 py-2 text-sm font-medium ${foodType === 'NON_VEG' ? 'bg-emerald-700 text-white' : 'border border-gray-200 bg-white text-gray-600'}`}
          >
            Non-veg
          </button>
        </div>
      </div>

      {foodsQuery.isLoading && (
        <div className="flex items-center justify-center gap-2 py-16 text-gray-500">
          <Loader2 className="h-5 w-5 animate-spin" /> Loading delicious food...
        </div>
      )}

      {foodsQuery.isError && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-5 text-sm text-red-700">
          Could not load food items. Please try again.
          <button onClick={() => foodsQuery.refetch()} className="ml-2 font-semibold underline">
            Retry
          </button>
        </div>
      )}

      {!foodsQuery.isLoading && !foodsQuery.isError && foods.length === 0 && (
        <div className="rounded-2xl border border-dashed border-gray-300 py-16 text-center">
          <UtensilsCrossed className="mx-auto h-10 w-10 text-gray-400" />
          <h2 className="mt-3 font-semibold text-gray-800">No food items found</h2>
          <p className="mt-1 text-sm text-gray-500">Try another search or change the food filter.</p>
        </div>
      )}

      {foods.length > 0 && (
        <>
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-gray-900">Available dishes</h2>
            <span className="text-sm text-gray-500">{foodsQuery.data?.meta.total ?? foods.length} items</span>
          </div>
          <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
            {foods.map((food) => (
              <Link to={`/customer/restaurant/${food.restaurant.id}`} className="block"><article key={food.id} className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm transition hover:-translate-y-1 hover:shadow-md">
                <div className="relative h-48 bg-gray-100">
                  {food.imageUrl ? (
                    <img src={food.imageUrl} alt={food.name} className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full items-center justify-center text-gray-400">
                      <UtensilsCrossed className="h-12 w-12" />
                    </div>
                  )}
                  {food.isPopular && (
                    <span className="absolute left-3 top-3 rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-800">
                      Popular
                    </span>
                  )}
                  <button
  type="button"
  aria-label={savedFoodIds.has(food.id) ? 'Remove from saved dishes' : 'Save dish'}
  disabled={saveFoodMutation.isPending}
  onClick={(event) => {
    event.preventDefault()
    event.stopPropagation()
    saveFoodMutation.mutate({
      id: food.id,
      saved: savedFoodIds.has(food.id),
    })
  }}
  className="absolute right-3 top-3 grid size-10 place-items-center rounded-full bg-white shadow-md transition hover:scale-105 disabled:opacity-50"
>
  <Heart
    size={19}
    className={savedFoodIds.has(food.id) ? 'fill-red-500 text-red-500' : 'text-gray-600'}
  />
</button>
                </div>
                <div className="space-y-3 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <h3 className="font-bold text-gray-900">{food.name}</h3>
                    <span className={`shrink-0 rounded-md border p-1 ${food.foodType === 'VEG' ? 'border-green-600' : 'border-red-600'}`}>
                      <span className={`block h-2.5 w-2.5 rounded-full ${food.foodType === 'VEG' ? 'bg-green-600' : 'bg-red-600'}`} />
                    </span>
                  </div>
                  <p className="line-clamp-2 min-h-10 text-sm text-gray-500">{food.description}</p>
                  <div className="flex items-center justify-between text-sm text-gray-500">
                    <span>{food.restaurant?.name ?? 'Restaurant'}</span>
                    <span className="flex items-center gap-1 text-amber-600">
                      <Star className="h-4 w-4 fill-current" />
                      {food.rating > 0 ? food.rating.toFixed(1) : 'New'}
                      {food.ratingCount > 0 ? ` (${food.ratingCount})` : ''}
                    </span>
                  </div>
                  <div className="flex items-center justify-between border-t border-gray-100 pt-3">
                  <span className="text-xl font-bold text-emerald-700">&#8377;{Number(food.price).toFixed(2)}</span>
                    <span className="flex items-center gap-1 text-xs text-emerald-700">
                      <Leaf className="h-4 w-4" /> Available
                    </span>
                  </div>
                </div>
              </article></Link>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
