import { MyOrdersPage } from './pages/MyOrdersPage'
import { OrderDetailsPage } from './pages/OrderDetailsPage'
import { CustomerDonationsPage } from './pages/CustomerDonationsPage'
import { NGOPickupsPage } from './pages/NGOPickupsPage'
import { NGOBeneficiariesPage } from './pages/NGOBeneficiariesPage'
import { createBrowserRouter, Navigate } from 'react-router-dom'
import { useAuth } from './auth/AuthContext'
import { RequireAuth, homeForRole } from './components/auth/RequireAuth'
import { AppLayout } from './components/layout/AppLayout'
import { NotFoundPage } from './pages/NotFoundPage'
import { RouteErrorPage } from './pages/RouteErrorPage'
import { WorkspacePage } from './pages/WorkspacePage'
import { CustomerDonatePage } from './pages/CustomerDonatePage'
import { NGODonationsPage } from './pages/NGODonationsPage'
import { AuthPage } from './pages/AuthPage'
import { ForgotPasswordPage, ResetPasswordPage } from './pages/PasswordPages'
import { OwnerOrdersPage } from './pages/OwnerOrdersPage'
import { CustomerAssistancePage } from './pages/CustomerAssistancePage'
import { CustomerAssistanceRequestsPage } from './pages/CustomerAssistanceRequestsPage'
import { AdminAnalyticsPage } from './pages/AdminAnalyticsPage'
import { AdminAuditLogsPage } from './pages/AdminAuditLogsPage'
import { AdminComplaintsPage } from './pages/AdminComplaintsPage'
import { AdminDashboardPage } from './pages/AdminDashboardPage'
import { AdminDonationsPage } from './pages/AdminDonationsPage'
import { AdminNgosPage } from './pages/AdminNgosPage'
import { AdminOrdersPage } from './pages/AdminOrdersPage'
import { AdminRestaurantsPage } from './pages/AdminRestaurantsPage'
import { AdminUsersPage } from './pages/AdminUsersPage'
import AdminDonationRequestsPage from './pages/AdminDonationRequestsPage'
import { ExploreFoodPage } from './pages/ExploreFoodPage'
import { CartPage } from './pages/CartPage'
import { RestaurantDetailsPage } from './pages/RestaurantDetailsPage'
import { SavedPage } from './pages/SavedPage'
import { FoodDetailsPage } from './pages/FoodDetailsPage'

function HomeRedirect() {
  const { user, loading } = useAuth()
  if (loading) return <main className="grid min-h-screen place-items-center text-sm text-slate-500">Loading FoodBridge...</main>
  return <Navigate to={user ? homeForRole(user.role) : '/login'} replace />
}

export const router = createBrowserRouter([
  { path: '/login', element: <AuthPage mode="login" />, errorElement: <RouteErrorPage /> },
  { path: '/register', element: <AuthPage mode="register" />, errorElement: <RouteErrorPage /> },
  { path: '/forgot-password', element: <ForgotPasswordPage />, errorElement: <RouteErrorPage /> },
  { path: '/reset-password', element: <ResetPasswordPage />, errorElement: <RouteErrorPage /> },
  { element: <RequireAuth />, errorElement: <RouteErrorPage />, children: [
    { path: '/', element: <HomeRedirect /> },
  {
  element: <RequireAuth roles={['CUSTOMER']} />,
  children: [
    { path: '/customer/donate', element: <AppLayout><CustomerDonatePage /></AppLayout> },
    { path: '/customer/donations', element: <AppLayout><CustomerDonationsPage /></AppLayout> },
    { path: '/customer/orders', element: <AppLayout><MyOrdersPage /></AppLayout> },
    { path: '/customer/orders/:id', element: <AppLayout><OrderDetailsPage /></AppLayout> },
    { path: '/customer/assistance', element: <AppLayout><CustomerAssistancePage /></AppLayout> },
    { path: '/customer/assistance/requests', element: <AppLayout><CustomerAssistanceRequestsPage /></AppLayout> },
{ path: '/customer/explore', element: <AppLayout><ExploreFoodPage /></AppLayout> },
{ path: '/customer/food/:id', element: <AppLayout><FoodDetailsPage /></AppLayout> },
{ path: '/customer/cart', element: <AppLayout><CartPage /></AppLayout> },
{ path: '/customer/saved', element: <AppLayout><SavedPage /></AppLayout> },
{ path: '/customer/restaurant/:id', element: <AppLayout><RestaurantDetailsPage /></AppLayout> },
    { path: '/customer/*', element: <AppLayout><WorkspacePage role="customer" /></AppLayout> },
  ],
},
    {
  element: <RequireAuth roles={['RESTAURANT_OWNER']} />,
  children: [
    { path: '/owner/orders', element: <AppLayout><OwnerOrdersPage /></AppLayout> },
    { path: '/owner/*', element: <AppLayout><WorkspacePage role="owner" /></AppLayout> },
  ],
},

    { element: <RequireAuth roles={['NGO']} />, children: [
  { path: '/ngo/donations', element: <AppLayout><NGODonationsPage /></AppLayout> },
  { path: '/ngo/pickups', element: <AppLayout><NGOPickupsPage /></AppLayout> },
  { path: '/ngo/beneficiaries', element: <AppLayout><NGOBeneficiariesPage /></AppLayout> },
  { path: '/ngo/*', element: <AppLayout><WorkspacePage role="ngo" /></AppLayout> },
] },

   {
  element: <RequireAuth roles={['ADMIN']} />,
  children: [
    { path: '/admin', element: <AppLayout><AdminDashboardPage /></AppLayout> },
    { path: '/admin/users', element: <AppLayout><AdminUsersPage /></AppLayout> },
    { path: '/admin/restaurants', element: <AppLayout><AdminRestaurantsPage /></AppLayout> },
    { path: '/admin/analytics', element: <AppLayout><AdminAnalyticsPage /></AppLayout> },
    { path: '/admin/audit-logs', element: <AppLayout><AdminAuditLogsPage /></AppLayout> },
    { path: '/admin/complaints', element: <AppLayout><AdminComplaintsPage /></AppLayout> },
    { path: '/admin/ngos', element: <AppLayout><AdminNgosPage /></AppLayout> },
    { path: '/admin/orders', element: <AppLayout><AdminOrdersPage /></AppLayout> },
    { path: '/admin/donations', element: <AppLayout><AdminDonationsPage /></AppLayout> },
    { path: '/admin/donation-requests', element: <AppLayout><AdminDonationRequestsPage /></AppLayout> },
    { path: '/admin/*', element: <AppLayout><WorkspacePage role="admin" /></AppLayout> },
  ],
},
  ] },
  { path: '*', element: <NotFoundPage /> },
])
