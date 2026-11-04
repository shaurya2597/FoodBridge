import { useState, type ReactNode } from 'react'
import { useAuth } from '@/auth/AuthContext'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { Activity, ArrowRight, Bell, ClipboardList, HeartHandshake, LayoutDashboard, Leaf, Menu, Package, Settings, ShoppingBag, Store, Users, UtensilsCrossed, X } from 'lucide-react'

const roleLinks = {
 customer: [{ label: 'Overview', to: '/customer', icon: LayoutDashboard }, { label: 'Explore food', to: '/customer/explore', icon: UtensilsCrossed }, { label: 'Cart', to: '/customer/cart', icon: ShoppingBag }, { label: 'My orders', to: '/customer/orders', icon: Package }, { label: 'Saved', to: '/customer/saved', icon: HeartHandshake }, { label: 'Donate Food', to: '/customer/donate', icon: Leaf }, { label: 'My Donations', to: '/customer/donations', icon: HeartHandshake }, { label: 'Request Food Help', to: '/customer/assistance', icon: HeartHandshake }, { label: 'My Assistance Requests', to: '/customer/assistance/requests', icon: Users }],
  owner: [{ label: 'Overview', to: '/owner', icon: LayoutDashboard }, { label: 'My restaurant', to: '/owner/restaurant', icon: Store }, { label: 'Orders', to: '/owner/orders', icon: ShoppingBag }, { label: 'Menu', to: '/owner/menu', icon: UtensilsCrossed }],
  ngo: [{ label: 'Overview', to: '/ngo', icon: LayoutDashboard }, { label: 'Find donations', to: '/ngo/donations', icon: HeartHandshake }, { label: 'My pickups', to: '/ngo/pickups', icon: Package }, { label: 'Beneficiaries', to: '/ngo/beneficiaries', icon: Users }],
  admin: [{ label: 'Overview', to: '/admin', icon: LayoutDashboard }, { label: 'Users', to: '/admin/users', icon: Users }, { label: 'Restaurants', to: '/admin/restaurants', icon: Store }, { label: 'Analytics', to: '/admin/analytics', icon: Activity }, { label: 'Audit Logs', to: '/admin/audit-logs', icon: ClipboardList }, { label: 'Complaints', to: '/admin/complaints', icon: Bell }, { label: 'NGOs', to: '/admin/ngos', icon: Users }, { label: 'Orders', to: '/admin/orders', icon: ShoppingBag }, { label: 'Donations', to: '/admin/donations', icon: HeartHandshake }, { label: 'Donation Requests', to: '/admin/donation-requests', icon: ClipboardList }],
}
const roleNames = { customer: 'Customer space', owner: 'Restaurant space', ngo: 'NGO space', admin: 'Admin space' }

