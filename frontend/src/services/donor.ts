import { api } from './api'
import type { Donation, DonationFoodType } from './donations'

export type DonationCategory =
  | 'Cooked meal'
  | 'Bakery'
  | 'Packaged food'
  | 'Fruits & vegetables'
  | 'Beverages'
  | 'Other'

export interface CreateDonationInput {
  foodName: string
  category: DonationCategory
  quantity: string
  servings: number
  foodType: DonationFoodType
  preparedAt: string
  expiresAt: string
  pickupAddress: string
  city: string
  contactPhone: string
  imageUrl?: string
  instructions?: string
  safetyConfirmed: true
}

interface CreateDonationResponse {
  success: true
  data: Donation
}

export async function createFoodDonation(
  input: CreateDonationInput,
): Promise<Donation> {
  const response = await api.post<CreateDonationResponse>(
    '/donations',
    input,
  )
  return response.data
}
