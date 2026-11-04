import { api } from './api'

export interface AdminDashboard {
  users: {
    total: number
    byRole: Record<string, number>
    blocked: number
  }
  restaurants: {
    total: number
    byStatus: Record<string, number>
    pendingApproval: number
  }
  orders: {
    total: number
    byStatus: Record<string, number>
    last24Hours: number
  }
  revenue: {
    total: number
    currency: string
  }
  donations: {
    active: number
    collectedOrDistributed: number
    servingsDonated: number
  }
  ngos: {
    awaitingVerification: number
  }
  assistance: {
    open: number
  }
  complaints: {
    pending: number
  }
  generatedAt: string
}

interface AdminDashboardResponse {
  success: true
  data: AdminDashboard
}

export async function getAdminDashboard(
  signal?: AbortSignal,
): Promise<AdminDashboard> {
  const result = await api.get<AdminDashboardResponse>(
    '/admin/dashboard',
    { signal },
  )
  return result.data
}
export interface AdminUser {
  id: string
  name: string
  email: string
  phone: string | null
  role: 'CUSTOMER' | 'RESTAURANT_OWNER' | 'NGO' | 'ADMIN'
  isBlocked: boolean
  blockedReason: string | null
  createdAt: string
  ngoProfile: {
    id: string
    orgName: string
    isVerified: boolean
  } | null
}

export interface AdminUsersResponse {
  data: AdminUser[]
  meta: {
    page: number
    limit: number
    total: number
    totalPages: number
  }
}

export interface AdminUserFilters {
  q?: string
  role?: AdminUser['role']
  blocked?: boolean
  page?: number
  limit?: number
}

export async function getAdminUsers(
  filters: AdminUserFilters = {},
  signal?: AbortSignal,
): Promise<AdminUsersResponse> {
  return api.get<AdminUsersResponse>('/admin/users', {
    query: {
      ...filters,
      ...(filters.blocked !== undefined
        ? { blocked: String(filters.blocked) }
        : {}),
    },
    signal,
  })
}

export async function setAdminUserBlocked(
  userId: string,
  blocked: boolean,
  reason?: string,
): Promise<void> {
  await api.patch(`/admin/users/${userId}/block`, {
    blocked,
    ...(reason ? { reason } : {}),
  })
}
export interface AdminRestaurant {
  id: string
  name: string
  slug: string
  description: string
  cuisines: string[]
  imageUrl: string
  address: string
  city: string
  rating: number
  ratingCount: number
  deliveryTime: number
  deliveryFee: string | number
  minOrder: string | number
  priceForTwo: number
  isVegOnly: boolean
  isOpen: boolean
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'SUSPENDED'
  moderationNote: string | null
  createdAt: string
  updatedAt: string
  owner: {
    id: string
    name: string
    email: string
  }
  _count: {
    orders: number
    foods: number
  }
}

export interface AdminRestaurantsResponse {
  data: AdminRestaurant[]
  meta: {
    page: number
    limit: number
    total: number
    totalPages: number
  }
}

export interface AdminRestaurantFilters {
  q?: string
  status?: AdminRestaurant['status']
  city?: string
  page?: number
  limit?: number
}

export async function getAdminRestaurants(
  filters: AdminRestaurantFilters = {},
  signal?: AbortSignal,
): Promise<AdminRestaurantsResponse> {
  return api.get<AdminRestaurantsResponse>('/admin/restaurants', {
    query: { ...filters },
    signal,
  })
}

export async function setAdminRestaurantStatus(
  restaurantId: string,
  status: 'APPROVED' | 'REJECTED' | 'SUSPENDED',
  reason?: string,
): Promise<void> {
  await api.patch(`/admin/restaurants/${restaurantId}/status`, {
    status,
    ...(reason ? { reason } : {}),
  })
}

export type AdminDonationStatus =
  | 'POSTED'
  | 'NGO_REQUESTED'
  | 'ACCEPTED'
  | 'PICKUP_SCHEDULED'
  | 'COLLECTED'
  | 'DISTRIBUTED'
  | 'EXPIRED'
  | 'FLAGGED'
  | 'CANCELLED'

export interface AdminDonation {
  id: string
  foodName: string
  category: string
  quantity: string
  servings: number
  foodType: 'VEG' | 'NON_VEG'
  donorType: 'INDIVIDUAL' | 'RESTAURANT'
  donorName: string
  city: string
  imageUrl: string | null
  preparedAt: string
  availableUntil: string
  isExpired: boolean
  status: AdminDonationStatus
  createdAt: string
  pickupAddress: string
  latitude: number | null
  longitude: number | null
  instructions: string | null
  contactPhone: string
  pickupScheduledAt: string | null
  statusHistory: unknown
  claimedByNgoId: string | null
  updatedAt: string
  claimedBy?: {
    id: string
    orgName: string
    serviceCity: string
    isVerified: boolean
    contactPhone: string
  } | null
  flagReason?: string | null
  requestCount?: number
  requests?: Array<{
    id: string
    status: string
    message: string | null
    createdAt: string
    ngo: {
      id: string
      orgName: string
      isVerified: boolean
    }
  }>
}

