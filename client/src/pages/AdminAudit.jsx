import { useState, useEffect, useMemo, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { Shield, Search, ChevronDown, ChevronRight, Plus, Pencil, Ban, Lock, Unlock, User } from 'lucide-react'
import AdminLayout from '../components/AdminLayout'
import { adminFetch, getToken, formatCurrency, formatDate } from '../hooks/useAdmin'

const ACTION_STYLES = {
  create: 'bg-green-50 text-green-700',
  update: 'bg-blue-50 text-blue-700',
  void: 'bg-red-50 text-red-700',
  close: 'bg-purple-50 text-purple-700',
  reopen: 'bg-yellow-50 text-yellow-700',
}

const ACTION_ICONS = { create: Plus, update: Pencil, void: Ban, close: Lock, reopen: Unlock }

export default function AdminAudit() {
  const [logs, setLogs] = useState([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [filterAction, setFilterAction] = useState('')
  const [filterType, setFilterType] = useState('')
  const [expandedId, setExpandedId] = useState(null)
  const navigate = useNavigate()

  const fetchData = useCallback(async () => {
    if (!getToken()) { navigate('/admin'); return }
    const params = new URLSearchParams({ limit: '200' })
    if (filterAction) params.set('action', filterAction)
    if (filterType) params.set('recordType', filterType)
    const res = await adminFetch(`/api/accounting/audit-logs?${params}`)
    if (res) { setLogs(res.logs || []); setTotal(res.total || 0) }
    setLoading(false)
  }, [navigate, filterAction, filterType])

  useEffect(() => { fetchData() }, [fetchData])

  const filtered = useMemo(() => {
    if (!searchTerm) return logs
    const lower = searchTerm.toLowerCase()
    return logs.filter(l => (l.description || '').toLowerCase().includes(lower) || (l.recordType || '').toLowerCase().includes(lower))
  }, [logs, searchTerm])

  return (
    <AdminLayout>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="font-display font-bold text-xl text-charcoal-900 flex items-center gap-2"><Shield size={22} className="text-forest-700" />Audit Trail</h2>
          <p className="text-sm text-gray-500 mt-1">Complete record of every financial action</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={14} />
          <input value={searchTerm} onChange={e => setSearchTerm(e.target.value)} placeholder="Search..." className="pl-9 pr-3 py-1.5 rounded-lg border border-gray-200 text-xs w-48" />
        </div>
        <select value={filterAction} onChange={e => setFilterAction(e.target.value)} className="px-3 py-1.5 rounded-lg border border-gray-200 text-xs bg-white">
          <option value="">All Actions</option>
          <option value="create">Create</option><option value="void">Void</option><option value="close">Close</option><option value="reopen">Reopen</option>
        </select>
        <select value={filterType} onChange={e => setFilterType(e.target.value)} className="px-3 py-1.5 rounded-lg border border-gray-200 text-xs bg-white">
          <option value="">All Record Types</option>
          <option value="journal_entry">Journal Entry</option><option value="expense">Expense</option><option value="fiscal_period">Fiscal Period</option>
        </select>
      </div>

      {/* Logs Table */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-x-auto">
        {loading ? <div className="text-center py-20 text-gray-400">Loading...</div> : filtered.length === 0 ? (
          <div className="text-center py-16"><Shield size={40} className="text-gray-200 mx-auto mb-3" /><p className="text-gray-400 text-sm">No audit log entries found</p></div>
        ) : (
          <table className="w-full text-sm">
            <thead><tr className="bg-gray-50 text-left text-xs text-gray-500"><th className="px-4 py-2 w-8" /><th className="px-4 py-2">Date/Time</th><th className="px-4 py-2">Action</th><th className="px-4 py-2">Record Type</th><th className="px-4 py-2">Description</th><th className="px-4 py-2 text-right">Amount</th><th className="px-4 py-2">User</th></tr></thead>
            <tbody>
              {filtered.map(log => {
                const expanded = expandedId === log.id
                const Icon = ACTION_ICONS[log.action] || Shield
                return (
                  <>
                    <tr key={log.id} className="border-b border-gray-50 cursor-pointer hover:bg-gray-50" onClick={() => setExpandedId(expanded ? null : log.id)}>
                      <td className="px-4 py-2.5">{expanded ? <ChevronDown size={14} className="text-gray-400" /> : <ChevronRight size={14} className="text-gray-400" />}</td>
                      <td className="px-4 py-2.5 tabular-nums whitespace-nowrap text-xs">{new Date(log.performedAt).toLocaleString()}</td>
                      <td className="px-4 py-2.5"><span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium ${ACTION_STYLES[log.action] || 'bg-gray-50 text-gray-600'}`}><Icon size={10} />{log.action}</span></td>
                      <td className="px-4 py-2.5 text-xs">{(log.recordType || '').replace(/_/g, ' ')}</td>
                      <td className="px-4 py-2.5 truncate max-w-[300px]">{log.description || '—'}</td>
                      <td className="px-4 py-2.5 text-right tabular-nums">{log.amount ? formatCurrency(Number(log.amount)) : '—'}</td>
                      <td className="px-4 py-2.5 text-xs flex items-center gap-1"><User size={10} />{log.performedBy || 'system'}</td>
                    </tr>
                    {expanded && log.recordId && (
                      <tr key={`${log.id}-detail`}><td colSpan={7} className="bg-gray-50 px-8 py-3 text-xs text-gray-500">Record ID: {log.recordId}</td></tr>
                    )}
                  </>
                )
              })}
            </tbody>
          </table>
        )}
        <div className="px-4 py-2 text-xs text-gray-400 border-t border-gray-100">{filtered.length} of {total} records</div>
      </div>
    </AdminLayout>
  )
}
