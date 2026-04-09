import { useState, useEffect, useCallback, Fragment } from 'react'
import { useNavigate } from 'react-router-dom'
import { Shield, Search, ChevronDown, ChevronRight, Plus, Pencil, Ban, Lock, Unlock, User, ArrowRightLeft, LogIn, LogOut, AlertTriangle, Trash2 } from 'lucide-react'
import AdminLayout from '../components/AdminLayout'
import { adminFetch, getToken, formatCurrency } from '../hooks/useAdmin'

// Friendly colors and icons for every action the audit log can emit.
// These stay in sync with server/repo.js + server/index.js.
const ACTION_STYLES = {
  create: 'bg-green-50 text-green-700 border-green-200',
  update: 'bg-blue-50 text-blue-700 border-blue-200',
  status_change: 'bg-indigo-50 text-indigo-700 border-indigo-200',
  delete: 'bg-red-50 text-red-700 border-red-200',
  void: 'bg-red-50 text-red-700 border-red-200',
  login: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  logout: 'bg-gray-50 text-gray-600 border-gray-200',
  login_failed: 'bg-amber-50 text-amber-700 border-amber-200',
  close: 'bg-purple-50 text-purple-700 border-purple-200',
  reopen: 'bg-yellow-50 text-yellow-700 border-yellow-200',
}

const ACTION_ICONS = {
  create: Plus,
  update: Pencil,
  status_change: ArrowRightLeft,
  delete: Trash2,
  void: Ban,
  login: LogIn,
  logout: LogOut,
  login_failed: AlertTriangle,
  close: Lock,
  reopen: Unlock,
}

function humanizeKey(k) {
  return k.replace(/([A-Z])/g, ' $1').replace(/_/g, ' ').replace(/^./, s => s.toUpperCase()).trim()
}

function renderValue(v) {
  if (v === null || v === undefined || v === '') return <span className="text-gray-400 italic">empty</span>
  if (typeof v === 'boolean') return <span>{v ? 'true' : 'false'}</span>
  if (typeof v === 'object') return <code className="text-[10px]">{JSON.stringify(v)}</code>
  return <span>{String(v)}</span>
}

// Render a diff object { field: { before, after } } as a compact list.
function DiffView({ diff }) {
  if (!diff || Object.keys(diff).length === 0) {
    return <p className="text-[11px] text-gray-400 italic">No field changes</p>
  }
  return (
    <div className="space-y-1">
      {Object.entries(diff).map(([field, change]) => (
        <div key={field} className="flex items-start gap-2 text-[11px]">
          <span className="font-mono text-gray-500 min-w-[100px]">{humanizeKey(field)}</span>
          <span className="text-red-600 line-through">{renderValue(change.before)}</span>
          <span className="text-gray-400">→</span>
          <span className="text-green-600 font-medium">{renderValue(change.after)}</span>
        </div>
      ))}
    </div>
  )
}

