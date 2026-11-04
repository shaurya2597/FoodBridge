import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Activity, ChevronDown, ChevronUp, RefreshCw, Search } from 'lucide-react'
import { getAdminAuditLogs } from '../services/admin'

const formatDate = (value: string) =>
  new Date(value).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })

export function AdminAuditLogsPage() {
  const [entityType, setEntityType] = useState('')
  const [adminId, setAdminId] = useState('')
  const [page, setPage] = useState(1)
  const [expanded, setExpanded] = useState<string | null>(null)

  const logsQuery = useQuery({
    queryKey: ['admin', 'audit-logs', entityType, adminId, page],
    queryFn: ({ signal }) => getAdminAuditLogs({
      entityType: entityType || undefined,
      adminId: adminId.trim() || undefined,
      page,
      limit: 15,
    }, signal),
  })

  const logs = logsQuery.data?.data ?? []
  const meta = logsQuery.data?.meta

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center gap-2 text-sm font-medium text-violet-700">
          <Activity size={16} /> Administration
        </div>
        <h1 className="mt-2 text-2xl font-bold text-slate-900">Audit Logs</h1>
        <p className="mt-1 text-sm text-slate-500">Review administrative actions and their recorded details.</p>
      </div>

      <div className="grid gap-3 rounded-2xl border border-slate-200 bg-white p-4 sm:grid-cols-2">
        <label className="space-y-1 text-sm font-medium text-slate-700">
          Entity type
          <select
            value={entityType}
            onChange={(event) => { setEntityType(event.target.value); setPage(1) }}
            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 font-normal"
          >
            <option value="">All entity types</option>
            {['USER', 'RESTAURANT', 'NGO', 'DONATION', 'COMPLAINT', 'ORDER'].map((item) => (
              <option key={item} value={item}>{item}</option>
            ))}
          </select>
        </label>
        <label className="space-y-1 text-sm font-medium text-slate-700">
          Admin ID
          <input
            value={adminId}
            onChange={(event) => { setAdminId(event.target.value); setPage(1) }}
            placeholder="Filter by admin ID"
            className="w-full rounded-xl border border-slate-200 px-3 py-2.5 font-normal"
          />
        </label>
      </div>

      {logsQuery.isError && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          Could not load audit logs. Please refresh and try again.
        </div>
      )}

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
        <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
          <div>
            <h2 className="font-semibold text-slate-900">Activity history</h2>
            <p className="text-xs text-slate-500">{meta?.total ?? 0} recorded actions</p>
          </div>
          <button
            type="button"
            onClick={() => void logsQuery.refetch()}
            disabled={logsQuery.isFetching}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            <RefreshCw size={15} className={logsQuery.isFetching ? 'animate-spin' : ''} />
            Refresh
          </button>
        </div>

        {logsQuery.isLoading ? (
          <p className="p-8 text-center text-sm text-slate-500">Loading audit logs...</p>
        ) : logs.length === 0 ? (
          <div className="p-10 text-center">
            <Search className="mx-auto text-slate-300" size={28} />
            <p className="mt-2 font-medium text-slate-700">No audit logs found</p>
            <p className="mt-1 text-sm text-slate-500">Try changing your filters.</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {logs.map((log) => (
              <div key={log.id} className="p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-full bg-violet-50 px-2.5 py-1 text-xs font-semibold text-violet-700">{log.action}</span>
                      <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600">{log.entityType}</span>
                    </div>
                    <p className="mt-2 break-all text-sm text-slate-700">Entity ID: {log.entityId}</p>
                    <p className="mt-1 text-xs text-slate-500">By {log.admin.name} · {formatDate(log.createdAt)}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setExpanded(expanded === log.id ? null : log.id)}
                    className="inline-flex shrink-0 items-center gap-1 self-start rounded-lg border border-slate-200 px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
                  >
                    {expanded === log.id ? 'Hide details' : 'View details'}
                    {expanded === log.id ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                  </button>
                </div>
                {expanded === log.id && (
                  <pre className="mt-3 overflow-x-auto rounded-xl bg-slate-950 p-4 text-xs leading-5 text-slate-100">
                    {JSON.stringify(log.details, null, 2) ?? 'No additional details'}
                  </pre>
                )}
              </div>
            ))}
          </div>
        )}

        {meta && meta.totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-slate-100 px-4 py-3">
            <p className="text-xs text-slate-500">Page {meta.page} of {meta.totalPages}</p>
            <div className="flex gap-2">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => setPage((value) => value - 1)}
                className="rounded-lg border border-slate-200 px-3 py-2 text-sm disabled:opacity-40"
              >Previous</button>
              <button
                type="button"
                disabled={page >= meta.totalPages}
                onClick={() => setPage((value) => value + 1)}
                className="rounded-lg border border-slate-200 px-3 py-2 text-sm disabled:opacity-40"
              >Next</button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}