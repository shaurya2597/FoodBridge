import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { RefreshCw, Search, Users } from 'lucide-react'
import { userMessage } from '@/services/apiError'
import {
  getAdminUsers,
  setAdminUserBlocked,
  type AdminUser,
  type AdminUserFilters,
} from '@/services/admin'

const date = (value: string) =>
  new Date(value).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })

export function AdminUsersPage() {
  const queryClient = useQueryClient()
  const [search, setSearch] = useState('')
  const [role, setRole] = useState('')
  const [blocked, setBlocked] = useState('all')
  const [page, setPage] = useState(1)

  const filters: AdminUserFilters = {
    q: search.trim() || undefined,
    role: role ? role as AdminUser['role'] : undefined,
    blocked: blocked === 'all' ? undefined : blocked === 'blocked',
    page,
    limit: 10,
  }

  const usersQuery = useQuery({
    queryKey: ['admin', 'users', filters],
    queryFn: ({ signal }) => getAdminUsers(filters, signal),
    placeholderData: (previous) => previous,
  })

  const blockMutation = useMutation({
    mutationFn: (input: { id: string; blocked: boolean; reason?: string }) =>
      setAdminUserBlocked(input.id, input.blocked, input.reason),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['admin', 'users'] }),
        queryClient.invalidateQueries({ queryKey: ['admin', 'dashboard'] }),
      ])
    },
  })

  const handleBlock = (user: AdminUser) => {
    const reason = window.prompt(`Enter a reason for blocking ${user.name}:`)
    if (reason === null) return
    if (reason.trim().length < 3) {
      window.alert('Please enter a reason with at least 3 characters.')
      return
    }
    blockMutation.mutate({ id: user.id, blocked: true, reason: reason.trim() })
  }

  const handleUnblock = (user: AdminUser) => {
    if (window.confirm(`Unblock ${user.name}?`)) {
      blockMutation.mutate({ id: user.id, blocked: false })
    }
  }

  const users = usersQuery.data?.data ?? []
  const meta = usersQuery.data?.meta

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[.16em] text-emerald-700">Platform management</p>
          <h1 className="mt-2 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">User management</h1>
          <p className="mt-1 text-sm text-slate-500">Search accounts and manage platform access.</p>
        </div>
        <button
          type="button"
          onClick={() => void usersQuery.refetch()}
          className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
        >
          <RefreshCw size={15} /> Refresh
        </button>
      </header>

      <section className="grid gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:grid-cols-3">
        <label className="relative block sm:col-span-1">
          <span className="sr-only">Search users</span>
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            value={search}
            onChange={(event) => { setSearch(event.target.value); setPage(1) }}
            placeholder="Search name or email"
            className="h-11 w-full rounded-xl border border-slate-200 pl-9 pr-3 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
          />
        </label>
        <label>
          <span className="sr-only">Filter by role</span>
          <select
            value={role}
            onChange={(event) => { setRole(event.target.value); setPage(1) }}
            className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-emerald-500"
          >
            <option value="">All roles</option>
            <option value="CUSTOMER">Customer</option>
            <option value="RESTAURANT_OWNER">Restaurant owner</option>
            <option value="NGO">NGO</option>
            <option value="ADMIN">Admin</option>
          </select>
        </label>
        <label>
          <span className="sr-only">Filter by account status</span>
          <select
            value={blocked}
            onChange={(event) => { setBlocked(event.target.value); setPage(1) }}
            className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-emerald-500"
          >
            <option value="all">All account statuses</option>
            <option value="active">Active accounts</option>
            <option value="blocked">Blocked accounts</option>
          </select>
        </label>
      </section>

      {blockMutation.isError && (
        <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {userMessage(blockMutation.error)}
        </div>
      )}

      {usersQuery.isPending ? (
        <p className="py-12 text-center text-sm text-slate-500">Loading users...</p>
      ) : usersQuery.isError ? (
        <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-5 text-sm text-red-700">
          <p className="font-semibold">Could not load users.</p>
          <p className="mt-1">{userMessage(usersQuery.error)}</p>
          <button type="button" onClick={() => void usersQuery.refetch()} className="mt-3 rounded-lg bg-red-100 px-3 py-2 font-semibold">
            Try again
          </button>
        </div>
      ) : users.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-12 text-center">
          <Users className="mx-auto text-slate-400" size={28} />
          <p className="mt-3 font-semibold text-slate-800">No users found</p>
          <p className="mt-1 text-sm text-slate-500">Try changing your search or filters.</p>
        </div>
      ) : (
        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-5 py-4">
            <h2 className="font-semibold text-slate-900">Platform users</h2>
            <span className="text-xs text-slate-500">{meta?.total ?? users.length} accounts</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-5 py-3 font-semibold">User</th>
                  <th className="px-5 py-3 font-semibold">Role</th>
                  <th className="px-5 py-3 font-semibold">Joined</th>
                  <th className="px-5 py-3 font-semibold">Status</th>
                  <th className="px-5 py-3 text-right font-semibold">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {users.map((user) => (
                  <tr key={user.id} className="hover:bg-slate-50/70">
                    <td className="px-5 py-4">
                      <p className="font-semibold text-slate-900">{user.name}</p>
                      <p className="mt-0.5 text-xs text-slate-500">{user.email}</p>
                      {user.ngoProfile && (
                        <p className="mt-1 text-xs text-slate-500">
                          {user.ngoProfile.orgName} · {user.ngoProfile.isVerified ? 'Verified NGO' : 'Unverified NGO'}
                        </p>
                      )}
                      {user.blockedReason && (
                        <p className="mt-1 max-w-xs text-xs text-red-600">Reason: {user.blockedReason}</p>
                      )}
                    </td>
                    <td className="px-5 py-4 text-slate-600">{user.role.replaceAll('_', ' ')}</td>
                    <td className="px-5 py-4 text-slate-600">{date(user.createdAt)}</td>
                    <td className="px-5 py-4">
                      <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                        user.isBlocked ? 'bg-red-50 text-red-700' : 'bg-emerald-50 text-emerald-700'
                      }`}>
                        {user.isBlocked ? 'Blocked' : 'Active'}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-right">
                      <button
                        type="button"
                        disabled={blockMutation.isPending}
                        onClick={() => user.isBlocked ? handleUnblock(user) : handleBlock(user)}
                        className={`rounded-lg px-3 py-2 text-xs font-semibold disabled:cursor-not-allowed disabled:opacity-50 ${
                          user.isBlocked
                            ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                            : 'bg-red-50 text-red-700 hover:bg-red-100'
                        }`}
                      >
                        {user.isBlocked ? 'Unblock' : 'Block'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex items-center justify-between gap-3 border-t border-slate-100 px-5 py-4">
            <p className="text-xs text-slate-500">
              Page {meta?.page ?? page} of {Math.max(1, meta?.totalPages ?? 1)}
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                disabled={page <= 1 || usersQuery.isFetching}
                onClick={() => setPage((current) => Math.max(1, current - 1))}
                className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold disabled:opacity-40"
              >
                Previous
              </button>
              <button
                type="button"
                disabled={!meta || page >= meta.totalPages || usersQuery.isFetching}
                onClick={() => setPage((current) => current + 1)}
                className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold disabled:opacity-40"
              >
                Next
              </button>
            </div>
          </div>
        </section>
      )}
    </div>
  )
}