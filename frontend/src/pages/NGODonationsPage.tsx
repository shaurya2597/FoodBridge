import { useState, type FormEvent } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  AlertCircle,
  Clock3,
  HeartHandshake,
  Leaf,
  MapPin,
  Package,
  RefreshCw,
  Search,
  Utensils,
} from 'lucide-react'
import { useAuth } from '@/auth/AuthContext'
import { Card, CardContent } from '@/components/ui/card'
import { userMessage } from '@/services/apiError'
import {
  getAvailableDonations,
  requestDonation,
  type Donation,
  type DonationFilters,
  type DonationFoodType,
} from '@/services/donations'

function formatDate(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Not available'
  return date.toLocaleString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

function DonationCard({
  donation,
  verified,
  requesting,
  message,
  onMessageChange,
  onRequest,
}: {
  donation: Donation
  verified: boolean
  requesting: boolean
  message: string
  onMessageChange: (value: string) => void
  onRequest: () => void
}) {
  return (
    <Card className="overflow-hidden rounded-2xl border-slate-200/80 bg-white shadow-sm transition hover:shadow-md">
      {donation.imageUrl ? (
        <img
          src={donation.imageUrl}
          alt={donation.foodName}
          className="h-48 w-full object-cover"
        />
      ) : (
        <div className="grid h-40 place-items-center bg-emerald-50 text-emerald-700">
          <Utensils size={42} />
        </div>
      )}

      <CardContent className="p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className={`rounded-full px-3 py-1 text-xs font-semibold ${
            donation.foodType === 'VEG'
              ? 'bg-emerald-50 text-emerald-700'
              : 'bg-orange-50 text-orange-700'
          }`}>
            {donation.foodType === 'VEG' ? 'Vegetarian' : 'Non-vegetarian'}
          </span>
          <span className="text-xs font-medium text-slate-500">
            {donation.category}
          </span>
        </div>

        <h2 className="mt-3 text-lg font-bold text-slate-900">
          {donation.foodName}
        </h2>

        <p className="mt-1 text-sm text-slate-500">
          Donated by {donation.donorName}
          {donation.donorType === 'RESTAURANT' ? ' · Restaurant' : ''}
        </p>

        <div className="mt-4 grid grid-cols-2 gap-3">
          <div className="rounded-xl bg-slate-50 p-3">
            <Package size={16} className="text-emerald-700" />
            <p className="mt-2 text-xs text-slate-500">Quantity</p>
            <p className="text-sm font-semibold text-slate-800">{donation.quantity}</p>
          </div>
          <div className="rounded-xl bg-slate-50 p-3">
            <HeartHandshake size={16} className="text-emerald-700" />
            <p className="mt-2 text-xs text-slate-500">Servings</p>
            <p className="text-sm font-semibold text-slate-800">{donation.servings}</p>
          </div>
        </div>

        <div className="mt-4 space-y-2 text-xs text-slate-600">
          <p className="flex items-start gap-2">
            <MapPin size={15} className="mt-0.5 shrink-0 text-emerald-700" />
            {donation.city}
          </p>
          <p className="flex items-start gap-2">
            <Clock3 size={15} className="mt-0.5 shrink-0 text-emerald-700" />
            Available until {formatDate(donation.availableUntil)}
          </p>
          <p className="text-slate-400">
            Prepared: {formatDate(donation.preparedAt)}
          </p>
        </div>

        {donation.instructions && (
          <div className="mt-4 rounded-xl border border-slate-100 bg-slate-50 p-3">
            <p className="text-xs font-semibold text-slate-700">Donor instructions</p>
            <p className="mt-1 text-xs leading-5 text-slate-600">
              {donation.instructions}
            </p>
          </div>
        )}

        <div className="mt-5 border-t border-slate-100 pt-4">
          <label
            htmlFor={`message-${donation.id}`}
            className="text-xs font-semibold text-slate-700"
          >
            Message to donor (optional)
          </label>
          <textarea
            id={`message-${donation.id}`}
            value={message}
            onChange={event => onMessageChange(event.target.value)}
            maxLength={300}
            rows={2}
            placeholder="Introduce your organisation or coordinate collection..."
            className="mt-2 w-full resize-none rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
          />

          <button
            type="button"
            onClick={onRequest}
            disabled={!verified || requesting}
            className="mt-3 inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#123f32] px-4 text-sm font-semibold text-white transition hover:bg-emerald-900 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <HeartHandshake size={17} />
            {requesting ? 'Sending request...' : 'Request this donation'}
          </button>

          {!verified && (
            <p className="mt-2 text-center text-xs text-amber-700">
              NGO verification is required before requesting donations.
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

export function NGODonationsPage() {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const verified = user?.ngoProfile?.isVerified === true

  const [searchInput, setSearchInput] = useState('')
  const [cityInput, setCityInput] = useState('')
  const [foodTypeInput, setFoodTypeInput] = useState<DonationFoodType | 'ALL'>('ALL')
  const [sortInput, setSortInput] = useState<'expiry' | 'newest'>('expiry')
  const [filters, setFilters] = useState<DonationFilters>({
    page: 1,
    limit: 12,
    sort: 'expiry',
  })
  const [messages, setMessages] = useState<Record<string, string>>({})
  const [successMessage, setSuccessMessage] = useState('')

  const donationsQuery = useQuery({
    queryKey: ['donations', 'available', filters],
    queryFn: ({ signal }) => getAvailableDonations(filters, signal),
    staleTime: 15_000,
  })

  const requestMutation = useMutation({
    mutationFn: ({ id, message }: { id: string; message: string }) =>
      requestDonation(id, message.trim() || undefined),
    onSuccess: async () => {
      setSuccessMessage('Donation request sent successfully!')
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['donations', 'available'] }),
        queryClient.invalidateQueries({ queryKey: ['ngo', 'summary'] }),
      ])
    },
  })

  function applyFilters(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSuccessMessage('')
    setFilters({
      page: 1,
      limit: 12,
      q: searchInput.trim() || undefined,
      city: cityInput.trim() || undefined,
      foodType: foodTypeInput,
      sort: sortInput,
    })
  }

  function changePage(page: number) {
    setFilters(current => ({ ...current, page }))
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function submitRequest(donation: Donation) {
    setSuccessMessage('')
    requestMutation.mutate({
      id: donation.id,
      message: messages[donation.id] ?? '',
    })
  }

  const donations = donationsQuery.data?.donations ?? []
  const meta = donationsQuery.data?.meta

  return (
    <div className="mx-auto max-w-6xl">
      <div className="mb-7">
        <p className="text-xs font-semibold uppercase tracking-[.16em] text-emerald-700">
          Make a difference, one meal at a time
        </p>
        <h1 className="mt-2 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
          Find food donations
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
          Discover available surplus food from individuals and restaurants.
          Request a donation and coordinate its collection for your community.
        </p>
      </div>

      <div className={`mb-6 flex items-start gap-3 rounded-2xl border p-4 ${
        verified
          ? 'border-emerald-200 bg-emerald-50'
          : 'border-amber-200 bg-amber-50'
      }`}>
        <span className={`mt-0.5 ${verified ? 'text-emerald-700' : 'text-amber-700'}`}>
          {verified ? <Leaf size={20} /> : <AlertCircle size={20} />}
        </span>
        <div>
          <p className={`text-sm font-bold ${verified ? 'text-emerald-900' : 'text-amber-900'}`}>
            {verified ? 'Your NGO is verified' : 'Verification pending'}
          </p>
          <p className={`mt-1 text-xs leading-5 ${verified ? 'text-emerald-800' : 'text-amber-800'}`}>
            {verified
              ? 'You can request available donations. Once a donor accepts, you can coordinate the pickup.'
              : 'You can browse available donations, but your NGO must be verified by an admin before requesting them.'}
          </p>
        </div>
      </div>

      <Card className="mb-6 rounded-2xl border-slate-200/80 shadow-sm">
        <CardContent className="p-4 sm:p-5">
          <form onSubmit={applyFilters}>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div className="lg:col-span-2">
                <label htmlFor="donation-search" className="text-xs font-semibold text-slate-700">
                  Search food
                </label>
                <div className="relative mt-1.5">
                  <Search size={17} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    id="donation-search"
                    value={searchInput}
                    onChange={event => setSearchInput(event.target.value)}
                    placeholder="e.g. Rice, chapati, fruits..."
                    className="h-11 w-full rounded-xl border border-slate-200 pl-10 pr-3 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="donation-city" className="text-xs font-semibold text-slate-700">
                  City
                </label>
                <input
                  id="donation-city"
                  value={cityInput}
                  onChange={event => setCityInput(event.target.value)}
                  placeholder="Enter city"
                  className="mt-1.5 h-11 w-full rounded-xl border border-slate-200 px-3 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                />
              </div>

              <div>
                <label htmlFor="donation-food-type" className="text-xs font-semibold text-slate-700">
                  Food type
                </label>
                <select
                  id="donation-food-type"
                  value={foodTypeInput}
                  onChange={event => setFoodTypeInput(event.target.value as DonationFoodType | 'ALL')}
                  className="mt-1.5 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-emerald-500"
                >
                  <option value="ALL">All food</option>
                  <option value="VEG">Vegetarian</option>
                  <option value="NON_VEG">Non-vegetarian</option>
                </select>
              </div>

              <div>
                <label htmlFor="donation-sort" className="text-xs font-semibold text-slate-700">
                  Sort by
                </label>
                <select
                  id="donation-sort"
                  value={sortInput}
                  onChange={event => setSortInput(event.target.value as 'expiry' | 'newest')}
                  className="mt-1.5 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-emerald-500"
                >
                  <option value="expiry">Expiring soon</option>
                  <option value="newest">Recently added</option>
                </select>
              </div>

              <div className="flex items-end">
                <button
                  type="submit"
                  className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#123f32] px-4 text-sm font-semibold text-white transition hover:bg-emerald-900"
                >
                  <Search size={16} />
                  Search donations
                </button>
              </div>
            </div>
          </form>
        </CardContent>
      </Card>

      {successMessage && (
        <div className="mb-5 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm font-medium text-emerald-800" role="status">
          {successMessage}
        </div>
      )}

      {requestMutation.isError && (
        <div className="mb-5 rounded-xl border border-red-200 bg-red-50 p-4" role="alert">
          <p className="text-sm font-semibold text-red-800">Could not send donation request</p>
          <p className="mt-1 text-xs text-red-700">{userMessage(requestMutation.error)}</p>
          <button
            type="button"
            onClick={() => requestMutation.reset()}
            className="mt-2 text-xs font-semibold text-red-800 underline"
          >
            Dismiss
          </button>
        </div>
      )}

      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-lg font-bold text-slate-900">Available donations</h2>
          {meta && (
            <p className="mt-1 text-xs text-slate-500">
              {meta.total} donation{meta.total === 1 ? '' : 's'} found
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={() => void donationsQuery.refetch()}
          disabled={donationsQuery.isFetching}
          className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-50"
        >
          <RefreshCw size={14} className={donationsQuery.isFetching ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>

      {donationsQuery.isPending && (
        <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center text-sm text-slate-500">
          Loading available donations...
        </div>
      )}

      {donationsQuery.isError && (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-5" role="alert">
          <p className="font-semibold text-red-800">Could not load donations</p>
          <p className="mt-1 text-sm text-red-700">{userMessage(donationsQuery.error)}</p>
          <button
            type="button"
            onClick={() => void donationsQuery.refetch()}
            className="mt-3 rounded-lg bg-red-100 px-3 py-2 text-xs font-semibold text-red-800 hover:bg-red-200"
          >
            Try again
          </button>
        </div>
      )}

      {donationsQuery.isSuccess && donations.length === 0 && (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-5 py-12 text-center">
          <span className="mx-auto grid size-14 place-items-center rounded-2xl bg-emerald-50 text-emerald-700">
            <HeartHandshake size={27} />
          </span>
          <h3 className="mt-4 text-base font-bold text-slate-900">No donations found</h3>
          <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-500">
            There are no available donations matching these filters right now.
            Try another city or food type, or check again later.
          </p>
          <button
            type="button"
            onClick={() => {
              setSearchInput('')
              setCityInput('')
              setFoodTypeInput('ALL')
              setSortInput('expiry')
              setFilters({ page: 1, limit: 12, sort: 'expiry' })
            }}
            className="mt-5 rounded-xl bg-emerald-50 px-4 py-2.5 text-sm font-semibold text-emerald-800 hover:bg-emerald-100"
          >
            Clear filters
          </button>
        </div>
      )}

      {donations.length > 0 && (
        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {donations.map(donation => (
            <DonationCard
              key={donation.id}
              donation={donation}
              verified={verified}
              requesting={requestMutation.isPending && requestMutation.variables?.id === donation.id}
              message={messages[donation.id] ?? ''}
              onMessageChange={value => setMessages(current => ({
                ...current,
                [donation.id]: value,
              }))}
              onRequest={() => submitRequest(donation)}
            />
          ))}
        </div>
      )}

      {meta && meta.totalPages > 1 && (
        <div className="mt-7 flex items-center justify-center gap-3">
          <button
            type="button"
            onClick={() => changePage(meta.page - 1)}
            disabled={meta.page <= 1 || donationsQuery.isFetching}
            className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Previous
          </button>
          <span className="text-xs font-medium text-slate-500">
            Page {meta.page} of {meta.totalPages}
          </span>
          <button
            type="button"
            onClick={() => changePage(meta.page + 1)}
            disabled={meta.page >= meta.totalPages || donationsQuery.isFetching}
            className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Next
          </button>
        </div>
      )}
    </div>
  )
}
