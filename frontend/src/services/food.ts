import { api } from './api'

export interface FoodItem {
  id: string
  restaurantId: string
  categoryId: string
  name: string
  description: string
  price: number
  imageUrl: string
  foodType: 'VEG' | 'NON_VEG'
  rating: number
  ratingCount: number
  isAvailable: boolean
  isPopular: boolean
  customizations?: unknown
  restaurant: {
    id: string
    name: string
  }
  category: {
    name: string
  }
}

export interface FoodFilters {
  q?: string
  restaurantId?: string
  type?: 'VEG' | 'NON_VEG'
  includeUnavailable?: boolean
  page?: number
  limit?: number
}

interface FoodListResponse {
  success: true
  data: FoodItem[]
  meta: {
    page: number
    limit: number
    total: number
    totalPages: number
  }
}

export async function getFoods(
  filters: FoodFilters = {},
  signal?: AbortSignal,
): Promise<FoodListResponse> {
  const query = {
    ...(filters.q ? { q: filters.q } : {}),
    ...(filters.restaurantId ? { restaurantId: filters.restaurantId } : {}),
    ...(filters.type ? { type: filters.type } : {}),
    ...(filters.includeUnavailable ? { includeUnavailable: 'true' } : {}),
    ...(filters.page ? { page: String(filters.page) } : {}),
    ...(filters.limit ? { limit: String(filters.limit) } : {}),
  }

  return api.get<FoodListResponse>('/foods', { query, signal })
}

export async function getFoodById(id: string): Promise<{ success: true; data: FoodItem }> {
  return api.get<{ success: true; data: FoodItem }>(`/foods/${id}`)
}




export interface SaveFoodInput {
  restaurantId?: string
  categoryName: string
  name: string
  description: string
  price: number
  imageUrl: string
  foodType: 'VEG' | 'NON_VEG'
  isAvailable: boolean
  isPopular: boolean
}

export async function createFood(input: SaveFoodInput): Promise<FoodItem> {
  const result = await api.post<{ success: true; data: FoodItem }>('/foods', input)
  return result.data
}

export async function updateFood(
  id: string,
  input: Partial<SaveFoodInput>,
): Promise<FoodItem> {
  const body = Object.fromEntries(Object.entries(input).filter(([key]) => key !== 'restaurantId'))
  const result = await api.put<{ success: true; data: FoodItem }>(`/foods/${id}`, body)
  return result.data
}

export async function deleteFood(id: string): Promise<void> {
  await api.delete(`/foods/${id}`)
}
