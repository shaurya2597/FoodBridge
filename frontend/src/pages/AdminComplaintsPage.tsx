import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { AlertCircle, CheckCircle, Clock, Eye, RefreshCw, Search } from 'lucide-react'
import {
  getAdminComplaints,
  getAdminComplaintDetail,
  updateAdminComplaint,
  type AdminComplaint,
  type AdminComplaintStatus,
  type AdminComplaintCategory,
} from '@/services/admin'

const statuses: AdminComplaintStatus[] = ['OPEN', 'IN_REVIEW', 'RESOLVED', 'REJECTED']
const categories: AdminComplaintCategory[] = ['ORDER', 'DELIVERY', 'FOOD_QUALITY', 'PAYMENT', 'DONATION', 'OTHER']

function pretty(value: string) {
  return value.replaceAll('_', ' ').toLowerCase().replace(/\b\w/g, (letter) => letter.toUpperCase())
}

function date(value: string) {
  return new Date(value).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })
}

export function AdminComplaintsPage() {
  const client = useQueryClient()
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('')
  const [category, setCategory] = useState('')
  const [page, setPage] = useState(1)
  const [selectedId, setSelectedId] = useState('')
  const [resolution, setResolution] = useState('')
  const [notice, setNotice] = useState('')

  const listQuery = useQuery({
    queryKey: ['admin', 'complaints', search, status, category, page],
    queryFn: ({ signal }) => getAdminComplaints({
      q: search.trim() || undefined,
      status: (status || undefined) as AdminComplaintStatus | undefined,
      category: (category || undefined) as AdminComplaintCategory | undefined,
      page,
      limit: 10,
    }, signal),
  })

  const detailQuery = useQuery({
    queryKey: ['admin', 'complaint', selectedId],
    queryFn: ({ signal }) => getAdminComplaintDetail(selectedId, signal),
    enabled: Boolean(selectedId),
  })

  const updateMutation = useMutation({
    mutationFn: (nextStatus: Exclude<AdminComplaintStatus, 'OPEN'>) => {
      const closing = nextStatus === 'RESOLVED' || nextStatus === 'REJECTED'
      const note = resolution.trim()
      if (closing && note.length < 5) throw new Error('Enter a resolution message of at least 5 characters.')
      return updateAdminComplaint(selectedId, {
        status: nextStatus,
        ...(note ? { resolution: note } : {}),
      })
    },
    onSuccess: async () => {
      setNotice('Complaint updated successfully.')
      setResolution('')
      await Promise.all([
        client.invalidateQueries({ queryKey: ['admin', 'complaints'] }),
        client.invalidateQueries({ queryKey: ['admin', 'complaint', selectedId] }),
      ])
    },
    onError: (error) => setNotice(error instanceof Error ? error.message : 'Could not update complaint.'),
  })

  const complaints = listQuery.data?.data ?? []
  const meta = listQuery.data?.meta
  const selected: AdminComplaint | undefined = detailQuery.data

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Complaints</h1>
          <p className="mt-1 text-sm text-slate-500">Review customer complaints and track their resolution.</p>
        </div>
        <button onClick={() => { void listQuery.refetch(); if (selectedId) void detailQuery.refetch() }}
          className="inline-flex items-center gap-2 rounded-xl border px-4 py-2 text-sm font-medium hover:bg-slate-50">
          <RefreshCw size={16} /> Refresh
        </button>
      </div>

      {notice && (
        <div className="rounded-xl bg-slate-50 p-3 text-sm text-slate-700">
          {notice}
          <button onClick={() => setNotice('')} className="ml-3 font-semibold underline">Dismiss</button>
        </div>
      )}

      <div className="grid gap-3 md:grid-cols-[1fr_190px_190px]">
        <div className="relative">
          <Search className="absolute left-3 top-3 text-slate-400" size={17} />
          <input value={search} onChange={(event) => { setSearch(event.target.value); setPage(1) }}
            placeholder="Search subject, details or customer email..."
            className="w-full rounded-xl border border-slate-200 py-2.5 pl-10 pr-3 text-sm outline-none focus:border-slate-400" />
        </div>
        <select value={status} onChange={(event) => { setStatus(event.target.value); setPage(1) }}
          className="rounded-xl border border-slate-200 px-3 py-2 text-sm">
          <option value="">All statuses</option>
          {statuses.map((item) => <option key={item} value={item}>{pretty(item)}</option>)}
        </select>
        <select value={category} onChange={(event) => { setCategory(event.target.value); setPage(1) }}
          className="rounded-xl border border-slate-200 px-3 py-2 text-sm">
          <option value="">All categories</option>
          {categories.map((item) => <option key={item} value={item}>{pretty(item)}</option>)}
        </select>
      </div>

      {listQuery.isLoading ? (
        <p className="py-12 text-center text-sm text-slate-500">Loading complaints...</p>
      ) : listQuery.isError ? (
        <div className="rounded-xl border border-red-200 bg-red-50 p-5 text-sm text-red-700">Could not load complaints. Please refresh.</div>
      ) : complaints.length === 0 ? (
        <div className="rounded-xl border border-slate-200 p-10 text-center text-sm text-slate-500">No complaints found for these filters.</div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
          <table className="w-full min-w-[850px] text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500">
              <tr>
                <th className="px-5 py-4">Complaint</th><th className="px-5 py-4">Customer</th>
                <th className="px-5 py-4">Category</th><th className="px-5 py-4">Status</th>
                <th className="px-5 py-4">Submitted</th><th className="px-5 py-4 text-right">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {complaints.map((item) => (
                <tr key={item.id} className="hover:bg-slate-50/70">
                  <td className="px-5 py-4"><p className="font-semibold text-slate-900">{item.subject}</p><p className="mt-1 text-xs text-slate-500">{item.id}</p></td>
                  <td className="px-5 py-4"><p className="font-medium">{item.user.name}</p><p className="mt-1 text-xs text-slate-500">{item.user.email}</p></td>
                  <td className="px-5 py-4 text-xs">{pretty(item.category)}</td>
                  <td className="px-5 py-4"><span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium">{pretty(item.status)}</span></td>
                  <td className="px-5 py-4 text-xs text-slate-500">{date(item.createdAt)}</td>
                  <td className="px-5 py-4 text-right">
                    <button onClick={() => { setSelectedId(item.id); setResolution(''); setNotice('') }}
                      className="inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-semibold hover:bg-slate-50">
                      <Eye size={14} /> Review
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {meta && meta.totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-slate-500">Page {meta.page} of {meta.totalPages} · {meta.total} complaints</p>
          <div className="flex gap-2">
            <button disabled={page <= 1} onClick={() => setPage((value) => value - 1)}
              className="rounded-lg border px-3 py-2 text-sm disabled:opacity-40">Previous</button>
            <button disabled={page >= meta.totalPages} onClick={() => setPage((value) => value + 1)}
              className="rounded-lg border px-3 py-2 text-sm disabled:opacity-40">Next</button>
          </div>
        </div>
      )}

      {selectedId && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-950/50 p-4 pt-10">
          <div className="my-auto w-full max-w-2xl rounded-2xl bg-white p-6 shadow-xl">
            <div className="flex items-start justify-between gap-3">
              <div><h2 className="text-xl font-bold text-slate-900">Complaint details</h2><p className="mt-1 text-xs text-slate-500">{selectedId}</p></div>
              <button onClick={() => setSelectedId('')} className="rounded-lg border px-3 py-1.5 text-sm">Close</button>
            </div>

            {detailQuery.isLoading ? <p className="py-10 text-center text-sm text-slate-500">Loading details...</p> :
              detailQuery.isError || !selected ? <p className="py-8 text-sm text-red-600">Could not load complaint details. Close and try again.</p> : (
                <div className="mt-5 space-y-5">
                  <div><div className="flex flex-wrap items-center gap-2"><span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold">{pretty(selected.status)}</span><span className="text-xs text-slate-500">{pretty(selected.category)} · {date(selected.createdAt)}</span></div>
                    <h3 className="mt-3 text-lg font-semibold">{selected.subject}</h3><p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-700">{selected.details}</p></div>
                  <div className="grid gap-3 rounded-xl bg-slate-50 p-4 sm:grid-cols-2">
                    <div><p className="text-xs text-slate-500">Submitted by</p><p className="mt-1 text-sm font-semibold">{selected.user.name}</p><p className="text-xs text-slate-500">{selected.user.email}</p></div>
                    <div><p className="text-xs text-slate-500">Linked record</p>
                      {selected.order ? <p className="mt-1 text-sm">Order {selected.order.orderNumber} · {pretty(selected.order.status)}</p> :
                        selected.donation ? <p className="mt-1 text-sm">{selected.donation.foodName} · {pretty(selected.donation.status)}</p> :
                          <p className="mt-1 text-sm">No linked order or donation</p>}
                    </div>
                  </div>
                  {selected.resolution && <div className="rounded-xl border border-green-200 bg-green-50 p-4"><p className="text-xs font-semibold text-green-800">Resolution</p><p className="mt-1 whitespace-pre-wrap text-sm text-green-900">{selected.resolution}</p></div>}
                  {selected.status !== 'RESOLVED' && selected.status !== 'REJECTED' && (
                    <div className="space-y-3 border-t pt-4">
                      <label className="block text-sm font-semibold text-slate-800" htmlFor="complaint-resolution">Resolution / review note</label>
                      <textarea id="complaint-resolution" value={resolution} onChange={(event) => setResolution(event.target.value)}
                        rows={3} maxLength={1000} placeholder="Enter at least 5 characters to resolve or reject..."
                        className="w-full rounded-xl border border-slate-200 p-3 text-sm outline-none focus:border-slate-400" />
                      <div className="flex flex-wrap justify-end gap-2">
                        {selected.status === 'OPEN' && <button disabled={updateMutation.isPending} onClick={() => updateMutation.mutate('IN_REVIEW')}
                          className="inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-semibold disabled:opacity-50"><Clock size={15} /> Mark in review</button>}
                        <button disabled={updateMutation.isPending || resolution.trim().length < 5} onClick={() => updateMutation.mutate('RESOLVED')}
                          className="inline-flex items-center gap-2 rounded-lg bg-green-600 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50"><CheckCircle size={15} /> Resolve</button>
                        <button disabled={updateMutation.isPending || resolution.trim().length < 5} onClick={() => updateMutation.mutate('REJECTED')}
                          className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50"><AlertCircle size={15} /> Reject</button>
                      </div>
                    </div>
                  )}
                  {selected.resolvedAt && <p className="text-xs text-slate-500">Closed: {date(selected.resolvedAt)}</p>}
                </div>
              )}
          </div>
        </div>
      )}
    </div>
  )
}
