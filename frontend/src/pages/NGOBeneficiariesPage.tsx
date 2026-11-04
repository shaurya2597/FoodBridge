import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { AlertCircle, CheckCircle2, Clock3, HeartHandshake, MapPin, Search, Users } from 'lucide-react'
import {
  getAssistanceRequests,
  updateAssistanceStatus,
  type AssistanceRequest,
  type AssistanceStatus,
} from '@/services/assistance'

type Tab = 'open' | 'assigned'

const statusStyles: Record<AssistanceStatus, string> = {
  OPEN: 'bg-amber-100 text-amber-800',
  ASSIGNED: 'bg-blue-100 text-blue-800',
  FULFILLED: 'bg-emerald-100 text-emerald-800',
  CLOSED: 'bg-slate-100 text-slate-600',
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

function RequestCard({
  request,
  onUpdate,
  busy,
}: {
  request: AssistanceRequest
  onUpdate: (status: AssistanceStatus) => void
  busy: boolean
}) {
  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-lg font-bold text-slate-900">
            {request.name || 'Beneficiary details available after acceptance'}
          </h3>
          <p className="mt-1 flex items-center gap-1.5 text-sm text-slate-500">
            <MapPin size={15} /> {request.city}
          </p>
        </div>
        <span className={`rounded-full px-3 py-1 text-xs font-semibold ${statusStyles[request.status]}`}>
          {request.status.replace('_', ' ')}
        </span>
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        <div className="flex items-center gap-2 rounded-xl bg-slate-50 p-3">
          <Users size={18} className="text-emerald-700" />
          <div>
            <p className="text-xs text-slate-500">People to support</p>
            <p className="text-sm font-semibold">{request.people}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 rounded-xl bg-slate-50 p-3">
          <Clock3 size={18} className="text-emerald-700" />
          <div>
            <p className="text-xs text-slate-500">Requested on</p>
            <p className="text-sm font-semibold">{formatDate(request.createdAt)}</p>
          </div>
        </div>
      </div>

      <div className="mt-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Food requirements</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {request.requirements.map((item) => (
            <span key={item} className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-800">
              {item}
            </span>
          ))}
        </div>
      </div>

      {request.foodType && (
        <p className="mt-3 text-sm text-slate-600">
          Food preference: <span className="font-semibold">{request.foodType.replace('_', ' ')}</span>
        </p>
      )}

      {request.location && (
        <div className="mt-4 rounded-xl bg-slate-50 p-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Location</p>
          <p className="mt-1 text-sm text-slate-700">{request.location}</p>
        </div>
      )}

      {request.notes && (
        <div className="mt-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Additional notes</p>
          <p className="mt-1 text-sm text-slate-600">{request.notes}</p>
        </div>
      )}

      {request.phone && (
        <p className="mt-3 text-sm text-slate-600">
          Contact: <span className="font-semibold">{request.phone}</span>
        </p>
      )}

      <div className="mt-5 flex flex-wrap gap-2 border-t border-slate-100 pt-4">
        {request.status === 'OPEN' && (
          <button
            type="button"
            disabled={busy}
            onClick={() => onUpdate('ASSIGNED')}
            className="rounded-xl bg-emerald-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-800 disabled:opacity-50"
          >
            Accept request
          </button>
        )}

        {request.status === 'ASSIGNED' && (
          <>
            <button
              type="button"
              disabled={busy}
              onClick={() => onUpdate('FULFILLED')}
              className="rounded-xl bg-emerald-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-800 disabled:opacity-50"
            >
              Mark fulfilled
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => onUpdate('OPEN')}
              className="rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
            >
              Release request
            </button>
          </>
        )}

        {request.status === 'FULFILLED' && (
          <span className="flex items-center gap-2 text-sm font-semibold text-emerald-700">
            <CheckCircle2 size={17} /> Assistance completed
          </span>
        )}
      </div>
    </article>
  )
}