export interface AdminDonationsResponse {
  data: AdminDonation[]
  meta: {
    page: number
    limit: number
    total: number
    totalPages: number
  }
}

export interface AdminDonationFilters {
  q?: string
  status?: AdminDonationStatus
  city?: string
  donorType?: 'INDIVIDUAL' | 'RESTAURANT'
  ngoId?: string
  expired?: boolean
  page?: number
  limit?: number
}

export async function getAdminDonations(
  filters: AdminDonationFilters = {},
  signal?: AbortSignal,
): Promise<AdminDonationsResponse> {
  return api.get<AdminDonationsResponse>('/admin/donations', {
    query: {
      ...filters,
      ...(filters.expired !== undefined
        ? { expired: String(filters.expired) }
        : {}),
    },
    signal,
  })
}

export async function getAdminDonationDetail(
  donationId: string,
  signal?: AbortSignal,
): Promise<AdminDonation> {
  return api.get<AdminDonation>(`/admin/donations/${donationId}`, { signal })
}

export async function flagAdminDonation(
  donationId: string,
  reason: string,
): Promise<void> {
  await api.post(`/admin/donations/${donationId}/flag`, { reason })
}

export async function unflagAdminDonation(
  donationId: string,
  reason?: string,
): Promise<void> {
  await api.post(`/admin/donations/${donationId}/unflag`, {
    ...(reason ? { reason } : {}),
  })
}

export type AdminDonationRequestStatus =
  | 'PENDING'
  | 'APPROVED'
  | 'REJECTED'
  | 'WITHDRAWN'

export interface AdminDonationRequest {
  id: string
  status: AdminDonationRequestStatus
  message: string | null
  createdAt: string
  ngo: {
    id: string
    orgName: string
    isVerified: boolean
  }
  donation: {
    id: string
    foodName: string
    status: string
    city: string
    expiresAt: string
    servings: number
  }
}

export interface AdminDonationRequestsResponse {
  data: AdminDonationRequest[]
  meta: {
    page: number
    limit: number
    total: number
    totalPages: number
  }
}

export interface AdminDonationRequestFilters {
  status?: AdminDonationRequestStatus
  ngoId?: string
  page?: number
  limit?: number
}

export async function getAdminDonationRequests(
  filters: AdminDonationRequestFilters = {},
  signal?: AbortSignal,
): Promise<AdminDonationRequestsResponse> {
  return api.get<AdminDonationRequestsResponse>('/admin/donation-requests', {
    query: { ...filters },
    signal,
  })
}

export interface AdminOrder {
  id: string
  orderNumber: string
  status: string
  createdAt: string
  updatedAt: string
  total: number
  subtotal: number
  deliveryFee: number
  tax: number
  platformFee: number
  discount: number
  contactName: string
  contactPhone: string
  restaurant: {
    id: string
    name: string
    imageUrl: string | null
    address: string
    city: string
    deliveryTime: number
  }
  customer: {
    id: string
    name: string
    email: string
    phone: string | null
  }
  items: Array<{
    id: string
    name: string
    quantity: number
    unitPrice: number
    lineTotal: number
  }>
  payment: {
    id: string
    method: string
    status: string
    amount: number
    isDemo: boolean
    paidAt: string | null
    note: string | null
  } | null
}

export interface AdminOrdersResponse {
  data: AdminOrder[]
  meta: {
    page: number
    limit: number
    total: number
    totalPages: number
  }
}

export interface AdminOrderFilters {
  q?: string
  status?: string
  paymentStatus?: string
  paymentMethod?: string
  from?: string
  to?: string
  restaurantId?: string
  userId?: string
  page?: number
  limit?: number
}

export async function getAdminOrders(
  filters: AdminOrderFilters = {},
  signal?: AbortSignal,
): Promise<AdminOrdersResponse> {
  return api.get<AdminOrdersResponse>('/admin/orders', {
    query: { ...filters },
    signal,
  })
}

export async function getAdminOrderDetail(
  id: string,
  signal?: AbortSignal,
): Promise<AdminOrder> {
  const response = await api.get<{ success: boolean; data: AdminOrder }>(
    `/admin/orders/${id}`,
    { signal },
  )
  return response.data
}
export interface AdminNgo {
  id: string
  orgName: string
  registrationNo: string
  serviceCity: string
  isVerified: boolean
  contactPhone: string
  user: {
    id: string
    name: string
    email: string
    isBlocked: boolean
  }
  _count: {
    donations: number
    requests: number
    assistanceRequests: number
  }
}

