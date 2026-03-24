import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, X, MapPin, Phone, Calendar, User, Wrench, GripVertical, Trash2, FileText } from 'lucide-react'
import AdminLayout from '../components/AdminLayout'
import { adminFetch, getToken, formatDate } from '../hooks/useAdmin'

const COLUMNS = [
  { key: 'new', label: 'New', color: 'border-blue-400', bg: 'bg-blue-50', badge: 'bg-blue-100 text-blue-800' },
  { key: 'scheduled', label: 'Scheduled', color: 'border-amber-400', bg: 'bg-amber-50', badge: 'bg-amber-100 text-amber-800' },
  { key: 'in_progress', label: 'In Progress', color: 'border-purple-400', bg: 'bg-purple-50', badge: 'bg-purple-100 text-purple-800' },
  { key: 'completed', label: 'Completed', color: 'border-green-400', bg: 'bg-green-50', badge: 'bg-green-100 text-green-800' },
]

const SERVICE_TYPES = ['Termite Treatment', 'General Pest Control', 'Rodent Control', 'Inspection', 'Other']

function JobCard({ job, onStatusChange, onDelete, onCreateInvoice }) {
  const [expanded, setExpanded] = useState(false)

  return (
    <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-3 cursor-pointer hover:shadow-md transition-shadow" onClick={() => setExpanded(!expanded)}>
      <div className="flex items-start justify-between mb-2">
        <span className="text-xs font-semibold text-forest-700 bg-forest-50 px-2 py-0.5 rounded">{job.serviceType}</span>
      </div>
      <h4 className="font-semibold text-sm text-charcoal-900 mb-1">{job.customerName}</h4>
      {job.address && <p className="text-xs text-gray-500 flex items-center gap-1 mb-1"><MapPin size={11} />{job.address}</p>}
      {job.scheduledDate && <p className="text-xs text-gray-500 flex items-center gap-1 mb-1"><Calendar size={11} />{formatDate(job.scheduledDate)}</p>}
      <p className="text-xs text-gray-400 flex items-center gap-1"><User size={11} />{job.assignedTech}</p>

      {expanded && (
        <div className="mt-3 pt-3 border-t border-gray-100 space-y-2" onClick={e => e.stopPropagation()}>
          {job.phone && <p className="text-xs flex items-center gap-1"><Phone size={11} className="text-gray-400" /><a href={`tel:${job.phone}`} className="text-forest-700 hover:underline">{job.phone}</a></p>}
          {job.notes && <p className="text-xs text-gray-600 bg-gray-50 rounded p-2">{job.notes}</p>}
          <div className="flex flex-wrap gap-1 pt-1">
            {COLUMNS.filter(c => c.key !== job.status).map(c => (
              <button key={c.key} onClick={() => onStatusChange(job.id, c.key)} className={`px-2 py-1 rounded text-[10px] font-medium ${c.badge} hover:opacity-80`}>→ {c.label}</button>
            ))}
          </div>
          <div className="flex gap-2 pt-1">
            {job.status === 'completed' && (
              <button onClick={() => onCreateInvoice(job)} className="flex items-center gap-1 text-[10px] text-forest-700 font-medium hover:underline"><FileText size={11} />Create Invoice</button>
            )}
            <button onClick={() => { if (confirm('Delete this job?')) onDelete(job.id) }} className="flex items-center gap-1 text-[10px] text-red-600 font-medium hover:underline"><Trash2 size={11} />Delete</button>
          </div>
        </div>
      )}
    </div>
  )
}