export function NGOBeneficiariesPage() {
  const [tab, setTab] = useState<Tab>('open')
  const [search, setSearch] = useState('')
  const [city, setCity] = useState('')
  const queryClient = useQueryClient()

  const requestsQuery = useQuery({
    queryKey: ['assistance', tab, city.trim()],
    queryFn: () => getAssistanceRequests({
      ...(tab === 'open' ? { status: 'OPEN' as const } : { mine: true }),
      ...(city.trim() ? { city: city.trim() } : {}),
    }),
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: AssistanceStatus }) =>
      updateAssistanceStatus(id, status),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['assistance'] })
    },
  })

  const requests = requestsQuery.data?.data ?? []
  const visibleRequests = requests.filter((request) => {
    if (tab === 'assigned' && request.status === 'OPEN') return false

    const term = search.trim().toLowerCase()
    if (!term) return true

    const searchableText = [
      request.name,
      request.phone,
      request.city,
      request.location,
      request.notes,
      request.foodType,
      ...request.requirements,
    ].filter(Boolean).join(' ').toLowerCase()

    return searchableText.includes(term)
  })

  function handleUpdate(id: string, status: AssistanceStatus) {
    updateMutation.mutate({ id, status })
  }

  return (
    <div className="mx-auto max-w-6xl space-y-7">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-emerald-700">COMMUNITY SUPPORT</p>
          <h1 className="mt-1 text-3xl font-extrabold tracking-tight text-slate-900">Beneficiaries</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
            Find people requesting food assistance, take responsibility for requests,
            and track the support your NGO provides.
          </p>
        </div>
        <div className="grid size-14 place-items-center rounded-2xl bg-emerald-100 text-emerald-800">
          <HeartHandshake size={28} />
        </div>
      </div>

      <div className="flex flex-wrap gap-2 border-b border-slate-200">
        <button
          type="button"
          onClick={() => setTab('open')}
          className={`border-b-2 px-4 py-3 text-sm font-semibold ${
            tab === 'open'
              ? 'border-emerald-700 text-emerald-800'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          Open requests
        </button>
        <button
          type="button"
          onClick={() => setTab('assigned')}
          className={`border-b-2 px-4 py-3 text-sm font-semibold ${
            tab === 'assigned'
              ? 'border-emerald-700 text-emerald-800'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          My beneficiaries
        </button>
      </div>

      <div className="grid gap-3 rounded-2xl border border-slate-200 bg-white p-4 sm:grid-cols-2">
        <label className="block">
          <span className="mb-2 block text-xs font-semibold text-slate-600">Search requests</span>
          <span className="flex items-center gap-2 rounded-xl border border-slate-200 px-3 focus-within:border-emerald-600">
            <Search size={17} className="shrink-0 text-slate-400" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Name, phone, location or food..."
              className="min-w-0 flex-1 bg-transparent py-3 text-sm outline-none"
            />
          </span>
        </label>
        <label className="block">
          <span className="mb-2 block text-xs font-semibold text-slate-600">Filter by city</span>
          <input
            value={city}
            onChange={(event) => setCity(event.target.value)}
            placeholder="Enter city name..."
            className="w-full rounded-xl border border-slate-200 px-3 py-3 text-sm outline-none focus:border-emerald-600"
          />
        </label>
      </div>

      {updateMutation.isError && (
        <div role="alert" className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          <AlertCircle size={17} />
          {updateMutation.error instanceof Error
            ? updateMutation.error.message
            : 'Could not update this request. Please try again.'}
        </div>
      )}

      {requestsQuery.isLoading && (
        <p className="py-12 text-center text-sm text-slate-500">Loading assistance requests...</p>
      )}

      {requestsQuery.isError && (
        <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-5 text-sm text-red-700">
          Could not load assistance requests. Please refresh and try again.
        </div>
      )}

      {requestsQuery.isSuccess && visibleRequests.length === 0 && (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-14 text-center">
          <div className="mx-auto grid size-14 place-items-center rounded-2xl bg-slate-100 text-slate-500">
            <HeartHandshake size={26} />
          </div>
          <h2 className="mt-4 text-lg font-bold text-slate-800">
            {search.trim() || city.trim()
              ? 'No matching requests found'
              : tab === 'open' ? 'No open requests right now' : 'No assigned beneficiaries yet'}
          </h2>
          <p className="mt-2 text-sm text-slate-500">
            {search.trim() || city.trim()
              ? 'Try changing your search or city filter.'
              : tab === 'open'
                ? 'New food assistance requests will appear here.'
                : 'Accept an open request to start helping a beneficiary.'}
          </p>
        </div>
      )}

      {requestsQuery.isSuccess && visibleRequests.length > 0 && (
        <>
          <p className="text-sm text-slate-500">
            Showing {visibleRequests.length} request{visibleRequests.length === 1 ? '' : 's'}
          </p>
          <div className="grid gap-5 lg:grid-cols-2">
            {visibleRequests.map((request) => (
              <RequestCard
                key={request.id}
                request={request}
                busy={updateMutation.isPending}
                onUpdate={(status) => handleUpdate(request.id, status)}
              />
            ))}
          </div>
        </>
      )}
    </div>
  )
}
