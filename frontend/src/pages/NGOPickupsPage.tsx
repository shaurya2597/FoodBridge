
import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { CalendarClock, CheckCircle2, Clock3, MapPin, PackageCheck, Phone, RefreshCw, Truck } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { userMessage } from '@/services/apiError'
import {
  getAvailableDonations,
  updateDonationStatus,
  type Donation,
  type DonationStatus,
} from '@/services/donations'

function formatDate(value?: string | null) {
  if (!value) return 'Not scheduled'
  return new Date(value).toLocaleString('en-IN', {
    dateStyle: 'medium',
    timeStyle: 'short',
  })
}

function statusLabel(status: DonationStatus) {
  const labels: Record<DonationStatus, string> = {
    POSTED: 'Available',
    NGO_REQUESTED: 'Awaiting donor approval',
    ACCEPTED: 'Ready to schedule pickup',
    PICKUP_SCHEDULED: 'Pickup scheduled',
    COLLECTED: 'Collected',
    DISTRIBUTED: 'Distributed',
    EXPIRED: 'Expired',
    FLAGGED: 'Under review',
    CANCELLED: 'Cancelled',
  }
  return labels[status]
}

function PickupCard({ donation }: { donation: Donation }) {
  const queryClient = useQueryClient()
  const [pickupAt, setPickupAt] = useState('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  const mutation = useMutation({
    mutationFn: (input: {
      status: 'POSTED' | 'PICKUP_SCHEDULED' | 'COLLECTED' | 'DISTRIBUTED'
      pickupAt?: string
    }) => updateDonationStatus(donation.id, input),
    onSuccess: async () => {
      setError('')
      setMessage('Donation status updated successfully.')
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['donations', 'mine'] }),
        queryClient.invalidateQueries({ queryKey: ['donations', 'available'] }),
        queryClient.invalidateQueries({ queryKey: ['ngo', 'summary'] }),
      ])
    },
    onError: (err) => setError(userMessage(err)),
  })

  function schedulePickup() {
    if (!pickupAt) {
      setError('Please select a pickup date and time.')
      return
    }

    const selected = new Date(pickupAt)
    const expiry = new Date(donation.availableUntil)

    if (selected <= new Date()) {
      setError('Pickup time must be in the future.')
      return
    }

    if (selected >= expiry) {
      setError('Pickup must be scheduled before the food expires.')
      return
    }

    mutation.mutate({
      status: 'PICKUP_SCHEDULED',
      pickupAt: selected.toISOString(),
    })
  }

  function updateStatus(status: 'COLLECTED' | 'DISTRIBUTED') {
    mutation.mutate({ status })
  }

  return (
    <Card className="overflow-hidden border-slate-200 shadow-sm">
      <CardContent className="space-y-4 p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-lg font-semibold text-slate-900">{donation.foodName}</h3>
              <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700">
                {donation.foodType === 'VEG' ? 'Veg' : 'Non-veg'}
              </span>
            </div>
            <p className="mt-1 text-sm text-slate-500">{donation.category} ╬ô├╢┬╝╬ô├▓├╗ {donation.donorType === 'INDIVIDUAL' ? 'Individual donor' : donation.donorName}</p>
          </div>
          <span className="rounded-full bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-700">
            {statusLabel(donation.status)}
          </span>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-xl bg-slate-50 p-3">
            <p className="text-xs text-slate-500">Quantity</p>
            <p className="mt-1 font-medium text-slate-800">{donation.quantity} ╬ô├╢┬╝╬ô├▓├╗ {donation.servings} servings</p>
          </div>
          <div className="rounded-xl bg-slate-50 p-3">
            <p className="text-xs text-slate-500">Available until</p>
            <p className="mt-1 font-medium text-slate-800">{formatDate(donation.availableUntil)}</p>
          </div>
        </div>

        <div className="flex items-start gap-2 text-sm text-slate-600">
          <MapPin className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{donation.pickupAddress || donation.city}</span>
        </div>

        {donation.instructions && (
          <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900">
            <strong>Pickup instructions:</strong> {donation.instructions}
          </p>
        )}

        {donation.contactPhone && (
          <div className="flex items-center gap-2 text-sm text-slate-700">
            <Phone className="h-4 w-4" />
            <a className="font-medium text-blue-700 hover:underline" href={`tel:${donation.contactPhone}`}>
              {donation.contactPhone}
            </a>
          </div>
        )}

        {donation.status === 'NGO_REQUESTED' && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
            <Clock3 className="mb-2 h-5 w-5" />
            Your request has been sent. The donor must approve it before you can schedule a pickup.
          </div>
        )}

        {donation.status === 'ACCEPTED' && (
          <div className="space-y-3 rounded-xl border border-blue-200 bg-blue-50 p-4">
            <div className="flex items-center gap-2 font-semibold text-blue-900">
              <CalendarClock className="h-5 w-5" />
              Schedule pickup
            </div>
            <input
              type="datetime-local"
              value={pickupAt}
              onChange={(event) => setPickupAt(event.target.value)}

              max={donation.availableUntil.slice(0, 16)}
              className="w-full rounded-lg border border-blue-200 bg-white px-3 py-2 text-sm"
            />
            <button
              type="button"
              disabled={mutation.isPending}
              onClick={schedulePickup}
              className="rounded-lg bg-blue-700 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-800 disabled:opacity-50"
            >
              {mutation.isPending ? 'SchedulingΓò¼├┤Γö£├ºΓö¼┬¼' : 'Confirm pickup schedule'}
            </button>
          </div>
        )}

        {donation.status === 'PICKUP_SCHEDULED' && (
          <div className="space-y-3 rounded-xl border border-indigo-200 bg-indigo-50 p-4">
            <p className="flex items-center gap-2 text-sm font-semibold text-indigo-900">
              <Truck className="h-5 w-5" />
              Pickup: {formatDate(donation.pickupScheduledAt)}
            </p>
            <button
              type="button"
              disabled={mutation.isPending}
              onClick={() => updateStatus('COLLECTED')}
              className="rounded-lg bg-indigo-700 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-800 disabled:opacity-50"
            >
              Mark as collected
            </button>
          </div>
        )}

        {donation.status === 'COLLECTED' && (
          <div className="space-y-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4">
            <p className="flex items-center gap-2 text-sm font-semibold text-emerald-900">
              <PackageCheck className="h-5 w-5" />
              Food collected successfully
            </p>
            <button
              type="button"
              disabled={mutation.isPending}
              onClick={() => updateStatus('DISTRIBUTED')}
              className="rounded-lg bg-emerald-700 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-800 disabled:opacity-50"
            >
              Mark as distributed
            </button>
          </div>
        )}

        {donation.status === 'DISTRIBUTED' && (
          <p className="flex items-center gap-2 rounded-lg bg-emerald-50 p-3 text-sm font-medium text-emerald-800">
            <CheckCircle2 className="h-5 w-5" />
            Donation successfully distributed.
          </p>
        )}

        {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
        {message && <p role="status" className="text-sm text-emerald-700">{message}</p>}
      </CardContent>
    </Card>
  )
}