export default function AdminAudit() {
  const [logs, setLogs] = useState([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [filterAction, setFilterAction] = useState('')
  const [filterType, setFilterType] = useState('')
  const [filterActor, setFilterActor] = useState('')
  const [expandedId, setExpandedId] = useState(null)
  const [actionOptions, setActionOptions] = useState([])
  const [typeOptions, setTypeOptions] = useState([])
  const [actorOptions, setActorOptions] = useState([])
  const navigate = useNavigate()

  // Debounce the search input so we don't hammer the server on every keystroke
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(searchTerm.trim()), 300)
    return () => clearTimeout(t)
  }, [searchTerm])

  const fetchData = useCallback(async () => {
    if (!getToken()) { navigate('/admin'); return }
    setLoading(true)
    const params = new URLSearchParams({ limit: '200' })
    if (filterAction) params.set('action', filterAction)
    if (filterType) params.set('recordType', filterType)
    if (filterActor) params.set('actor', filterActor)
    if (debouncedSearch) params.set('q', debouncedSearch)
    const res = await adminFetch(`/api/admin/audit-log?${params}`)
    if (res) { setLogs(res.logs || []); setTotal(res.total || 0) }
    setLoading(false)
  }, [navigate, filterAction, filterType, filterActor, debouncedSearch])

  // Load dropdown options once on mount — populated dynamically from the
  // audit log's distinct values, so new action/record types appear in the
  // filters automatically without code changes.
  const fetchDropdowns = useCallback(async () => {
    if (!getToken()) return
    const [actions, types, actors] = await Promise.all([
      adminFetch('/api/admin/audit-log/distinct?field=action'),
      adminFetch('/api/admin/audit-log/distinct?field=recordType'),
      adminFetch('/api/admin/audit-log/distinct?field=performedBy'),
    ])
    if (actions) setActionOptions(actions.values || [])
    if (types) setTypeOptions(types.values || [])
    if (actors) setActorOptions(actors.values || [])
  }, [])

  useEffect(() => { fetchData() }, [fetchData])
  useEffect(() => { fetchDropdowns() }, [fetchDropdowns])

  // Refresh dropdowns after the first data load so they include brand-new
  // values the user might have just generated.
  useEffect(() => { if (!loading) fetchDropdowns() }, [loading, fetchDropdowns])

  return (
    <AdminLayout>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="font-display font-bold text-xl text-charcoal-900 flex items-center gap-2"><Shield size={22} className="text-forest-700" />Audit Trail</h2>
          <p className="text-sm text-gray-500 mt-1">Every create, update, status change, delete, and login is recorded here</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={14} />
          <input value={searchTerm} onChange={e => setSearchTerm(e.target.value)} placeholder="Search description, record ID, customer…" className="pl-9 pr-3 py-1.5 rounded-lg border border-gray-200 text-xs w-64" />
        </div>
        <select value={filterAction} onChange={e => setFilterAction(e.target.value)} className="px-3 py-1.5 rounded-lg border border-gray-200 text-xs bg-white">
          <option value="">All Actions</option>
          {actionOptions.map(a => <option key={a} value={a}>{humanizeKey(a)}</option>)}
        </select>
        <select value={filterType} onChange={e => setFilterType(e.target.value)} className="px-3 py-1.5 rounded-lg border border-gray-200 text-xs bg-white">
          <option value="">All Record Types</option>
          {typeOptions.map(t => <option key={t} value={t}>{humanizeKey(t)}</option>)}
        </select>
        <select value={filterActor} onChange={e => setFilterActor(e.target.value)} className="px-3 py-1.5 rounded-lg border border-gray-200 text-xs bg-white">
          <option value="">All Users</option>
          {actorOptions.map(a => <option key={a} value={a}>{a}</option>)}
        </select>
        {(searchTerm || filterAction || filterType || filterActor) && (
          <button
            onClick={() => { setSearchTerm(''); setFilterAction(''); setFilterType(''); setFilterActor('') }}
            className="px-3 py-1.5 rounded-lg border border-gray-200 text-xs bg-white text-gray-500 hover:bg-gray-50"
          >
            Clear filters
          </button>
        )}
      </div>

      {/* Logs Table */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-x-auto">
        {loading ? <div className="text-center py-20 text-gray-400">Loading...</div> : logs.length === 0 ? (
          <div className="text-center py-16"><Shield size={40} className="text-gray-200 mx-auto mb-3" /><p className="text-gray-400 text-sm">No audit log entries match your filters</p></div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 text-left text-xs text-gray-500">
                <th className="px-4 py-2 w-8" />
                <th className="px-4 py-2">Date/Time</th>
                <th className="px-4 py-2">Action</th>
                <th className="px-4 py-2">Record Type</th>
                <th className="px-4 py-2">Description</th>
                <th className="px-4 py-2 text-right">Amount</th>
                <th className="px-4 py-2">User</th>
              </tr>
            </thead>
            <tbody>
              {logs.map(log => {
                const expanded = expandedId === log.id
                const Icon = ACTION_ICONS[log.action] || Shield
                return (
                  <Fragment key={log.id}>
                    <tr className="border-b border-gray-50 cursor-pointer hover:bg-gray-50" onClick={() => setExpandedId(expanded ? null : log.id)}>
                      <td className="px-4 py-2.5">{expanded ? <ChevronDown size={14} className="text-gray-400" /> : <ChevronRight size={14} className="text-gray-400" />}</td>
                      <td className="px-4 py-2.5 tabular-nums whitespace-nowrap text-xs">{new Date(log.performedAt).toLocaleString()}</td>
                      <td className="px-4 py-2.5">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded border text-[10px] font-medium ${ACTION_STYLES[log.action] || 'bg-gray-50 text-gray-600 border-gray-200'}`}>
                          <Icon size={10} />{humanizeKey(log.action)}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-xs">{humanizeKey(log.recordType || '')}</td>
                      <td className="px-4 py-2.5 truncate max-w-[320px]">{log.description || '—'}</td>
                      <td className="px-4 py-2.5 text-right tabular-nums">{log.amount ? formatCurrency(Number(log.amount)) : '—'}</td>
                      <td className="px-4 py-2.5 text-xs flex items-center gap-1"><User size={10} />{log.performedBy || 'system'}</td>
                    </tr>
                    {expanded && (
                      <tr>
                        <td colSpan={7} className="bg-gray-50 px-8 py-3">
                          <div className="space-y-2 text-xs text-gray-600">
                            {log.recordId && (
                              <div className="flex items-center gap-2">
                                <span className="text-gray-400 min-w-[100px]">Record ID</span>
                                <code className="font-mono text-gray-700">{log.recordId}</code>
                              </div>
                            )}
                            {log.diff && Object.keys(log.diff).length > 0 && (
                              <div>
                                <p className="text-gray-400 text-[11px] uppercase tracking-wider mb-1">Field Changes</p>
                                <DiffView diff={log.diff} />
                              </div>
                            )}
                            {log.action === 'create' && log.after && (
                              <div>
                                <p className="text-gray-400 text-[11px] uppercase tracking-wider mb-1">Created Record</p>
                                <pre className="bg-white border border-gray-100 rounded px-2 py-1 text-[10px] overflow-x-auto max-h-48">{JSON.stringify(log.after, null, 2)}</pre>
                              </div>
                            )}
                            {log.action === 'delete' && log.before && (
                              <div>
                                <p className="text-gray-400 text-[11px] uppercase tracking-wider mb-1">Deleted Record (preserved)</p>
                                <pre className="bg-white border border-gray-100 rounded px-2 py-1 text-[10px] overflow-x-auto max-h-48">{JSON.stringify(log.before, null, 2)}</pre>
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                )
              })}
            </tbody>
          </table>
        )}
        <div className="px-4 py-2 text-xs text-gray-400 border-t border-gray-100">{logs.length} of {total} records</div>
      </div>
    </AdminLayout>
  )
}
