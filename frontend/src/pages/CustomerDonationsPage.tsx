import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { CheckCircle2, Clock3, HeartHandshake, RefreshCw, XCircle } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { userMessage } from '@/services/apiError'
import {
  getAvailableDonations,
  updateDonationStatus,
  type Donation,
  type DonationStatus,
} from '@/services/donations'

const statusLabels: Record<DonationStatus, string> = {
  POSTED: 'Available for NGOs',
  NGO_REQUESTED: 'NGO request pending',
  ACCEPTED: 'Request accepted',
  PICKUP_SCHEDULED: 'Pickup scheduled',
  COLLECTED: 'Food collected',
  DISTRIBUTED: 'Food distributed',
  EXPIRED: 'Expired',
  FLAGGED: 'Under review',
  CANCELLED: 'Cancelled',
}

function formatDate(value: string) {
  return new Date(value).toLocaleString('en-IN', {
    dateStyle: 'medium',
    timeStyle: 'short',
  })
}

export function CustomerDonationsPage() {
  const queryClient = useQueryClient()
  const [message, setMessage] = useState('')

  const donationsQuery = useQuery({
    queryKey: ['donations', 'donor-mine'],
    queryFn: () => getAvailableDonations({ mine: true, limit: 50, sort: 'newest' }),
  })

  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: 'ACCEPTED' | 'POSTED' }) =>
      updateDonationStatus(id, { status }),
    onSuccess: async (_data, variables) => {
      setMessage(
        variables.status === 'ACCEPTED'
          ? 'NGO request accepted. The NGO can now coordinate pickup with you.'
          : 'NGO request declined. Your donation is available for other NGOs again.',
      )
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['donations', 'donor-mine'] }),
        queryClient.invalidateQueries({ queryKey: ['donations', 'mine'] }),
        queryClient.invalidateQueries({ queryKey: ['donations', 'available'] }),
      ])
    },
    onError: (error) => setMessage(userMessage(error)),
  })

  const donations = donationsQuery.data?.donations ?? []

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-emerald-700">Your contribution</p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-950">My Donations</h1>
          <p className="mt-1 text-sm text-slate-500">
            Track your food donations and respond to NGO pickup requests.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void donationsQuery.refetch()}
          className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          <RefreshCw className="h-4 w-4" />
          Refresh
        </button>
      </div>

      {message && (
        <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
          {message}
        </div>
      )}

      {donationsQuery.isLoading ? (
        <Card><CardContent className="p-8 text-center text-sm text-slate-500">Loading your donations…</CardContent></Card>
      ) : donationsQuery.isError ? (
        <Card>
          <CardContent className="space-y-3 p-8 text-center">
            <p className="text-sm text-red-600">{userMessage(donationsQuery.error)}</p>
            <button
              type="button"
              onClick={() => void donationsQuery.refetch()}
              className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white"
            >
              Try again
            </button>
          </CardContent>
        </Card>
      ) : donations.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 p-10 text-center">
            <HeartHandshake className="h-10 w-10 text-emerald-600" />
            <h2 className="font-semibold text-slate-900">No donations yet</h2>
            <p className="max-w-md text-sm text-slate-500">
              Food donations you post will appear here. You can track NGO requests and pickup progress from this page.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {donations.map((donation) => (
            <DonationCard
              key={donation.id}
              donation={donation}
              busy={statusMutation.isPending}
              onRespond={(status) => statusMutation.mutate({ id: donation.id, status })}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function DonationCard({
  donation,
  busy,
  onRespond,
}: {
  donation: Donation
  busy: boolean
  onRespond: (status: 'ACCEPTED' | 'POSTED') => void
}) {
  const ngo = donation.claimedBy

  return (
    <Card>
      <CardContent className="space-y-4 p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-slate-950">{donation.foodName}</h2>
            <p className="mt-1 text-sm text-slate-500">
              {donation.category} · {donation.quantity} · {donation.servings} servings
            </p>
          </div>
          <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-800">
            {statusLabels[donation.status]}
          </span>
        </div>

        <div className="grid gap-2 text-sm text-slate-600 sm:grid-cols-2">
          <p>Food type: {donation.foodType === 'VEG' ? 'Vegetarian' : 'Non-vegetarian'}</p>
          <p>City: {donation.city}</p>
          <p>Posted: {formatDate(donation.createdAt)}</p>
          <p>Available until: {formatDate(donation.availableUntil)}</p>
        </div>

        {donation.status === 'NGO_REQUESTED' && (
          <div className="space-y-3 rounded-xl border border-amber-200 bg-amber-50 p-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-amber-900">
              <Clock3 className="h-4 w-4" />
              An NGO wants to collect this donation
            </div>
            {ngo && (
              <div className="text-sm text-amber-900">
                <p className="font-semibold">{ngo.orgName}</p>
                <p>{ngo.serviceCity}</p>
                <p>{ngo.isVerified ? 'Verified NGO' : 'Verification status unavailable'}</p>
              </div>
            )}
            <p className="text-sm text-amber-800">
              Accept the request to allow the NGO to coordinate pickup, or decline it to make the donation available again.
            </p>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                disabled={busy}
                onClick={() => onRespond('ACCEPTED')}
                className="inline-flex items-center gap-2 rounded-lg bg-emerald-700 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-800 disabled:opacity-50"
              >
                <CheckCircle2 className="h-4 w-4" />
                Accept request
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => onRespond('POSTED')}
                className="inline-flex items-center gap-2 rounded-lg border border-red-200 bg-white px-4 py-2 text-sm font-semibold text-red-700 hover:bg-red-50 disabled:opacity-50"
              >
                <XCircle className="h-4 w-4" />
                Decline request
              </button>
            </div>
          </div>
        )}

        {ngo && donation.status !== 'NGO_REQUESTED' && (
          <div className="rounded-xl bg-slate-50 p-4 text-sm text-slate-700">
            <p className="font-semibold">{ngo.orgName}</p>
            <p>{ngo.serviceCity}</p>
            {ngo.contactPhone && <p>NGO phone: {ngo.contactPhone}</p>}
            {ngo.contactEmail && <p>NGO email: {ngo.contactEmail}</p>}
          </div>
        )}

        {donation.pickupScheduledAt && (
          <p className="text-sm text-slate-600">
            Pickup scheduled: {formatDate(donation.pickupScheduledAt)}
          </p>
        )}
      </CardContent>
    </Card>
  )
}