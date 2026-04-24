import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, X, Pencil, Trash2, Users, Phone, Mail, Crown, Eye, EyeOff } from 'lucide-react'
import AdminLayout from '../components/AdminLayout'
import { adminFetch, getToken, formatDate } from '../hooks/useAdmin'

const ROLES = [
  { value: 'owner',      label: 'Owner',      color: 'bg-amber-100 text-amber-800' },
  { value: 'technician', label: 'Technician', color: 'bg-forest-100 text-forest-800' },
  { value: 'contractor', label: 'Contractor', color: 'bg-purple-100 text-purple-800' },
  { value: 'helper',     label: 'Helper',     color: 'bg-blue-100 text-blue-800' },
]

function RoleBadge({ value }) {
  const r = ROLES.find(x => x.value === value) || ROLES[1]
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold ${r.color}`}>
      {value === 'owner' && <Crown size={10} />}
      {r.label}
    </span>
  )
}

function TechnicianModal({ technician, onClose, onSave }) {
  const [form, setForm] = useState({
    name: technician?.name || '',
    phone: technician?.phone || '',
    email: technician?.email || '',
    role: technician?.role || 'technician',
    active: technician ? technician.active !== false : true,
    hireDate: technician?.hireDate || '',
    hourlyRate: technician?.hourlyRate != null ? String(technician.hourlyRate) : '',
    notes: technician?.notes || '',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const isEdit = !!technician

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSaving(true); setError('')
    try {
      await onSave({
        ...form,
        hourlyRate: form.hourlyRate ? Number(form.hourlyRate) : null,
      })
      onClose()
    } catch (err) {
      setError(err.message || 'Something went wrong')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-5 border-b">
          <h3 className="font-display font-bold text-lg">{isEdit ? 'Edit Technician' : 'New Technician'}</h3>
          <button onClick={onClose}><X size={20} /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Name *</label>
            <input
              required
              value={form.name}
              onChange={e => setForm({ ...form, name: e.target.value })}
              placeholder="Full name"
              className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:border-forest-500 outline-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Phone</label>
              <input
                value={form.phone}
                onChange={e => setForm({ ...form, phone: e.target.value })}
                placeholder="405-555-1234"
                className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:border-forest-500 outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Email</label>
              <input
                type="email"
                value={form.email}
                onChange={e => setForm({ ...form, email: e.target.value })}
                placeholder="tech@frontlinepestok.com"
                className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:border-forest-500 outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Role *</label>
              <select
                value={form.role}
                onChange={e => setForm({ ...form, role: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm bg-white focus:border-forest-500 outline-none"
              >
                {ROLES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
              </select>
              <p className="text-[10px] text-gray-400 mt-0.5">
                Contractors count toward 1099 reporting.
              </p>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Hire Date</label>
              <input
                type="date"
                value={form.hireDate}
                onChange={e => setForm({ ...form, hireDate: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:border-forest-500 outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Hourly Rate (optional)</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
              <input
                type="number"
                step="0.01"
                min="0"
                value={form.hourlyRate}
                onChange={e => setForm({ ...form, hourlyRate: e.target.value })}
                placeholder="0.00"
                className="w-full pl-7 pr-3 py-2 rounded-lg border border-gray-200 text-sm focus:border-forest-500 outline-none"
              />
            </div>
            <p className="text-[10px] text-gray-400 mt-0.5">For record-keeping. Not used in any calculation yet.</p>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Notes</label>
            <textarea
              value={form.notes}
              onChange={e => setForm({ ...form, notes: e.target.value })}
              rows={2}
              placeholder="Certifications, notes, anything worth remembering..."
              className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:border-forest-500 outline-none resize-none"
            />
          </div>

          <div className="flex items-center gap-2 pt-1">
            <input
              id="tech-active"
              type="checkbox"
              checked={form.active}
              onChange={e => setForm({ ...form, active: e.target.checked })}
              className="h-4 w-4 rounded border-gray-300 text-forest-600 focus:ring-forest-500"
            />
            <label htmlFor="tech-active" className="text-sm text-gray-700">
              Active — appears in the Job assignment dropdown
            </label>
          </div>

          {error && <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</div>}

          <button type="submit" disabled={saving} className="w-full btn-primary py-2.5 disabled:opacity-50">
            {saving ? 'Saving…' : (isEdit ? 'Save Changes' : 'Add Technician')}
          </button>
        </form>
      </div>
    </div>
  )
}

export default function AdminTechnicians() {
  const [technicians, setTechnicians] = useState([])
  const [loading, setLoading] = useState(true)
  const [showNew, setShowNew] = useState(false)
  const [editing, setEditing] = useState(null)
  const [showInactive, setShowInactive] = useState(false)
  const navigate = useNavigate()

  const fetchTechnicians = useCallback(async () => {
    if (!getToken()) { navigate('/admin'); return }
    const res = await adminFetch(`/api/admin/technicians?includeInactive=${showInactive}`)
    if (res?.technicians) setTechnicians(res.technicians)
    setLoading(false)
  }, [navigate, showInactive])

  useEffect(() => { fetchTechnicians() }, [fetchTechnicians])

  const createTechnician = async (form) => {
    const res = await adminFetch('/api/admin/technicians', { method: 'POST', body: JSON.stringify(form) })
    if (res?.error) throw new Error(res.error)
    await fetchTechnicians()
  }

  const updateTechnician = async (id, form) => {
    const res = await adminFetch(`/api/admin/technicians/${id}`, { method: 'PATCH', body: JSON.stringify(form) })
    if (res?.error) throw new Error(res.error)
    await fetchTechnicians()
  }

  const deleteTechnician = async (id) => {
    if (!confirm('Remove this technician? Their history on existing jobs stays intact — they just stop appearing in the dropdown. Use Edit → Active = off instead if you might bring them back later.')) return
    await adminFetch(`/api/admin/technicians/${id}`, { method: 'DELETE' })
    fetchTechnicians()
  }

  if (loading) return <AdminLayout><div className="text-center py-20 text-gray-500">Loading…</div></AdminLayout>

  return (
    <AdminLayout>
      <div className="flex items-center justify-between gap-4 mb-6 flex-wrap">
        <div>
          <h2 className="font-display font-bold text-xl text-charcoal-900">Technicians</h2>
          <p className="text-sm text-gray-500 mt-0.5">The crew. Everyone who can be assigned to a job.</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowInactive(v => !v)}
            className="px-3 py-1.5 rounded-lg text-xs font-medium bg-white border border-gray-200 hover:bg-gray-100 inline-flex items-center gap-1"
          >
            {showInactive ? <EyeOff size={14} /> : <Eye size={14} />}
            {showInactive ? 'Showing inactive' : 'Active only'}
          </button>
          <button onClick={() => setShowNew(true)} className="btn-primary text-xs py-1.5 px-3">
            <Plus size={14} />New Technician
          </button>
        </div>
      </div>

      {technicians.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-xl p-10 text-center">
          <Users className="text-gray-300 mx-auto mb-3" size={48} />
          <h3 className="font-display font-bold text-lg text-charcoal-900 mb-1">No technicians yet</h3>
          <p className="text-sm text-gray-500 mb-5">
            Add Jimmy, Jarrett, or anyone else who runs calls. They'll show up in the Job assignment dropdown.
          </p>
          <button onClick={() => setShowNew(true)} className="btn-primary text-sm py-2 px-4">
            <Plus size={14} />Add Your First Technician
          </button>
        </div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-100 text-[10px] uppercase tracking-wider text-gray-500">
              <tr>
                <th className="text-left px-4 py-2 font-semibold">Name</th>
                <th className="text-left px-4 py-2 font-semibold">Role</th>
                <th className="text-left px-4 py-2 font-semibold hidden md:table-cell">Contact</th>
                <th className="text-left px-4 py-2 font-semibold hidden lg:table-cell">Hire Date</th>
                <th className="text-right px-4 py-2 font-semibold hidden lg:table-cell">Rate</th>
                <th className="w-24 px-4 py-2 font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {technicians.map(t => (
                <tr key={t.id} className={t.active === false ? 'bg-gray-50/50 opacity-70' : ''}>
                  <td className="px-4 py-3">
                    <div className="text-sm font-medium text-charcoal-900">{t.name}</div>
                    {t.active === false && <span className="text-[10px] text-gray-500 uppercase tracking-wider">Inactive</span>}
                    {t.notes && <div className="text-[10px] text-gray-400 line-clamp-1 max-w-xs mt-0.5">{t.notes}</div>}
                  </td>
                  <td className="px-4 py-3"><RoleBadge value={t.role} /></td>
                  <td className="px-4 py-3 hidden md:table-cell">
                    {t.phone && (
                      <div className="flex items-center gap-1 text-xs text-gray-700">
                        <Phone size={10} />
                        <a href={`tel:${t.phone}`} className="hover:underline">{t.phone}</a>
                      </div>
                    )}
                    {t.email && (
                      <div className="flex items-center gap-1 text-xs text-gray-500 mt-0.5">
                        <Mail size={10} />
                        <a href={`mailto:${t.email}`} className="hover:underline truncate max-w-[200px]">{t.email}</a>
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3 hidden lg:table-cell">
                    <div className="text-xs text-gray-500">{t.hireDate ? formatDate(t.hireDate) : '—'}</div>
                  </td>
                  <td className="px-4 py-3 text-right hidden lg:table-cell">
                    <div className="text-xs text-gray-700">
                      {t.hourlyRate != null ? `$${Number(t.hourlyRate).toFixed(2)}/hr` : '—'}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1">
                      <button
                        onClick={() => setEditing(t)}
                        className="p-1.5 rounded hover:bg-gray-100 text-gray-600"
                        title="Edit"
                      >
                        <Pencil size={14} />
                      </button>
                      <button
                        onClick={() => deleteTechnician(t.id)}
                        className="p-1.5 rounded hover:bg-red-50 text-red-600"
                        title="Remove"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showNew && (
        <TechnicianModal
          onClose={() => setShowNew(false)}
          onSave={createTechnician}
        />
      )}
      {editing && (
        <TechnicianModal
          technician={editing}
          onClose={() => setEditing(null)}
          onSave={(form) => updateTechnician(editing.id, form)}
        />
      )}
    </AdminLayout>
  )
}
