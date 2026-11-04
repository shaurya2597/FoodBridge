import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ClipboardList, RefreshCw } from 'lucide-react'
import {
  getAdminDonationRequests,
  type AdminDonationRequestStatus,
} from '@/services/admin'

const statuses: Array<'ALL' | AdminDonationRequestStatus> = [
  'ALL',
  'PENDING',
  'APPROVED',
  'REJECTED',
  'WITHDRAWN',
]

const statusStyles: Record<string, string> = {
  PENDING: 'bg-amber-100 text-amber-800',
  APPROVED: 'bg-green-100 text-green-800',
  REJECTED: 'bg-red-100 text-red-800',
  WITHDRAWN: 'bg-slate-100 text-slate-700',
}

export default function AdminDonationRequestsPage() {
  const [status, setStatus] = useState<(typeof statuses)[number]>('ALL')
  const [page, setPage] = useState(1)

  const requestsQuery = useQuery({
    queryKey: ['admin', 'donation-requests', status, page],
    queryFn: ({ signal }) =>
      getAdminDonationRequests(
        { status: status === 'ALL' ? undefined : status, page, limit: 10 },
        signal,
      ),
  })

  const requests = requestsQuery.data?.data ?? []
  const meta = requestsQuery.data?.meta

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Donation Requests</h1>
          <p className="mt-1 text-sm text-slate-500">
            Monitor NGO requests for available food donations.
          </p>
        </div>
        <div className="flex items-center gap-2 text-sm text-slate-500">
          <ClipboardList size={18} />
          {meta ? `${meta.total} total requests` : 'Loading requests...'}
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {statuses.map((item) => (
          <button
            key={item}
            onClick={() => {
              setStatus(item)
              setPage(1)
            }}
            className={`rounded-full px-4 py-2 text-sm font-medium transition ${
              status === item
                ? 'bg-slate-900 text-white'
                : 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
            }`}
          >
            {item === 'ALL' ? 'All statuses' : item.replace('_', ' ')}
          </button>
        ))}
      </div>

      {requestsQuery.isLoading ? (
        <div className="rounded-xl border border-slate-200 bg-white p-10 text-center text-slate-500">
          Loading donation requests...
        </div>
      ) : requestsQuery.isError ? (
        <div className="rounded-xl border border-red-200 bg-red-50 p-5 text-sm text-red-700">
          Could not load donation requests.
          <button
            onClick={() => void requestsQuery.refetch()}
            className="ml-2 inline-flex items-center gap-1 font-semibold underline"
          >
            <RefreshCw size={14} /> Retry
          </button>
        </div>
      ) : requests.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white p-10 text-center">
          <ClipboardList className="mx-auto mb-3 text-slate-400" size={32} />
          <p className="font-medium text-slate-800">No donation requests found</p>
          <p className="mt-1 text-sm text-slate-500">
            Requests will appear here when NGOs request donations.
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-5 py-4">NGO</th>
                  <th className="px-5 py-4">Donation</th>
                  <th className="px-5 py-4">City</th>
                  <th className="px-5 py-4">Servings</th>
                  <th className="px-5 py-4">Request status</th>
                  <th className="px-5 py-4">Requested on</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {requests.map((request) => (
                  <tr key={request.id} className="hover:bg-slate-50">
                    <td className="px-5 py-4">
                      <p className="font-medium text-slate-900">{request.ngo.orgName}</p>
                      <p className="mt-1 text-xs text-slate-500">
                        {request.ngo.isVerified ? 'Verified NGO' : 'Not verified'}
                      </p>
                    </td>
                    <td className="px-5 py-4">
                      <p className="font-medium text-slate-900">{request.donation.foodName}</p>
                      <p className="mt-1 text-xs text-slate-500">
                        Donation: {request.donation.status.replace('_', ' ')}
                      </p>
                    </td>
                    <td className="px-5 py-4 text-slate-600">{request.donation.city}</td>
                    <td className="px-5 py-4 text-slate-600">{request.donation.servings}</td>
                    <td className="px-5 py-4">
                      <span
                        className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                          statusStyles[request.status] ?? 'bg-slate-100 text-slate-700'
                        }`}
                      >
                        {request.status}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-5 py-4 text-slate-600">
                      {new Date(request.createdAt).toLocaleString('en-IN')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex items-center justify-between border-t border-slate-100 px-5 py-4">
            <p className="text-xs text-slate-500">
              Page {meta?.page ?? page} of {meta?.totalPages ?? 1}
            </p>
            <div className="flex gap-2">
              <button
                disabled={page <= 1}
                onClick={() => setPage((current) => current - 1)}
                className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm disabled:opacity-40"
              >
                Previous
              </button>
              <button
                disabled={!meta || page >= meta.totalPages}
                onClick={() => setPage((current) => current + 1)}
                className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm disabled:opacity-40"
              >
                Next
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}