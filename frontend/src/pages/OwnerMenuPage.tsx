import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { UtensilsCrossed, RefreshCw, Store, Plus, Pencil, Trash2 } from 'lucide-react'
import { getMyRestaurants } from '@/services/restaurants'
import { getFoods, createFood, updateFood, deleteFood, type FoodItem, type SaveFoodInput } from '@/services/food'

export function OwnerMenuPage() {
  const [restaurantId, setRestaurantId] = useState('')
  const [editingFood, setEditingFood] = useState<FoodItem | null>(null)
  const [showForm, setShowForm] = useState(false)
  const queryClient = useQueryClient()

  const emptyForm: SaveFoodInput = {
    categoryName: '',
    name: '',
    description: '',
    price: 0,
    imageUrl: '',
    foodType: 'VEG',
    isAvailable: true,
    isPopular: false,
  }

  const [form, setForm] = useState<SaveFoodInput>(emptyForm)

  const saveMutation = useMutation({
    mutationFn: () => editingFood
      ? updateFood(editingFood.id, form)
      : createFood({ ...form, restaurantId: selectedRestaurantId }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['owner-menu', selectedRestaurantId] })
      setShowForm(false)
      setEditingFood(null)
      setForm(emptyForm)
    },
  })

  const deleteMutation = useMutation({
    mutationFn: deleteFood,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['owner-menu', selectedRestaurantId] })
    },
  })

  function openAddForm() {
    setEditingFood(null)
    setForm(emptyForm)
    saveMutation.reset()
    setShowForm(true)
  }

  function openEditForm(food: FoodItem) {
    setEditingFood(food)
    setForm({
      categoryName: food.category?.name ?? '',
      name: food.name,
      description: food.description,
      price: food.price,
      imageUrl: food.imageUrl,
      foodType: food.foodType,
      isAvailable: food.isAvailable,
      isPopular: food.isPopular,
    })
    saveMutation.reset()
    setShowForm(true)
  }

  const restaurantsQuery = useQuery({
    queryKey: ['owner-restaurants'],
    queryFn: getMyRestaurants,
  })

  const restaurants = restaurantsQuery.data ?? []
  const selectedRestaurantId = restaurantId || restaurants[0]?.id || ''

  const foodsQuery = useQuery({
    queryKey: ['owner-menu', selectedRestaurantId],
    queryFn: () => getFoods({
      restaurantId: selectedRestaurantId,
      includeUnavailable: true,
      limit: 50,
    }),
    enabled: Boolean(selectedRestaurantId),
  })

  const foods = foodsQuery.data?.data ?? []

  if (restaurantsQuery.isLoading) {
    return <div className="p-8 text-center text-sm text-slate-500">Loading your restaurants...</div>
  }

  if (restaurantsQuery.isError) {
    return <div className="rounded-2xl border border-red-200 bg-red-50 p-5 text-sm text-red-700">Could not load your restaurants. Please refresh and try again.</div>
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900">Menu management</h1>
          <p className="mt-1 text-sm text-slate-500">Manage food items and availability for your restaurants.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={openAddForm}
            className="inline-flex items-center gap-2 rounded-xl bg-emerald-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-800"
          >
            <Plus size={16} /> Add food
          </button>
          <span className="inline-flex items-center gap-2 rounded-xl bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-800">
          <UtensilsCrossed size={16} /> {foods.length} items
          </span>
        </div>
      </div>

      {restaurants.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center">
          <Store className="mx-auto text-slate-400" size={32} />
          <h2 className="mt-3 font-bold text-slate-900">No restaurants linked to this account</h2>
          <p className="mt-1 text-sm text-slate-500">Contact the administrator to link a restaurant to your owner account.</p>
        </div>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4">
            <label htmlFor="restaurant-select" className="text-sm font-semibold text-slate-700">Restaurant</label>
            <select
              id="restaurant-select"
              value={selectedRestaurantId}
              onChange={(event) => setRestaurantId(event.target.value)}
              className="min-w-56 flex-1 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-emerald-600"
            >
              {restaurants.map((restaurant) => (
                <option key={restaurant.id} value={restaurant.id}>
                  {restaurant.name} ({restaurant.status})
                </option>
              ))}
            </select>
          </div>

          {showForm && (
            <form
              onSubmit={(event) => {
                event.preventDefault()
                saveMutation.mutate()
              }}
              className="space-y-4 rounded-2xl border border-emerald-200 bg-white p-5 shadow-sm"
            >
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-bold text-slate-900">
                  {editingFood ? 'Edit food item' : 'Add food item'}
                </h2>
                <button type="button" onClick={() => setShowForm(false)} className="text-sm font-semibold text-slate-500 hover:text-slate-800">
                  Close
                </button>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <label className="space-y-1 text-sm font-medium text-slate-700">
                  Food name
                  <input required minLength={2} maxLength={100} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="w-full rounded-xl border border-slate-200 px-3 py-2.5" />
                </label>
                <label className="space-y-1 text-sm font-medium text-slate-700">
                  Category
                  <input required minLength={2} maxLength={50} value={form.categoryName} onChange={(e) => setForm({ ...form, categoryName: e.target.value })} placeholder="e.g. Biryani" className="w-full rounded-xl border border-slate-200 px-3 py-2.5" />
                </label>
                <label className="space-y-1 text-sm font-medium text-slate-700">
                  Price (ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¹)
                  <input required type="number" min="0.01" max="10000" step="0.01" value={form.price || ''} onChange={(e) => setForm({ ...form, price: Number(e.target.value) })} className="w-full rounded-xl border border-slate-200 px-3 py-2.5" />
                </label>
                <label className="space-y-1 text-sm font-medium text-slate-700">
                  Food type
                  <select value={form.foodType} onChange={(e) => setForm({ ...form, foodType: e.target.value as 'VEG' | 'NON_VEG' })} className="w-full rounded-xl border border-slate-200 px-3 py-2.5">
                    <option value="VEG">Vegetarian</option>
                    <option value="NON_VEG">Non-vegetarian</option>
                  </select>
                </label>
                <label className="space-y-1 text-sm font-medium text-slate-700 sm:col-span-2">
                  Image URL
                  <input required type="url" value={form.imageUrl} onChange={(e) => setForm({ ...form, imageUrl: e.target.value })} placeholder="https://example.com/food.jpg" className="w-full rounded-xl border border-slate-200 px-3 py-2.5" />
                </label>
                <label className="space-y-1 text-sm font-medium text-slate-700 sm:col-span-2">
                  Description
                  <textarea required minLength={5} maxLength={500} rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="w-full rounded-xl border border-slate-200 px-3 py-2.5" />
                </label>
              </div>

              <div className="flex flex-wrap gap-5 text-sm text-slate-700">
                <label className="flex items-center gap-2">
                  <input type="checkbox" checked={form.isAvailable} onChange={(e) => setForm({ ...form, isAvailable: e.target.checked })} />
                  Available for orders
                </label>
                <label className="flex items-center gap-2">
                  <input type="checkbox" checked={form.isPopular} onChange={(e) => setForm({ ...form, isPopular: e.target.checked })} />
                  Mark as popular
                </label>
              </div>

              {saveMutation.isError && (
                <p className="text-sm text-red-600">Could not save food item. Please check the details and try again.</p>
              )}

              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => setShowForm(false)} className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700">
                  Cancel
                </button>
                <button type="submit" disabled={saveMutation.isPending} className="rounded-xl bg-emerald-700 px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50">
                  {saveMutation.isPending ? 'Saving...' : editingFood ? 'Save changes' : 'Add food'}
                </button>
              </div>
            </form>
          )}
          {foodsQuery.isLoading ? (
            <div className="p-8 text-center text-sm text-slate-500">Loading menu items...</div>
          ) : foodsQuery.isError ? (
            <div className="rounded-2xl border border-red-200 bg-red-50 p-5 text-sm text-red-700">Could not load menu items. Please try again.</div>
          ) : foods.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center">
              <UtensilsCrossed className="mx-auto text-slate-400" size={32} />
              <h2 className="mt-3 font-bold text-slate-900">Your menu is empty</h2>
              <p className="mt-1 text-sm text-slate-500">Add your first food item to get started.</p>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {foods.map((food) => (
                <article key={food.id} className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                  {food.imageUrl && (
                    <img src={food.imageUrl} alt={food.name} className="h-40 w-full object-cover" />
                  )}
                  <div className="space-y-3 p-4">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h2 className="font-bold text-slate-900">{food.name}</h2>
                        <p className="text-xs text-slate-500">{food.category?.name ?? "Uncategorised"} · {food.foodType.replace("_", " ")}</p>
                      </div>
                      <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${food.isAvailable ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-600'}`}>
                        {food.isAvailable ? 'Available' : 'Unavailable'}
                      </span>
                    </div>
                    <p className="line-clamp-2 text-sm text-slate-600">{food.description}</p>
                    <div className="flex items-center justify-between border-t border-slate-100 pt-3">
                      <span className="font-extrabold text-slate-900">₹{food.price}</span>
                      {food.isPopular && <span className="text-xs font-semibold text-amber-700">Popular</span>}
                    </div>
                    <div className="flex gap-2 border-t border-slate-100 pt-3">
                      <button
                        type="button"
                        onClick={() => openEditForm(food)}
                        className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                      >
                        <Pencil size={14} /> Edit
                      </button>
                      <button
                        type="button"
                        disabled={deleteMutation.isPending}
                        onClick={() => {
                          if (window.confirm(`Delete ${food.name} from your menu?`)) {
                            deleteMutation.mutate(food.id)
                          }
                        }}
                        className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl border border-red-200 px-3 py-2 text-sm font-semibold text-red-700 hover:bg-red-50 disabled:opacity-50"
                      >
                        <Trash2 size={14} /> Delete
                      </button>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
        </>
      )}

      <div className="flex justify-end">
        <button
          type="button"
          onClick={() => {
            void restaurantsQuery.refetch()
            void foodsQuery.refetch()
          }}
          className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
        >
          <RefreshCw size={15} /> Refresh
        </button>
      </div>
    </div>
  )
}
