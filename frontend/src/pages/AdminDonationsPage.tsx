import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { AlertTriangle, RefreshCw } from 'lucide-react'
import {
  flagAdminDonation,
  getAdminDonations,
  unflagAdminDonation,
  type AdminDonationStatus,
} from '@/services/admin'

const statuses: AdminDonationStatus[] = [
  'POSTED',
  'NGO_REQUESTED',
  'ACCEPTED',
  'PICKUP_SCHEDULED',
  'COLLECTED',
  'DISTRIBUTED',
  'EXPIRED',
  'FLAGGED',
  'CANCELLED',
]

const date = (value: string) =>
  new Date(value).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })

export function AdminDonationsPage() {
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('')
  const [page, setPage] = useState(1)
  const queryClient = useQueryClient()

  const donationsQuery = useQuery({
    queryKey: ['admin', 'donations', search, status, page],
    queryFn: ({ signal }) =>
      getAdminDonations({
        q: search.trim() || undefined,
        status: status ? (status as AdminDonationStatus) : undefined,
        page,
        limit: 10,
      }, signal),
  })

  const refresh = () =>
    queryClient.invalidateQueries({ queryKey: ['admin', 'donations'] })

  const flagMutation = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      flagAdminDonation(id, reason),
    onSuccess: refresh,
  })

  const unflagMutation = useMutation({
    mutationFn: (id: string) => unflagAdminDonation(id),
    onSuccess: refresh,
  })

  const donations = donationsQuery.data?.data ?? []
  const meta = donationsQuery.data?.meta

  function flagDonation(id: string) {
    const reason = window.prompt('Enter the reason for flagging this donation:')
    if (!reason?.trim()) return
    flagMutation.mutate({ id, reason: reason.trim() })
  }

  function unflagDonation(id: string) {
    if (!window.confirm('Remove the flag from this donation?')) return
    unflagMutation.mutate(id)
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Donation Management</h1>
        <p className="mt-1 text-sm text-slate-500">
          Review donated food, monitor expiry, and moderate reported donations.
        </p>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row">
        <input
          value={search}
          onChange={(event) => {
            setSearch(event.target.value)
            setPage(1)
          }}
          placeholder="Search food or donor..."
          className="min-w-0 flex-1 rounded-xl border border-slate-200 px-4 py-2.5 text-sm outline-none focus:border-emerald-500"
        />
        <select
          value={status}
          onChange={(event) => {
            setStatus(event.target.value)
            setPage(1)
          }}
          className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm"
        >
          <option value="">All statuses</option>
          {statuses.map((item) => (
            <option key={item} value={item}>{item.replaceAll('_', ' ')}</option>
          ))}
        </select>
        <button
          onClick={() => void donationsQuery.refetch()}
          className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-medium hover:bg-slate-50"
        >
          <RefreshCw size={16} /> Refresh
        </button>
      </div>

      {donationsQuery.isLoading ? (
        <div className="py-12 text-center text-sm text-slate-500">Loading donations...</div>
      ) : donationsQuery.isError ? (
        <div className="rounded-xl border border-red-200 bg-red-50 p-5 text-sm text-red-700">
          Could not load donations. Please refresh and try again.
        </div>
      ) : donations.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white p-10 text-center text-sm text-slate-500">
          No donations found for these filters.
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[850px] text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-5 py-4">Food / Donor</th>
                  <th className="px-5 py-4">Quantity</th>
                  <th className="px-5 py-4">Location</th>
                  <th className="px-5 py-4">Expiry</th>
                  <th className="px-5 py-4">Status</th>
                  <th className="px-5 py-4">Claimed by</th>
                  <th className="px-5 py-4">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {donations.map((donation) => (
                  <tr key={donation.id} className="align-top hover:bg-slate-50/70">
                    <td className="px-5 py-4">
                      <p className="font-semibold text-slate-900">{donation.foodName}</p>
                      <p className="mt-1 text-xs text-slate-500">
                        {donation.donorName} · {donation.donorType}
                      </p>
                      <p className="mt-1 text-xs text-slate-400">
                        {donation.category} · {donation.foodType}
                      </p>
                      {donation.flagReason && (
                        <p className="mt-2 text-xs text-red-600">
                          Flag: {donation.flagReason}
                        </p>
                      )}
                    </td>
                    <td className="px-5 py-4">
                      <p className="font-medium text-slate-800">{donation.quantity}</p>
                      <p className="text-xs text-slate-500">{donation.servings} servings</p>
                    </td>
                    <td className="px-5 py-4 text-slate-600">{donation.city}</td>
                    <td className="px-5 py-4">
                      <p className={donation.isExpired ? 'font-medium text-red-600' : 'text-slate-700'}>
                        {date(donation.availableUntil)}
                      </p>
                      {donation.isExpired && (
                        <p className="text-xs text-red-500">Expired</p>
                      )}
                    </td>
                    <td className="px-5 py-4">
                      <span className="inline-flex rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700">
                        {donation.status.replaceAll('_', ' ')}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-slate-600">
                      {donation.claimedBy?.orgName ?? '—'}
                    </td>
                    <td className="px-5 py-4">
                      {donation.status === 'FLAGGED' ? (
                        <button
                          disabled={unflagMutation.isPending}
                          onClick={() => unflagDonation(donation.id)}
                          className="rounded-lg border border-emerald-200 px-3 py-1.5 text-xs font-medium text-emerald-700 hover:bg-emerald-50 disabled:opacity-50"
                        >
                          Unflag
                        </button>
                      ) : !['CANCELLED', 'EXPIRED', 'DISTRIBUTED'].includes(donation.status) ? (
                        <button
                          disabled={flagMutation.isPending}
                          onClick={() => flagDonation(donation.id)}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-50 disabled:opacity-50"
                        >
                          <AlertTriangle size={13} /> Flag
                        </button>
                      ) : (
                        <span className="text-xs text-slate-400">No action</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {meta && meta.totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-slate-500">
            Page {meta.page} of {meta.totalPages} · {meta.total} donations
          </p>
          <div className="flex gap-2">
            <button
              disabled={page <= 1}
              onClick={() => setPage((current) => current - 1)}
              className="rounded-lg border border-slate-200 px-3 py-2 text-sm disabled:opacity-40"
            >
              Previous
            </button>
            <button
              disabled={page >= meta.totalPages}
              onClick={() => setPage((current) => current + 1)}
              className="rounded-lg border border-slate-200 px-3 py-2 text-sm disabled:opacity-40"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
