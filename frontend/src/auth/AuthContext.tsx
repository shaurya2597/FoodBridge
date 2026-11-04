import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { api, onSessionExpired } from '@/services/api'
import { tokenStore } from '@/services/tokenStorage'
import { queryClient } from '@/services/queryClient'

export type UserRole = 'CUSTOMER' | 'RESTAURANT_OWNER' | 'NGO' | 'ADMIN'

export interface NgoProfile {
  id: string
  userId: string
  orgName: string
  registrationNo: string | null
  contactEmail: string
  contactPhone: string
  serviceCity: string
  serviceArea: string | null
  description: string | null
  isVerified: boolean
  createdAt: string
  updatedAt: string
}

export interface AuthUser {
  id: string
  name: string
  email: string
  phone: string | null
  role: UserRole
  ngoProfile?: NgoProfile | null
  addresses?: unknown[]
}
type AuthResponse = { success: true; data: { token: string; user: AuthUser } }
type AuthContextValue = {
  user: AuthUser | null
  loading: boolean
  login: (email: string, password: string) => Promise<void>
  register: (input: Record<string, unknown>) => Promise<void>
  logout: () => Promise<void>
  refreshUser: () => Promise<void>
}
const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [loading, setLoading] = useState(true)

  const refreshUser = useCallback(async () => {
    if (!tokenStore.getToken()) { setUser(null); setLoading(false); return }
    try {
      const result = await api.get<{ success: true; data: AuthUser }>('/auth/me')
      setUser(result.data)
    } catch {
      tokenStore.clearToken()
      setUser(null)
    } finally { setLoading(false) }
  }, [])

  useEffect(() => {
    // Defer session restoration until after the effect setup completes.
    // This avoids a synchronous state update during the effect body.
    void Promise.resolve().then(refreshUser)
    const unsubscribe = onSessionExpired(() => { setUser(null); setLoading(false); queryClient.clear() })
    return unsubscribe
  }, [refreshUser])

  const acceptAuth = useCallback((result: AuthResponse) => {
    if (!tokenStore.setToken(result.data.token)) throw new Error('The server returned an invalid session token. Please try again.')
    setUser(result.data.user)
    queryClient.clear()
  }, [])

  const login = useCallback(async (email: string, password: string) => {
    const result = await api.post<AuthResponse>('/auth/login', { email, password }, { auth: false })
    acceptAuth(result)
  }, [acceptAuth])

  const register = useCallback(async (input: Record<string, unknown>) => {
    const result = await api.post<AuthResponse>('/auth/register', input, { auth: false })
    acceptAuth(result)
  }, [acceptAuth])

  const logout = useCallback(async () => {
    try { if (tokenStore.getToken()) await api.post('/auth/logout') } catch { /* Local sign-out must still complete. */ }
    tokenStore.clearToken()
    setUser(null)
    queryClient.clear()
  }, [])

  const value = useMemo(() => ({ user, loading, login, register, logout, refreshUser }), [user, loading, login, register, logout, refreshUser])
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const value = useContext(AuthContext)
  if (!value) throw new Error('useAuth must be used inside AuthProvider')
  return value
}
