import { api } from './api'

export interface SavedRestaurant {
  id: string
  name: string
  slug: string
  imageUrl: string
  city: string
  isOpen: boolean
  deliveryTime: number
  deliveryFee: number
  minOrder: number
  rating: number
  savedAt: string
}

export interface SavedFoodItem {
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
  savedAt: string
  restaurant: {
    id: string
    name: string
    slug: string
    imageUrl: string
    city: string
    isOpen: boolean
    deliveryTime: number
    deliveryFee: number
    minOrder: number
  }
  category: {
    id: string
    name: string
  }
}

export interface SavedItems {
  restaurants: SavedRestaurant[]
  foods: SavedFoodItem[]
}

interface SavedResponse {
  success: true
  data: SavedItems
}

interface SavedActionResponse {
  success: true
  data: { saved: boolean }
}

export async function getSavedItems(): Promise<SavedItems> {
  const result = await api.get<SavedResponse>('/saved')
  return result.data
}

export async function saveRestaurant(id: string): Promise<void> {
  await api.post<SavedActionResponse>(`/saved/restaurants/${id}`)
}

export async function removeSavedRestaurant(id: string): Promise<void> {
  await api.delete<SavedActionResponse>(`/saved/restaurants/${id}`)
}

export async function saveFood(id: string): Promise<void> {
  await api.post<SavedActionResponse>(`/saved/foods/${id}`)
}

export async function removeSavedFood(id: string): Promise<void> {
  await api.delete<SavedActionResponse>(`/saved/foods/${id}`)
}