export function AppLayout({ children }: { children: ReactNode }) {
  const { user, logout } = useAuth()
  const [mobileOpen, setMobileOpen] = useState(false)
  const location = useLocation()
  const role = location.pathname.startsWith('/owner') ? 'owner' : location.pathname.startsWith('/ngo') ? 'ngo' : location.pathname.startsWith('/admin') ? 'admin' : 'customer'
  const links = roleLinks[role]

 return <div className="min-h-screen bg-[#f7f8f5] text-slate-900">
  <header className="sticky top-0 z-40 border-b border-slate-200/80 bg-white/90 backdrop-blur-xl">
    <div className="mx-auto flex h-[72px] max-w-[1440px] items-center gap-5 px-4 sm:px-6 lg:px-8">
      <button className="rounded-xl p-2 text-slate-600 hover:bg-slate-100 lg:hidden" aria-label="Open navigation" onClick={() => setMobileOpen(true)}>
        <Menu size={21}/>
      </button>

      <NavLink to="/" className="flex shrink-0 items-center gap-2.5">
        <span className="grid size-10 place-items-center rounded-2xl bg-emerald-700 text-white shadow-sm"><Leaf size={22}/></span>
        <span className="text-[21px] font-extrabold tracking-tight">food<span className="text-emerald-700">bridge</span><span className="ml-1 align-top text-[10px] font-bold text-orange-500">.</span></span>
      </NavLink>


      <div className="ml-auto flex items-center gap-2 sm:gap-3">
        <button aria-label="Notifications" className="relative rounded-full p-2.5 text-slate-600 hover:bg-slate-100">
          <Bell size={19}/>
          <span className="absolute right-2 top-2 size-2 rounded-full bg-orange-500 ring-2 ring-white"/>
        </button>

        <div className="hidden h-8 w-px bg-slate-200 sm:block"/>

        <div className="flex items-center gap-2">
          <div className="hidden text-right sm:block">
            <span className="block max-w-36 truncate text-xs font-semibold">{user?.name ?? 'Account'}</span>
            <span className="block text-[11px] text-slate-500">
              {user?.role === 'RESTAURANT_OWNER' ? 'Restaurant owner' : user?.role ?? 'Signed in'}
            </span>

            {user?.role === 'NGO' && (
              <span className={`mt-1 inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                user.ngoProfile?.isVerified
                  ? 'bg-emerald-100 text-emerald-800'
                  : 'bg-amber-100 text-amber-800'
              }`}>
                {user.ngoProfile?.isVerified ? '├ó┼ôΓÇ£ Verified NGO' : '├ó┬Å┬│ Verification pending'}
              </span>
            )}
          </div>

          <span className="grid size-9 place-items-center rounded-full bg-orange-100 text-sm font-bold text-orange-800">
            {user?.name?.slice(0,1).toUpperCase() ?? 'U'}
          </span>

          <button type="button" onClick={() => void logout()} className="rounded-full px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100">
            Sign out
          </button>
        </div>
      </div>
    </div>
    </header>

    <div className="mx-auto flex max-w-[1440px]">
      <aside className="sticky top-[72px] hidden h-[calc(100vh-72px)] w-[248px] shrink-0 flex-col border-r border-slate-200/80 bg-white px-4 py-6 lg:flex">
        <p className="px-3 text-[10px] font-bold uppercase tracking-[.16em] text-slate-400">Workspace</p>
        <div className="mt-3 rounded-2xl bg-emerald-50 px-3 py-3"><p className="text-xs font-semibold text-emerald-900">{roleNames[role]}</p><p className="mt-1 text-[11px] text-emerald-700">Your FoodBridge hub</p></div>
        <nav className="mt-5 space-y-1" aria-label="Main navigation">{links.map(({ label, to, icon: Icon }) => <NavLink key={to} to={to} end={to === `/${role}`} className={({ isActive }) => `flex items-center gap-3 rounded-xl px-3 py-2.5 text-[13px] font-medium transition ${isActive ? 'bg-emerald-700 text-white shadow-sm shadow-emerald-900/10' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'}`}><Icon size={17}/>{label}</NavLink>)}</nav>
        <div className="mt-auto rounded-2xl bg-[#fff5e9] p-4"><div className="grid size-9 place-items-center rounded-xl bg-orange-100 text-orange-700"><HeartHandshake size={18}/></div><p className="mt-3 text-sm font-bold text-slate-900">Good food, less waste.</p><p className="mt-1 text-xs leading-5 text-slate-600">Every shared meal can make a difference in someone's day.</p><span className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-orange-700">Our mission <ArrowRight size={13}/></span></div>
        <NavLink to="/settings" className="mt-4 flex items-center gap-3 rounded-xl px-3 py-2.5 text-[13px] font-medium text-slate-500 hover:bg-slate-100"><Settings size={17}/>Settings</NavLink>
      </aside>

      {mobileOpen && <div className="fixed inset-0 z-50 bg-slate-950/40 lg:hidden" onClick={() => setMobileOpen(false)}><aside className="flex h-full w-[min(300px,85vw)] flex-col bg-white p-4 shadow-2xl" onClick={e => e.stopPropagation()}><div className="flex items-center justify-between"><span className="font-extrabold">food<span className="text-emerald-700">bridge</span></span><button aria-label="Close navigation" onClick={() => setMobileOpen(false)} className="rounded-lg p-2 hover:bg-slate-100"><X size={19}/></button></div><nav className="mt-7 space-y-1">{links.map(({ label, to, icon: Icon }) => <NavLink key={to} to={to} onClick={() => setMobileOpen(false)} className={({ isActive }) => `flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium ${isActive ? 'bg-emerald-700 text-white' : 'text-slate-600 hover:bg-slate-100'}`}><Icon size={18}/>{label}</NavLink>)}</nav><div className="mt-auto rounded-xl bg-orange-50 p-4 text-sm font-semibold">Good food, less waste.</div></aside></div>}
      <main className="min-w-0 flex-1 px-4 py-7 sm:px-6 sm:py-9 lg:px-10"> {children ?? <Outlet/>} </main>
    </div>
    <footer className="border-t border-slate-200/80 bg-white px-6 py-5 text-center text-xs text-slate-400">Copyright (c) {new Date().getFullYear()} FoodBridge - Connecting food with those who need it.</footer>
  </div>
}
