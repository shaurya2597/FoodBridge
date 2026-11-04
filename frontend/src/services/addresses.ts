import { api } from './api'

export interface Address {
  id: string
  userId: string
  label: string
  line1: string
  line2: string | null
  city: string
  state: string
  pincode: string
  isDefault: boolean
  createdAt: string
  updatedAt: string
}

export interface AddressInput {
  label?: string
  line1: string
  line2?: string
  city: string
  state: string
  pincode: string
  isDefault?: boolean
}

interface AddressListResponse {
  success: true
  data: Address[]
}

interface AddressResponse {
  success: true
  data: Address
}

export async function getAddresses(signal?: AbortSignal): Promise<Address[]> {
  const response = await api.get<AddressListResponse>('/addresses', { signal })
  return response.data
}

export async function createAddress(input: AddressInput): Promise<Address> {
  const response = await api.post<AddressResponse>('/addresses', input)
  return response.data
}

export async function updateAddress(
  id: string,
  input: Partial<AddressInput>,
): Promise<Address> {
  const response = await api.put<AddressResponse>(`/addresses/${id}`, input)
  return response.data
}

export async function deleteAddress(id: string): Promise<void> {
  await api.delete('/addresses/' + id)
}
