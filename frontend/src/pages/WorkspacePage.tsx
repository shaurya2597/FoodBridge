import { useQuery } from '@tanstack/react-query'
import { userMessage } from '@/services/apiError'
import { getNgoSummary } from '@/services/ngo'
import { useAuth } from '@/auth/AuthContext'
import { Link } from 'react-router-dom'
import { ArrowRight, ArrowUpRight, Clock3, HeartHandshake, Leaf, MapPin, PackageCheck, ShoppingBasket, Sparkles, Utensils } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { CustomerDashboard } from './CustomerDashboard'

type Role = 'customer' | 'owner' | 'ngo' | 'admin'
const content: Record<Role, { eyebrow: string; title: string; description: string; primary: string; primaryTo: string; stats: { label: string; value: string; note: string; icon: typeof Utensils }[] }> = {
  customer: { eyebrow: 'A little good goes a long way', title: 'Good food. Good mood.\nA better way to eat.', description: 'Discover local favourites, order the food you love, and be part of a community that believes good food should never go to waste.', primary: 'Explore food', primaryTo: '/customer/explore', stats: [{ label: 'Nearby favourites', value: 'Discover', note: 'Find something delicious', icon: Utensils }, { label: 'Your orders', value: 'All in one place', note: 'Follow every order', icon: ShoppingBasket }, { label: 'Make a difference', value: 'Share more', note: 'Help reduce food waste', icon: HeartHandshake }] },
  owner: { eyebrow: 'Your kitchen, your community', title: 'Make every order\na great experience.', description: 'A simple home for your restaurant operations. Keep your menu, incoming orders and customers moving together.', primary: 'View restaurant', primaryTo: '/owner/restaurant', stats: [{ label: 'Restaurant profile', value: 'Your storefront', note: 'Manage your presence', icon: Utensils }, { label: 'Incoming orders', value: 'Stay organised', note: 'Track order progress', icon: ShoppingBasket }, { label: 'Community impact', value: 'Give back', note: 'Share surplus food', icon: HeartHandshake }] },
  ngo: { eyebrow: 'Together, we can bridge the gap', title: 'Turn surplus food\ninto shared hope.', description: 'Find available food donations, coordinate pickups and help good food reach the people who need it.', primary: 'Find donations', primaryTo: '/ngo/donations', stats: [{ label: 'Available donations', value: 'Discover', note: 'Browse posted food', icon: HeartHandshake }, { label: 'Pickup coordination', value: 'Stay on track', note: 'Organise collections', icon: PackageCheck }, { label: 'Community support', value: 'Create impact', note: 'Reach more people', icon: Leaf }] },
  admin: { eyebrow: 'The people behind the platform', title: 'A healthier food\ncommunity starts here.', description: 'A central workspace for platform oversight, moderation and the people who make FoodBridge possible.', primary: 'Open overview', primaryTo: '/admin', stats: [{ label: 'Platform users', value: 'Community', note: 'Manage accounts', icon: ShoppingBasket }, { label: 'Restaurants', value: 'Local partners', note: 'Review listings', icon: Utensils }, { label: 'Food donations', value: 'Shared impact', note: 'Oversee donations', icon: HeartHandshake }] },
}
const roleLinks: { label: string; to: string; role: Role }[] = [{ label: 'Customer', to: '/customer', role: 'customer' }, { label: 'Restaurant owner', to: '/owner', role: 'owner' }, { label: 'NGO', to: '/ngo', role: 'ngo' }, { label: 'Admin', to: '/admin', role: 'admin' }]

