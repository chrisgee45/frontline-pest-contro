import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { Phone, Mail, MapPin, Clock, ChevronDown, ChevronUp, Trash2, ArrowRight, Calendar } from 'lucide-react'
import AdminLayout from '../components/AdminLayout'
import { adminFetch, getToken, timeAgo, formatDate } from '../hooks/useAdmin'

const STATUS_OPTIONS = [
  { value: 'new', label: 'New', color: 'bg-blue-100 text-blue-800' },
  { value: 'contacted', label: 'Contacted', color: 'bg-amber-100 text-amber-800' },
  { value: 'converted', label: 'Converted', color: 'bg-green-100 text-green-800' },
  { value: 'closed', label: 'Closed', color: 'bg-gray-100 text-gray-600' },
]

function LeadCard({ lead, onUpdate, onDelete, onConvert }) {
  const [expanded, setExpanded] = useState(false)
  const [notes, setNotes] = useState(lead.notes || '')
  const [saving, setSaving] = useState(false)
  const statusObj = STATUS_OPTIONS.find(s => s.value === lead.status) || STATUS_OPTIONS[0]

  const updateStatus = async (status) => {
    setSaving(true)
    await adminFetch(`/api/admin/leads/${lead.id}`, { method: 'PATCH', body: JSON.stringify({ status }) })
    onUpdate(); setSaving(false)
  }

  const saveNotes = async () => {
    setSaving(true)
    await adminFetch(`/api/admin/leads/${lead.id}`, { method: 'PATCH', body: JSON.stringify({ notes }) })
    onUpdate(); setSaving(false)
  }

  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
      <div className="flex items-center justify-between p-4 cursor-pointer hover:bg-gray-50" onClick={() => setExpanded(!expanded)}>
        <div className="flex items-center gap-3 min-w-0">
          <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${statusObj.color}`}>{statusObj.label}</span>
          <div className="min-w-0">
            <div className="font-semibold text-charcoal-900 truncate">{lead.name}</div>
            <div className="text-sm text-gray-500 flex items-center gap-3"><Phone size={12} />{lead.phone} {lead.service && <span className="text-forest-700 font-medium">{lead.service}</span>}</div>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-xs text-gray-400 hidden sm:block">{timeAgo(lead.createdAt)}</span>
          {expanded ? <ChevronUp size={18} className="text-gray-400" /> : <ChevronDown size={18} className="text-gray-400" />}
        </div>
      </div>
      {expanded && (
        <div className="border-t border-gray-100 p-4 bg-gray-50 space-y-4">
          <div className="grid sm:grid-cols-2 gap-3 text-sm">
            <div className="flex items-center gap-2"><Phone size={14} className="text-gray-400" /><a href={`tel:${lead.phone}`} className="text-forest-700 font-medium hover:underline">{lead.phone}</a></div>
            {lead.email && <div className="flex items-center gap-2"><Mail size={14} className="text-gray-400" />{lead.email}</div>}
            {lead.address && <div className="flex items-center gap-2"><MapPin size={14} className="text-gray-400" />{lead.address}</div>}
            <div className="flex items-center gap-2"><Clock size={14} className="text-gray-400" />{formatDate(lead.createdAt)}</div>
            {lead.urgency && <div className="flex items-center gap-2"><Calendar size={14} className="text-gray-400" />Urgency: <span className="font-medium">{lead.urgency}</span></div>}
          </div>
          {lead.message && <div className="bg-white rounded-lg p-3 border border-gray-200"><div className="text-xs font-medium text-gray-500 mb-1">Message</div><p className="text-sm text-charcoal-800">{lead.message}</p></div>}
          <div>
            <div className="text-xs font-medium text-gray-500 mb-2">Status</div>
            <div className="flex flex-wrap gap-2">
              {STATUS_OPTIONS.map(s => (
                <button key={s.value} onClick={() => updateStatus(s.value)} disabled={saving || lead.status === s.value}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${lead.status === s.value ? `${s.color} ring-2 ring-offset-1 ring-gray-300` : 'bg-gray-100 text-gray-600 hover:bg-gray-200'} disabled:opacity-50`}>{s.label}</button>
              ))}
            </div>
          </div>
          <div>
            <div className="text-xs font-medium text-gray-500 mb-2">Notes</div>
            <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} placeholder="Internal notes..." className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:border-forest-500 outline-none resize-none" />
            <button onClick={saveNotes} disabled={saving} className="mt-2 px-4 py-1.5 bg-forest-700 hover:bg-forest-800 text-white text-xs font-medium rounded-lg disabled:opacity-50">Save Notes</button>
          </div>
          <div className="pt-2 border-t border-gray-200 flex justify-between">
            {lead.status !== 'converted' && (
              <button onClick={() => onConvert(lead.id)} className="flex items-center gap-1.5 text-xs text-forest-700 hover:text-forest-900 font-medium"><ArrowRight size={14} />Convert to Job</button>
            )}
            <button onClick={() => { if (confirm('Delete this lead?')) onDelete(lead.id) }} className="flex items-center gap-1.5 text-xs text-red-600 hover:text-red-800 font-medium"><Trash2 size={14} />Delete</button>
          </div>
        </div>
      )}
    </div>
  )
}

export default function AdminLeads() {
  const [leads, setLeads] = useState([])
  const [filter, setFilter] = useState('all')
  const [loading, setLoading] = useState(true)
  const navigate = useNavigate()

  const fetchLeads = useCallback(async () => {
    if (!getToken()) { navigate('/admin'); return }
    const data = await adminFetch('/api/admin/leads')
    if (data) setLeads(data.leads || [])
    setLoading(false)
  }, [navigate])

  useEffect(() => { fetchLeads() }, [fetchLeads])

  const handleDelete = async (id) => { await adminFetch(`/api/admin/leads/${id}`, { method: 'DELETE' }); fetchLeads() }
  const handleConvert = async (id) => { await adminFetch(`/api/admin/leads/${id}/convert`, { method: 'POST', body: JSON.stringify({}) }); fetchLeads() }
  const filtered = filter === 'all' ? leads : leads.filter(l => l.status === filter)

  return (
    <AdminLayout>
      <div className="flex items-center gap-2 mb-6 flex-wrap">
        {[{ value: 'all', label: 'All' }, ...STATUS_OPTIONS].map(f => (
          <button key={f.value} onClick={() => setFilter(f.value)} className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${filter === f.value ? 'bg-forest-700 text-white' : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-100'}`}>
            {f.label} {f.value !== 'all' && <span className="ml-1 opacity-70">({leads.filter(l => l.status === f.value).length})</span>}
          </button>
        ))}
      </div>
      {loading ? <div className="text-center py-20 text-gray-500">Loading...</div> : (
        <div className="space-y-3">
          {filtered.length === 0 ? (
            <div className="text-center py-16 bg-white rounded-xl border border-gray-100"><p className="text-gray-500">No leads {filter !== 'all' ? `with status "${filter}"` : 'yet'}</p></div>
          ) : filtered.map(lead => (
            <LeadCard key={lead.id} lead={lead} onUpdate={fetchLeads} onDelete={handleDelete} onConvert={handleConvert} />
          ))}
        </div>
      )}
    </AdminLayout>
  )
}
