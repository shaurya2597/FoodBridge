import { api } from './api'

export interface OwnerRestaurant {
  id: string
  name: string
  status: string
}

export interface RestaurantFood {
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
}

export interface RestaurantCategory {
  id: string
  name: string
  sortOrder: number
  foods: RestaurantFood[]
}

export interface RestaurantDetails {
  id: string
  name: string
  description: string
  cuisines: string[]
  imageUrl: string
  bannerUrl: string | null
  address: string
  city: string
  rating: number
  ratingCount: number
  deliveryTime: number
  deliveryFee: number
  minOrder: number
  priceForTwo: number
  isVegOnly: boolean
  isOpen: boolean
  opensAt: string
  closesAt: string
  categories: RestaurantCategory[]
}

interface OwnerRestaurantsResponse {
  success: true
  data: OwnerRestaurant[]
}

export async function getMyRestaurants(): Promise<OwnerRestaurant[]> {
  const result = await api.get<OwnerRestaurantsResponse>('/restaurants/mine')
  return result.data
}

export async function getRestaurantById(
  id: string,
): Promise<{ success: true; data: RestaurantDetails }> {
  return api.get<{ success: true; data: RestaurantDetails }>(`/restaurants/${id}`)
}