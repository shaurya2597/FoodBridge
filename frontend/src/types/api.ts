/** The shapes the FoodBridge backend sends back. Keep these in sync with docs/API.md. */

export interface PageMeta {
  total: number
  page: number
  limit: number
  totalPages: number
}

/** Success: { success: true, data, meta? }. Lists include `meta` for pagination. */
export interface ApiSuccess<T> {
  success: true
  data: T
  meta?: PageMeta
  message?: string
}

/** One problem found in a submitted form, e.g. { field: "address.pincode", message: "Enter a valid 6-digit PIN code" }. */
export interface FieldIssue {
  field: string
  message: string
}

export interface ApiFailure {
  success: false
  message: string
  errors?: FieldIssue[]
  details?: unknown
}

/** GET /api/health (note: its fields are at the top level, not inside `data`). */
export interface HealthStatus {
  success: boolean
  status: 'ok' | 'degraded'
  database: 'up' | 'down'
  razorpay: 'test-keys' | 'demo'
  demoPayments: boolean
}
