import { api } from './api'

export interface CustomerOrder {
  id: string
  orderNumber: string
  status: string
  total: number
  createdAt: string
  estimatedAt: string
  restaurant: {
    id: string
    name: string
    imageUrl: string | null
    city: string
  }
  items: {
    id: string
    name: string
    quantity: number
    unitPrice: number
    lineTotal: number
  }[]
  payment?: {
    method: string
    status: string
    amount: number
  } | null
}

export interface OrderFilters {
  active?: boolean
  status?: string
  page?: number
  limit?: number
}

interface OrderListResponse {
  success: true
  data: CustomerOrder[]
  meta: {
    page: number
    limit: number
    total: number
    totalPages: number
  }
}

export async function getOrders(
  filters: OrderFilters = {},
  signal?: AbortSignal,
): Promise<OrderListResponse> {
  const query = {
    ...(filters.active !== undefined
      ? { active: String(filters.active) }
      : {}),
    ...(filters.status ? { status: filters.status } : {}),
    ...(filters.page ? { page: String(filters.page) } : {}),
    ...(filters.limit ? { limit: String(filters.limit) } : {}),
  }

  return api.get<OrderListResponse>('/orders', { query, signal })
}
export async function getOrderById(
  orderId: string,
  signal?: AbortSignal,
): Promise<{ success: true; data: CustomerOrder }> {
  return api.get<{ success: true; data: CustomerOrder }>(
    `/orders/${orderId}`,
    { signal },
  )
}

export async function cancelOrder(
  orderId: string,
  reason?: string,
): Promise<{ success: true; message?: string }> {
  return api.post<{ success: true; message?: string }>(
    `/orders/${orderId}/cancel`,
    reason ? { reason } : {},
  )
}

export interface PlaceOrderInput {
  addressId?: string
  address?: {
    label?: string
    line1: string
    line2?: string
    city: string
    state: string
    pincode: string
  }
  saveAddress?: boolean
  contactName: string
  contactPhone: string
  instructions?: string
  couponCode?: string
  paymentMethod: 'COD' | 'UPI' | 'RAZORPAY'
}

export interface PlaceOrderResponse {
  success: true
  data: CustomerOrder
  next?: {
    action: 'NONE' | 'PAY_ONLINE'
    endpoint?: string
  }
}

export async function placeOrder(
  input: PlaceOrderInput,
): Promise<PlaceOrderResponse> {
  return api.post<PlaceOrderResponse>('/orders', input)
}

export async function updateOrderStatus(
  orderId: string,
  status: string,
  reason?: string,
): Promise<{ success: true; data: CustomerOrder }> {
  return api.patch<{ success: true; data: CustomerOrder }>(
    `/orders/${orderId}/status`,
    { status, ...(reason ? { reason } : {}) },
  )
}
