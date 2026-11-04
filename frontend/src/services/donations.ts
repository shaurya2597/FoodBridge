
import { api } from './api'

export type DonationFoodType = 'VEG' | 'NON_VEG'

export type DonationStatus =
  | 'POSTED'
  | 'NGO_REQUESTED'
  | 'ACCEPTED'
  | 'PICKUP_SCHEDULED'
  | 'COLLECTED'
  | 'DISTRIBUTED'
  | 'EXPIRED'
  | 'FLAGGED'
  | 'CANCELLED'

export interface Donation {
  id: string
  foodName: string
  category: string
  quantity: string
  servings: number
  foodType: DonationFoodType
  donorType: 'INDIVIDUAL' | 'RESTAURANT'
  donorName: string
  city: string
  imageUrl: string | null
  preparedAt: string
  availableUntil: string
  isExpired: boolean
  status: DonationStatus
  createdAt: string
  pickupAddress?: string
  latitude?: number | null
  longitude?: number | null
  instructions?: string | null
  pickupScheduledAt?: string | null
  contactPhone?: string | null
  claimedBy?: {
  id: string
  orgName: string
  serviceCity: string
  isVerified: boolean
  contactPhone?: string
  contactEmail?: string
} | null
}

export interface DonationListMeta {
  total: number
  page: number
  limit: number
  totalPages: number
}

export interface DonationFilters {
  page?: number
  limit?: number
  city?: string
  foodType?: DonationFoodType | 'ALL'
  q?: string
  sort?: 'expiry' | 'newest'
  mine?: boolean
  status?: DonationStatus
}

interface DonationListResponse {
  success: true
  data: Donation[]
  meta: DonationListMeta
}

interface DonationResponse {
  success: true
  data: Donation
}

export async function getAvailableDonations(
  filters: DonationFilters = {},
  signal?: AbortSignal,
) {
  const response = await api.get<DonationListResponse>('/donations', {
    query: {
      page: filters.page ?? 1,
      limit: filters.limit ?? 12,
      city: filters.city,
      foodType: filters.foodType === 'ALL' ? undefined : filters.foodType,
      q: filters.q,
      sort: filters.sort ?? 'expiry',
      mine: filters.mine ? 'true' : undefined,
      status: filters.status,
    },
    signal,
  })

  return { donations: response.data, meta: response.meta }
}

export async function requestDonation(
  donationId: string,
  message?: string,
): Promise<Donation> {
  const response = await api.post<DonationResponse>(
    `/donations/${donationId}/request`,
    { message },
  )

  return response.data
}

export interface UpdateDonationStatusInput {
  status: 'POSTED' | 'ACCEPTED' | 'PICKUP_SCHEDULED' | 'COLLECTED' | 'DISTRIBUTED'
  pickupAt?: string
  reason?: string
}

export async function updateDonationStatus(
  donationId: string,
  input: UpdateDonationStatusInput,
): Promise<Donation> {
  const response = await api.patch<DonationResponse>(
    `/donations/${donationId}/status`,
    input,
  )

  return response.data
}
