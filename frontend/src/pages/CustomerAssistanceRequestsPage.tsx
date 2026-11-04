import { useQuery } from '@tanstack/react-query'
import { AlertCircle, CheckCircle2, Clock3, HeartHandshake, MapPin, Users } from 'lucide-react'
import {
  getAssistanceRequests,
  type AssistanceStatus,
} from '@/services/assistance'

const statusStyles: Record<AssistanceStatus, string> = {
  OPEN: 'bg-amber-50 text-amber-700 border-amber-200',
  ASSIGNED: 'bg-blue-50 text-blue-700 border-blue-200',
  FULFILLED: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  CLOSED: 'bg-slate-100 text-slate-600 border-slate-200',
}

const statusDescriptions: Record<AssistanceStatus, string> = {
  OPEN: 'Waiting for a verified NGO to accept your request.',
  ASSIGNED: 'An NGO has accepted your request and will coordinate with you.',
  FULFILLED: 'Your food assistance request has been fulfilled.',
  CLOSED: 'This request has been closed.',
}

export function CustomerAssistanceRequestsPage() {
  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['customer-assistance-requests'],
    queryFn: ({ signal }) => getAssistanceRequests({ mine: true }, signal),
  })

  const requests = data?.data ?? []

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="mb-2 flex items-center gap-2 text-sm font-medium text-emerald-700">
            <HeartHandshake size={18} />
            Food assistance
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            My Assistance Requests
          </h1>
          <p className="mt-2 text-sm text-slate-600">
            Follow the progress of your food assistance requests.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void refetch()}
          className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          Refresh
        </button>
      </div>

      {isLoading && (
        <div className="rounded-xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500">
          Loading your requests...
        </div>
      )}

      {isError && (
        <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          <AlertCircle size={20} className="mt-0.5 shrink-0" />
          <div>
            <p className="font-semibold">Could not load your requests</p>
            <p className="mt-1">{error instanceof Error ? error.message : 'Please try again.'}</p>
            <button
              type="button"
              onClick={() => void refetch()}
              className="mt-3 font-semibold underline"
            >
              Try again
            </button>
          </div>
        </div>
      )}

      {!isLoading && !isError && requests.length === 0 && (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-12 text-center">
          <HeartHandshake className="mx-auto text-slate-400" size={36} />
          <h2 className="mt-3 font-semibold text-slate-900">No assistance requests yet</h2>
          <p className="mt-1 text-sm text-slate-500">
            Your food assistance requests will appear here after submission.
          </p>
        </div>
      )}

      <div className="space-y-4">
        {requests.map((request) => (
          <article
            key={request.id}
            className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                  Request ID
                </p>
                <p className="mt-1 break-all font-mono text-sm text-slate-700">
                  {request.id}
                </p>
              </div>
              <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${statusStyles[request.status]}`}>
                {request.status.replace('_', ' ')}
              </span>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="flex items-center gap-2 text-sm text-slate-700">
                <Users size={17} className="text-slate-400" />
                {request.people} {request.people === 1 ? 'person' : 'people'}
              </div>
              <div className="flex items-center gap-2 text-sm text-slate-700">
                <MapPin size={17} className="text-slate-400" />
                {request.city}
              </div>
              <div className="flex items-center gap-2 text-sm text-slate-700">
                <Clock3 size={17} className="text-slate-400" />
                {new Date(request.createdAt).toLocaleString()}
              </div>
              <div className="flex items-center gap-2 text-sm text-slate-700">
                <HeartHandshake size={17} className="text-slate-400" />
                {request.foodType === 'VEG'
                  ? 'Vegetarian'
                  : request.foodType === 'NON_VEG'
                    ? 'Non-vegetarian'
                    : 'No food preference'}
              </div>
            </div>

            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Requirements
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                {request.requirements.map((item) => (
                  <span key={item} className="rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-700">
                    {item}
                  </span>
                ))}
              </div>
            </div>

            {request.location && (
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Location
                </p>
                <p className="mt-1 text-sm text-slate-700">{request.location}</p>
              </div>
            )}

            <div className="rounded-xl bg-slate-50 p-4">
              <div className="flex items-center gap-2 text-sm font-semibold text-slate-800">
                {request.status === 'FULFILLED'
                  ? <CheckCircle2 size={18} className="text-emerald-600" />
                  : <Clock3 size={18} className="text-slate-500" />}
                Request status
              </div>
              <p className="mt-1 text-sm text-slate-600">
                {statusDescriptions[request.status]}
              </p>
              {request.assignedNgo && (
                <p className="mt-2 text-sm font-medium text-slate-700">
                  Assigned NGO: {request.assignedNgo}
                </p>
              )}
            </div>
          </article>
        ))}
      </div>
    </div>
  )
}