function NewJobModal({ onClose, onSave }) {
  const [form, setForm] = useState({ customerName: '', address: '', phone: '', email: '', serviceType: 'General Pest Control', scheduledDate: '', assignedTech: 'Jimmy Manharth', notes: '' })
  const [saving, setSaving] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault(); setSaving(true)
    await onSave(form); setSaving(false); onClose()
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-5 border-b"><h3 className="font-display font-bold text-lg">New Job</h3><button onClick={onClose}><X size={20} /></button></div>
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div><label className="block text-xs font-medium text-gray-700 mb-1">Customer Name *</label><input required value={form.customerName} onChange={e => setForm({...form, customerName: e.target.value})} className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:border-forest-500 outline-none" /></div>
            <div><label className="block text-xs font-medium text-gray-700 mb-1">Phone</label><input value={form.phone} onChange={e => setForm({...form, phone: e.target.value})} className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:border-forest-500 outline-none" /></div>
          </div>
          <div><label className="block text-xs font-medium text-gray-700 mb-1">Address</label><input value={form.address} onChange={e => setForm({...form, address: e.target.value})} className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:border-forest-500 outline-none" /></div>
          <div className="grid grid-cols-2 gap-4">
            <div><label className="block text-xs font-medium text-gray-700 mb-1">Service Type *</label>
              <select value={form.serviceType} onChange={e => setForm({...form, serviceType: e.target.value})} className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm bg-white focus:border-forest-500 outline-none">
                {SERVICE_TYPES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div><label className="block text-xs font-medium text-gray-700 mb-1">Scheduled Date</label><input type="date" value={form.scheduledDate} onChange={e => setForm({...form, scheduledDate: e.target.value})} className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:border-forest-500 outline-none" /></div>
          </div>
          <div><label className="block text-xs font-medium text-gray-700 mb-1">Assigned Technician</label><input value={form.assignedTech} onChange={e => setForm({...form, assignedTech: e.target.value})} className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:border-forest-500 outline-none" /></div>
          <div><label className="block text-xs font-medium text-gray-700 mb-1">Notes</label><textarea value={form.notes} onChange={e => setForm({...form, notes: e.target.value})} rows={2} className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:border-forest-500 outline-none resize-none" /></div>
          <button type="submit" disabled={saving} className="w-full btn-primary py-2.5 disabled:opacity-50">{saving ? 'Creating...' : 'Create Job'}</button>
        </form>
      </div>
    </div>
  )
}

export default function AdminJobs() {
  const [jobs, setJobs] = useState([])
  const [showNew, setShowNew] = useState(false)
  const [loading, setLoading] = useState(true)
  const navigate = useNavigate()

  const fetchJobs = useCallback(async () => {
    if (!getToken()) { navigate('/admin'); return }
    const data = await adminFetch('/api/admin/jobs')
    if (data) setJobs(data.jobs || [])
    setLoading(false)
  }, [navigate])

  useEffect(() => { fetchJobs() }, [fetchJobs])

  const createJob = async (form) => { await adminFetch('/api/admin/jobs', { method: 'POST', body: JSON.stringify(form) }); fetchJobs() }
  const updateStatus = async (id, status) => { await adminFetch(`/api/admin/jobs/${id}`, { method: 'PATCH', body: JSON.stringify({ status }) }); fetchJobs() }
  const deleteJob = async (id) => { await adminFetch(`/api/admin/jobs/${id}`, { method: 'DELETE' }); fetchJobs() }
  const createInvoice = (job) => { navigate('/admin/invoices', { state: { fromJob: job } }) }

  if (loading) return <AdminLayout><div className="text-center py-20 text-gray-500">Loading...</div></AdminLayout>

  return (
    <AdminLayout>
      <div className="flex justify-between items-center mb-6">
        <p className="text-sm text-gray-500">{jobs.length} total jobs</p>
        <button onClick={() => setShowNew(true)} className="btn-primary text-sm py-2 px-4"><Plus size={16} />New Job</button>
      </div>

      {/* Kanban board */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        {COLUMNS.map(col => {
          const colJobs = jobs.filter(j => j.status === col.key)
          return (
            <div key={col.key} className={`rounded-xl border-t-4 ${col.color} bg-gray-50 min-h-[200px]`}>
              <div className="p-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <h3 className="font-display font-bold text-sm text-charcoal-900">{col.label}</h3>
                  <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${col.badge}`}>{colJobs.length}</span>
                </div>
              </div>
              <div className="px-3 pb-3 space-y-2">
                {colJobs.length === 0 ? (
                  <div className="text-center py-8 text-xs text-gray-400">No jobs</div>
                ) : colJobs.map(job => (
                  <JobCard key={job.id} job={job} onStatusChange={updateStatus} onDelete={deleteJob} onCreateInvoice={createInvoice} />
                ))}
              </div>
            </div>
          )
        })}
      </div>

      {showNew && <NewJobModal onClose={() => setShowNew(false)} onSave={createJob} />}
    </AdminLayout>
  )
}
