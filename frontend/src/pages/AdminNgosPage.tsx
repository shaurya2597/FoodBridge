import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { CheckCircle, RefreshCw, Search, ShieldCheck, XCircle } from 'lucide-react'
import { getAdminNgos, setAdminNgoVerification } from '@/services/admin'

export function AdminNgosPage() {
  const queryClient = useQueryClient()
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('all')
  const [page, setPage] = useState(1)
  const [notice, setNotice] = useState('')

  const ngosQuery = useQuery({
    queryKey: ['admin', 'ngos', search, filter, page],
    queryFn: ({ signal }) =>
      getAdminNgos({
        q: search.trim() || undefined,
        verified: filter === 'all' ? undefined : filter === 'verified',
        page,
        limit: 10,
      }, signal),
  })

  const verificationMutation = useMutation({
    mutationFn: ({ id, verified }: { id: string; verified: boolean }) => {
      const note = window.prompt(
        verified ? 'Optional verification note:' : 'Reason for revoking verification:',
      )
      if (note === null) throw new Error('Action cancelled.')
      if (!verified && note.trim().length < 3) {
        throw new Error('Please enter a reason of at least 3 characters.')
      }
      return setAdminNgoVerification(id, {
        verified,
        ...(note.trim() ? { note: note.trim() } : {}),
      })
    },
    onSuccess: async (_, variables) => {
      setNotice(variables.verified ? 'NGO verified successfully.' : 'NGO verification revoked.')
      await queryClient.invalidateQueries({ queryKey: ['admin', 'ngos'] })
    },
    onError: (error) => {
      setNotice(error instanceof Error ? error.message : 'Could not update NGO verification.')
    },
  })

  const ngos = ngosQuery.data?.data ?? []
  const meta = ngosQuery.data?.meta

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">NGO Verification</h1>
          <p className="mt-1 text-sm text-slate-500">Review registered NGOs and manage verification status.</p>
        </div>
        <button
          onClick={() => void ngosQuery.refetch()}
          className="inline-flex items-center gap-2 rounded-xl border px-4 py-2 text-sm font-medium hover:bg-slate-50"
        >
          <RefreshCw size={16} /> Refresh
        </button>
      </div>

      <div className="flex flex-wrap gap-3">
        <div className="relative min-w-56 flex-1">
          <Search className="absolute left-3 top-3 text-slate-400" size={17} />
          <input
            value={search}
            onChange={(event) => { setSearch(event.target.value); setPage(1) }}
            placeholder="Search NGO, city or registration..."
            className="w-full rounded-xl border border-slate-200 py-2.5 pl-10 pr-3 text-sm outline-none focus:border-slate-400"
          />
        </div>
        <select
          value={filter}
          onChange={(event) => { setFilter(event.target.value); setPage(1) }}
          className="rounded-xl border border-slate-200 px-4 py-2 text-sm"
        >
          <option value="all">All NGOs</option>
          <option value="verified">Verified</option>
          <option value="unverified">Pending verification</option>
        </select>
      </div>

      {notice && (
        <div className="rounded-xl bg-slate-50 p-3 text-sm text-slate-700">
          {notice}
          <button onClick={() => setNotice('')} className="ml-3 font-semibold underline">Dismiss</button>
        </div>
      )}

      {ngosQuery.isLoading ? (
        <p className="py-12 text-center text-sm text-slate-500">Loading NGOs...</p>
      ) : ngosQuery.isError ? (
        <div className="rounded-xl border border-red-200 bg-red-50 p-5 text-sm text-red-700">
          Could not load NGOs. Please refresh.
        </div>
      ) : ngos.length === 0 ? (
        <div className="rounded-xl border border-slate-200 p-10 text-center text-sm text-slate-500">
          No NGOs found for this filter.
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[850px] text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-5 py-4">Organization</th>
                  <th className="px-5 py-4">Contact</th>
                  <th className="px-5 py-4">Activity</th>
                  <th className="px-5 py-4">Status</th>
                  <th className="px-5 py-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {ngos.map((ngo) => (
                  <tr key={ngo.id} className="hover:bg-slate-50/70">
                    <td className="px-5 py-4">
                      <p className="font-semibold text-slate-900">{ngo.orgName}</p>
                      <p className="mt-1 text-xs text-slate-500">{ngo.serviceCity}</p>
                      <p className="mt-1 text-xs text-slate-400">Reg: {ngo.registrationNo || 'Not provided'}</p>
                    </td>
                    <td className="px-5 py-4">
                      <p className="font-medium">{ngo.user.name}</p>
                      <p className="mt-1 text-xs text-slate-500">{ngo.user.email}</p>
                      {ngo.user.isBlocked && <p className="mt-1 text-xs text-red-600">Account blocked</p>}
                    </td>
                    <td className="px-5 py-4 text-xs text-slate-600">
                      <p>{ngo._count.donations} donations</p>
                      <p className="mt-1">{ngo._count.requests} donation requests</p>
                      <p className="mt-1">{ngo._count.assistanceRequests} assistance requests</p>
                    </td>
                    <td className="px-5 py-4">
                      {ngo.isVerified ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-green-50 px-2.5 py-1 text-xs font-medium text-green-700">
                          <CheckCircle size={13} /> Verified
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-700">
                          <XCircle size={13} /> Pending
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-4 text-right">
                      <button
                        disabled={verificationMutation.isPending || ngo.user.isBlocked}
                        onClick={() => verificationMutation.mutate({
                          id: ngo.id,
                          verified: !ngo.isVerified,
                        })}
                        className="inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-semibold hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        <ShieldCheck size={14} />
                        {ngo.isVerified ? 'Revoke' : 'Verify'}
                      </button>
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
            Page {meta.page} of {meta.totalPages} · {meta.total} NGOs
          </p>
          <div className="flex gap-2">
            <button
              disabled={page <= 1}
              onClick={() => setPage((current) => current - 1)}
              className="rounded-lg border px-3 py-2 text-sm disabled:opacity-40"
            >
              Previous
            </button>
            <button
              disabled={page >= meta.totalPages}
              onClick={() => setPage((current) => current + 1)}
              className="rounded-lg border px-3 py-2 text-sm disabled:opacity-40"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  )
}