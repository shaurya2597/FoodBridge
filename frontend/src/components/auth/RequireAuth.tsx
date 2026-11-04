import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth, type UserRole } from '@/auth/AuthContext'

export function homeForRole(role: UserRole) {
  if (role === 'RESTAURANT_OWNER') return '/owner'
  if (role === 'NGO') return '/ngo'
  if (role === 'ADMIN') return '/admin'
  return '/customer'
}

export function RequireAuth({ roles }: { roles?: UserRole[] }) {
  const { user, loading } = useAuth()
  const location = useLocation()
  if (loading) return <main className="grid min-h-screen place-items-center bg-[#f7f8f5] text-sm text-slate-500">Restoring your FoodBridge session…</main>
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />
  if (roles && !roles.includes(user.role)) return <Navigate to={homeForRole(user.role)} replace />
  return <Outlet />
}