const tabs: { label: string; status: DonationStatus | 'ALL' }[] = [
  { label: 'All', status: 'ALL' },
  { label: 'Awaiting approval', status: 'NGO_REQUESTED' },
  { label: 'Ready to schedule', status: 'ACCEPTED' },
  { label: 'Scheduled', status: 'PICKUP_SCHEDULED' },
  { label: 'Collected', status: 'COLLECTED' },
  { label: 'Distributed', status: 'DISTRIBUTED' },
]

export function NGOPickupsPage() {
  const [activeTab, setActiveTab] = useState<DonationStatus | 'ALL'>('ALL')

  const { data, isLoading, isError, error, refetch, isFetching } = useQuery({
    queryKey: ['donations', 'mine', activeTab],
    queryFn: ({ signal }) => getAvailableDonations({
      mine: true,
      status: activeTab === 'ALL' ? undefined : activeTab,
      limit: 50,
      sort: 'newest',
    }, signal),
  })

  const donations = data?.donations ?? []

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-emerald-700">NGO workspace</p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-950">My pickups</h1>
        <p className="mt-2 text-sm text-slate-600">
          Manage your donation requests, schedule pickups, and track food distribution.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {tabs.map((tab) => (
          <button
            key={tab.status}
            type="button"
            onClick={() => setActiveTab(tab.status)}
            className={`rounded-full px-4 py-2 text-sm font-medium transition ${
              activeTab === tab.status
                ? 'bg-emerald-700 text-white'
                : 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="rounded-xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500">
          Loading your pickupsΓò¼├┤Γö£├ºΓö¼┬¼
        </div>
      ) : isError ? (
        <div className="rounded-xl border border-red-200 bg-red-50 p-6">
          <p className="text-sm text-red-700">{userMessage(error)}</p>
          <button onClick={() => refetch()} className="mt-3 text-sm font-semibold text-red-800 underline">
            Try again
          </button>
        </div>
      ) : donations.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white p-10 text-center">
          <PackageCheck className="mx-auto h-10 w-10 text-slate-300" />
          <h2 className="mt-3 font-semibold text-slate-800">No pickups in this category</h2>
          <p className="mt-1 text-sm text-slate-500">
            Donations you request will appear here. Try another tab or find available donations.
          </p>
        </div>
      ) : (
        <>
          <div className="flex items-center justify-between">
            <p className="text-sm text-slate-500">{data?.meta.total ?? donations.length} donation(s)</p>
            <button
              onClick={() => refetch()}
              disabled={isFetching}
              className="flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-slate-900 disabled:opacity-50"
            >
              <RefreshCw className={`h-4 w-4 ${isFetching ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>
          <div className="grid gap-4 xl:grid-cols-2">
            {donations.map((donation) => (
              <PickupCard key={donation.id} donation={donation} />
            ))}
          </div>
        </>
      )}
    </div>
  )
}