export function WorkspacePage({ role }: { role: Role }) {
  const page = content[role]
  const { user } = useAuth()
    const ngoSummaryQuery = useQuery({
    queryKey: ['ngo', 'summary'],
    queryFn: ({ signal }) => getNgoSummary(signal),
    enabled: role === 'ngo',
    staleTime: 30_000,
  })

  const ngoSummary = ngoSummaryQuery.data
  const donationsByStatus = ngoSummary?.donationsByStatus ?? {}

  const donationsClaimed = Object.values(donationsByStatus)
    .reduce((total, count) => total + (count ?? 0), 0)

  const completedDonations =
    (donationsByStatus.COLLECTED ?? 0) +
    (donationsByStatus.DISTRIBUTED ?? 0)
  const isNgoVerified = user?.ngoProfile?.isVerified === true

  if (role === 'customer') return <CustomerDashboard />
  return <div className="mx-auto max-w-6xl">
    <div className="mb-6 flex flex-wrap items-center justify-between gap-3"><div><p className="text-xs font-semibold uppercase tracking-[.16em] text-emerald-700">{page.eyebrow}</p><h1 className="mt-2 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">{page.title.replace('\n', ' ')}</h1></div><div className="flex items-center gap-2 rounded-full border border-emerald-100 bg-white px-3 py-2 text-xs font-medium text-emerald-800"><span className="size-2 rounded-full bg-emerald-500"/> M1 design preview</div></div>
    <section className="relative isolate overflow-hidden rounded-[28px] bg-[#123f32] px-6 py-9 text-white shadow-xl shadow-emerald-950/10 sm:px-10 sm:py-12 lg:px-14">
      <div className="absolute -right-20 -top-24 -z-10 size-80 rounded-full border-[48px] border-white/[.045]"/><div className="absolute -bottom-36 right-1/4 -z-10 size-72 rounded-full bg-emerald-400/10 blur-3xl"/>
      <div className="max-w-2xl"><span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-[11px] font-semibold tracking-wide text-emerald-100"><Sparkles size={13}/> FOOD THAT BRINGS US TOGETHER</span><h2 className="mt-5 whitespace-pre-line text-4xl font-bold leading-[1.08] tracking-tight sm:text-5xl">{page.title}</h2><p className="mt-5 max-w-xl text-sm leading-7 text-emerald-50/80 sm:text-base">{page.description}</p><div className="mt-7 flex flex-wrap gap-3"><Link to={page.primaryTo} className="inline-flex h-11 items-center rounded-full bg-[#f4a64f] px-5 text-sm font-semibold text-[#39220a] transition hover:bg-[#ffc071]">{page.primary}<ArrowRight className="ml-2" size={16}/></Link><a href="#quick-links" className="inline-flex h-11 items-center rounded-full border border-white/25 px-5 text-sm font-semibold text-white hover:bg-white/10">Explore workspace</a></div></div>
      <div className="mt-9 flex flex-wrap gap-x-6 gap-y-3 border-t border-white/15 pt-5 text-xs text-emerald-100/80"><span className="inline-flex items-center gap-2"><MapPin size={14}/> Local food, connected</span><span className="inline-flex items-center gap-2"><Clock3 size={14}/> Built for everyday ease</span><span className="inline-flex items-center gap-2"><Leaf size={14}/> Less waste, more care</span></div>
    </section>
    {role === 'ngo' && (
  <section className={`mb-6 rounded-2xl border p-5 ${
    isNgoVerified
      ? 'border-emerald-200 bg-emerald-50'
      : 'border-amber-200 bg-amber-50'
  }`}>
    <div className="flex items-start gap-3">
      <span className={`grid size-11 shrink-0 place-items-center rounded-xl ${
        isNgoVerified
          ? 'bg-emerald-100 text-emerald-700'
          : 'bg-amber-100 text-amber-700'
      }`}>
        {isNgoVerified ? 'âœ“' : 'â³'}
      </span>

      <div>
        <h3 className={`text-sm font-bold ${
          isNgoVerified ? 'text-emerald-900' : 'text-amber-900'
        }`}>
          {isNgoVerified ? 'Your NGO is verified' : 'Verification pending'}
        </h3>

        <p className={`mt-1 text-xs leading-5 ${
          isNgoVerified ? 'text-emerald-800' : 'text-amber-800'
        }`}>
          {isNgoVerified
            ? 'Your organisation has been verified. You can continue coordinating food donations and pickups.'
            : 'Your organisation is awaiting admin verification. You can explore the workspace while your profile is reviewed.'}
        </p>
      </div>
    </div>
  </section>
)}
 {role === 'ngo' ? (
      <>
        {ngoSummaryQuery.isPending && (
          <p className="mt-8 text-sm text-slate-500" role="status">
            Loading your NGO statistics...
          </p>
        )}

        {ngoSummaryQuery.isError && (
          <div className="mt-8 rounded-xl border border-red-200 bg-red-50 p-4" role="alert">
            <p className="text-sm font-semibold text-red-800">
              Could not load NGO statistics
            </p>
            <p className="mt-1 text-xs text-red-700">
              {userMessage(ngoSummaryQuery.error)}
            </p>
            <button
              type="button"
              onClick={() => void ngoSummaryQuery.refetch()}
              className="mt-3 rounded-lg bg-red-100 px-3 py-2 text-xs font-semibold text-red-800 hover:bg-red-200"
            >
              Try again
            </button>
          </div>
        )}

        {ngoSummaryQuery.data && (
          <section className="mt-8 grid gap-4 md:grid-cols-3">
            {[
              {
                label: 'Donations claimed',
                value: donationsClaimed,
                note: 'Donations assigned to your NGO',
                icon: HeartHandshake,
              },
              {
                label: 'Servings collected',
                value: ngoSummary?.servingsCollected ?? 0,
                note: 'Servings collected or distributed',
                icon: Leaf,
              },
              {
                label: 'Completed donations',
                value: completedDonations,
                note: 'Collected and distributed',
                icon: PackageCheck,
              },
            ].map(({ label, value, note, icon: Icon }, i) => (
              <Card key={label} className="rounded-2xl border-slate-200/80 bg-white shadow-sm">
                <CardContent className="p-5">
                  <div className="flex items-start justify-between">
                    <span className={`grid size-10 place-items-center rounded-xl ${
                      i === 1 ? 'bg-orange-50 text-orange-700' : 'bg-emerald-50 text-emerald-700'
                    }`}>
                      <Icon size={19} />
                    </span>
                    <ArrowUpRight size={17} className="text-slate-300" />
                  </div>
                  <p className="mt-5 text-xs font-medium text-slate-500">{label}</p>
                  <p className="mt-1 text-lg font-bold text-slate-900">{value.toLocaleString('en-IN')}</p>
                  <p className="mt-1 text-xs text-slate-400">{note}</p>
                </CardContent>
              </Card>
            ))}
          </section>
        )}
      </>
    ) : (
      <section className="mt-8 grid gap-4 md:grid-cols-3">
        {page.stats.map(({ label, value, note, icon: Icon }, i) => (
          <Card key={label} className="rounded-2xl border-slate-200/80 bg-white shadow-sm">
            <CardContent className="p-5">
              <div className="flex items-start justify-between">
                <span className={`grid size-10 place-items-center rounded-xl ${
                  i === 1 ? 'bg-orange-50 text-orange-700' : 'bg-emerald-50 text-emerald-700'
                }`}>
                  <Icon size={19} />
                </span>
                <ArrowUpRight size={17} className="text-slate-300" />
              </div>
              <p className="mt-5 text-xs font-medium text-slate-500">{label}</p>
              <p className="mt-1 text-lg font-bold text-slate-900">{value}</p>
              <p className="mt-1 text-xs text-slate-400">{note}</p>
            </CardContent>
          </Card>
        ))}
      </section>
    )}


    <section id="quick-links" className="mt-9">
      <div className="flex items-end justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[.15em] text-emerald-700">
            One platform, many ways to help
          </p>
          <h2 className="mt-1 text-xl font-bold tracking-tight">Choose a workspace</h2>
        </div>
        <span className="hidden text-xs text-slate-400 sm:block">
          Preview navigation Â· Authentication arrives in M2
        </span>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {roleLinks.map(item => (
          <Link
            key={item.role}
            to={item.to}
            className={`group flex items-center justify-between rounded-2xl border bg-white p-4 transition hover:-translate-y-0.5 hover:border-emerald-300 hover:shadow-md ${
              item.role === role
                ? 'border-emerald-300 ring-2 ring-emerald-100'
                : 'border-slate-200'
            }`}
          >
            <span>
              <span className="block text-sm font-semibold text-slate-800">{item.label}</span>
              <span className="mt-1 block text-[11px] text-slate-400">Open workspace</span>
            </span>
            <span className="grid size-8 place-items-center rounded-full bg-slate-50 text-slate-400 transition group-hover:bg-emerald-50 group-hover:text-emerald-700">
              <ArrowRight size={15} />
            </span>
          </Link>
        ))}
      </div>
    </section>

    <div className="mt-8 flex flex-col gap-3 rounded-2xl border border-orange-100 bg-[#fff9f0] p-5 sm:flex-row sm:items-center">
      <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-orange-100 text-orange-700">
        <HeartHandshake size={20} />
      </span>
      <div className="flex-1">
        <p className="text-sm font-bold text-slate-800">
          More than a meal. A little more possibility.
        </p>
        <p className="mt-1 text-xs leading-5 text-slate-500">
          FoodBridge brings customers, restaurants and NGOs together to make food access more thoughtful.
        </p>
      </div>
      <span className="text-xs font-semibold text-orange-700">
        Good food. Shared good. <ArrowRight className="ml-1 inline" size={13} />
      </span>
    </div>
  </div>
}
