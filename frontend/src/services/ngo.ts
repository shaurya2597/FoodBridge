import { api } from './api'

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

export interface NgoSummary {
  profile: {
    id: string
    orgName: string
    isVerified: boolean
  }
  donationsByStatus: Partial<Record<DonationStatus, number>>
  servingsCollected: number
}

interface NgoSummaryResponse {
  success: true
  data: NgoSummary
}

export async function getNgoSummary(signal?: AbortSignal): Promise<NgoSummary> {
  const response = await api.get<NgoSummaryResponse>('/ngo/summary', { signal })
  return response.data
}