export interface AdminNgosResponse {
  data: AdminNgo[]
  meta: {
    page: number
    limit: number
    total: number
    totalPages: number
  }
}

export interface AdminNgoFilters {
  q?: string
  verified?: boolean
  page?: number
  limit?: number
}

export async function getAdminNgos(
  filters: AdminNgoFilters = {},
  signal?: AbortSignal,
): Promise<AdminNgosResponse> {
  return api.get<AdminNgosResponse>('/admin/ngos', {
    query: { ...filters },
    signal,
  })
}

export async function setAdminNgoVerification(
  id: string,
  body: { verified: boolean; note?: string },
): Promise<{ success: boolean; data: AdminNgo }> {
  return api.patch<{ success: boolean; data: AdminNgo }>(
    `/admin/ngos/${id}/verification`,
    body,
  )
}
export type AdminComplaintStatus = 'OPEN' | 'IN_REVIEW' | 'RESOLVED' | 'REJECTED'
export type AdminComplaintCategory = 'ORDER' | 'DELIVERY' | 'FOOD_QUALITY' | 'PAYMENT' | 'DONATION' | 'OTHER'

export interface AdminComplaint {
  id: string
  userId: string
  orderId: string | null
  donationId: string | null
  category: AdminComplaintCategory
  subject: string
  details: string
  status: AdminComplaintStatus
  resolution: string | null
  resolvedAt: string | null
  createdAt: string
  updatedAt: string
  user: { id: string; name: string; email: string; role: string }
  order: { id: string; orderNumber: string; status: string; total: number | string } | null
  donation: { id: string; foodName: string; status: string } | null
}

export interface AdminComplaintsResponse {
  data: AdminComplaint[]
  meta: { page: number; limit: number; total: number; totalPages: number }
}

export interface AdminComplaintFilters {
  q?: string
  status?: AdminComplaintStatus
  category?: AdminComplaintCategory
  page?: number
  limit?: number
}

export async function getAdminComplaints(
  filters: AdminComplaintFilters = {},
  signal?: AbortSignal,
): Promise<AdminComplaintsResponse> {
  return api.get<AdminComplaintsResponse>('/admin/complaints', {
    query: { ...filters },
    signal,
  })
}

export async function getAdminComplaintDetail(
  id: string,
  signal?: AbortSignal,
): Promise<AdminComplaint> {
  const response = await api.get<{ success: boolean; data: AdminComplaint }>(
    `/admin/complaints/${id}`,
    { signal },
  )
  return response.data
}

export async function updateAdminComplaint(
  id: string,
  body: { status: Exclude<AdminComplaintStatus, 'OPEN'>; resolution?: string },
): Promise<AdminComplaint> {
  const response = await api.patch<{ success: boolean; data: AdminComplaint }>(
    `/admin/complaints/${id}`,
    body,
  )
  return response.data
}

export interface AdminAuditLog {
  id: string
  adminId: string
  action: string
  entityType: string
  entityId: string
  details: Record<string, unknown> | null
  createdAt: string
  admin: { id: string; name: string }
}

export interface AdminAuditLogsResponse {
  data: AdminAuditLog[]
  meta: { page: number; limit: number; total: number; totalPages: number }
}

export interface AdminAuditLogFilters {
  entityType?: string
  adminId?: string
  page?: number
  limit?: number
}

export async function getAdminAuditLogs(
  filters: AdminAuditLogFilters = {},
  signal?: AbortSignal,
): Promise<AdminAuditLogsResponse> {
  return api.get<AdminAuditLogsResponse>('/admin/audit-logs', {
    query: { ...filters },
    signal,
  })
}

export interface AdminAnalytics {
  range: {
    days: number
    from: string
    to: string
    timezone: string
  }
  ordersOverTime: {
    date: string
    orders: number
    cancelled: number
    revenue: number
  }[]
  revenueTrend: {
    date: string
    revenue: number
  }[]
  totals: {
    orders: number
    revenue: number
  }
  popularRestaurants: {
    restaurantId: string
    name: string
    orders: number
    revenue: number
  }[]
  topFoodItems: {
    foodItemId: string
    name: string
    restaurant: string | null
    quantitySold: number
  }[]
  donations: {
    overTime: {
      date: string
      donations: number
      servingsPosted: number
    }[]
    byStatus: Record<string, number>
    servingsSavedInRange: number
    servingsSavedAllTime: number
  }
  assistance: {
    byStatus: Record<string, number>
  }
  activeUsers: {
    count: number
    windowDays: number
  }
}

export async function getAdminAnalytics(
  days = 30,
  signal?: AbortSignal,
): Promise<AdminAnalytics> {
  const response = await api.get<{ success: boolean; data: AdminAnalytics }>(
    '/admin/analytics',
    { query: { days }, signal },
  )
  return response.data
}