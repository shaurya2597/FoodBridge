import { api } from './api'

export type AssistanceStatus = 'OPEN' | 'ASSIGNED' | 'FULFILLED' | 'CLOSED'

export type AssistanceRequirement =
  | 'Cooked meal'
  | 'Dry ration'
  | 'Baby food'
  | 'Drinking water'
  | 'Any food'

export interface AssistanceRequest {
  id: string
  status: AssistanceStatus
  people: number
  requirements: AssistanceRequirement[]
  foodType: 'VEG' | 'NON_VEG' | null
  city: string
  createdAt: string
  location?: string
  notes?: string | null
  name?: string
  phone?: string
  assignedNgoId?: string | null
  assignedNgo?: string | null
  updatedAt?: string
}

export interface CreateAssistanceInput {
  name: string
  phone: string
  people: number
  requirements: AssistanceRequirement[]
  foodType?: 'VEG' | 'NON_VEG'
  location: string
  city: string
  notes?: string
}

interface AssistanceListResponse {
  success: true
  data: AssistanceRequest[]
  meta: {
    page: number
    limit: number
    total: number
    totalPages: number
  }
}

interface AssistanceResponse {
  success: true
  data: AssistanceRequest
}

export interface AssistanceFilters {
  mine?: boolean
  status?: AssistanceStatus
  city?: string
  page?: number
  limit?: number
}

export async function getAssistanceRequests(
  filters: AssistanceFilters = {},
  signal?: AbortSignal,
): Promise<AssistanceListResponse> {
  const params = {
    ...(filters.mine !== undefined ? { mine: String(filters.mine) } : {}),
    ...(filters.status ? { status: filters.status } : {}),
    ...(filters.city ? { city: filters.city } : {}),
    ...(filters.page ? { page: String(filters.page) } : {}),
    ...(filters.limit ? { limit: String(filters.limit) } : {}),
  }

  return api.get<AssistanceListResponse>('/assistance', { query: params, signal })
}

export async function createAssistanceRequest(
  input: CreateAssistanceInput,
): Promise<AssistanceRequest> {
  const response = await api.post<AssistanceResponse>('/assistance', input)
  return response.data
}

export async function updateAssistanceStatus(
  id: string,
  status: AssistanceStatus,
  note?: string,
): Promise<AssistanceRequest> {
  const response = await api.patch<AssistanceResponse>(
    `/assistance/${id}/status`,
    { status, ...(note ? { note } : {}) },
  )

  return response.data
}
