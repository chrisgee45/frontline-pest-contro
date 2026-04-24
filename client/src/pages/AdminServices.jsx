import { useState, useEffect, useCallback, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, X, Pencil, Trash2, Package, Sparkles, Eye, EyeOff } from 'lucide-react'
import AdminLayout from '../components/AdminLayout'
import { adminFetch, getToken, formatCurrency } from '../hooks/useAdmin'

const CATEGORIES = [
  { value: 'termite', label: 'Termite', color: 'bg-amber-100 text-amber-800' },
  { value: 'pest',    label: 'General Pest', color: 'bg-green-100 text-green-800' },
  { value: 'rodent',  label: 'Rodent', color: 'bg-purple-100 text-purple-800' },
  { value: 'inspection', label: 'Inspection', color: 'bg-blue-100 text-blue-800' },
  { value: 'other',   label: 'Other', color: 'bg-gray-100 text-gray-800' },
]

function CategoryBadge({ value }) {
  const cat = CATEGORIES.find(c => c.value === value) || CATEGORIES[4]
  return <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold ${cat.color}`}>{cat.label}</span>
}

function ServiceModal({ service, onClose, onSave }) {
  const [form, setForm] = useState({
    name: service?.name || '',
    description: service?.description || '',
    defaultPrice: service?.defaultPrice != null ? String(service.defaultPrice) : '',
    category: service?.category || 'pest',
    active: service ? service.active !== false : true,
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const isEdit = !!service

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSaving(true); setError('')
    try {
      const payload = {
        ...form,
        defaultPrice: Number(form.defaultPrice),
      }
      if (!Number.isFinite(payload.defaultPrice) || payload.defaultPrice < 0) {
        throw new Error('Price must be a non-negative number')
      }
      await onSave(payload)
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
          <h3 className="font-display font-bold text-lg">{isEdit ? 'Edit Service' : 'New Service'}</h3>
          <button onClick={onClose}><X size={20} /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Name *</label>
            <input
              required
              value={form.name}
              onChange={e => setForm({ ...form, name: e.target.value })}
              placeholder="e.g. Termite Treatment — Full Perimeter"
              className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:border-forest-500 outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Description</label>
            <textarea
              value={form.description}
              onChange={e => setForm({ ...form, description: e.target.value })}
              rows={3}
              placeholder="What's included in this service. Shows up on invoices and Stripe receipts."
              className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:border-forest-500 outline-none resize-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Default Price *</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
                <input
                  required
                  type="number"
                  step="0.01"
                  min="0"
                  value={form.defaultPrice}
                  onChange={e => setForm({ ...form, defaultPrice: e.target.value })}
                  placeholder="0.00"
                  className="w-full pl-7 pr-3 py-2 rounded-lg border border-gray-200 text-sm focus:border-forest-500 outline-none"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Category *</label>
              <select
                value={form.category}
                onChange={e => setForm({ ...form, category: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm bg-white focus:border-forest-500 outline-none"
              >
                {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
              </select>
            </div>
          </div>

          <div className="flex items-center gap-2 pt-1">
            <input
              id="service-active"
              type="checkbox"
              checked={form.active}
              onChange={e => setForm({ ...form, active: e.target.checked })}
              className="h-4 w-4 rounded border-gray-300 text-forest-600 focus:ring-forest-500"
            />
            <label htmlFor="service-active" className="text-sm text-gray-700">
              Active — available in Jobs &amp; Invoice line-item pickers
            </label>
          </div>

          {isEdit && service.stripeProductId && (
            <div className="rounded-lg bg-purple-50 border border-purple-200 px-3 py-2 text-[11px] text-purple-800">
              <strong>Stripe:</strong> Synced as <code className="font-mono">{service.stripeProductId}</code>.
              Changing the price will create a new Stripe Price and archive the old one (Stripe Prices are immutable).
            </div>
          )}

          {error && <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</div>}

          <button type="submit" disabled={saving} className="w-full btn-primary py-2.5 disabled:opacity-50">
            {saving ? 'Saving…' : (isEdit ? 'Save Changes' : 'Create Service')}
          </button>
        </form>
      </div>
    </div>
  )
}

export default function AdminServices() {
  const [services, setServices] = useState([])
  const [loading, setLoading] = useState(true)
  const [showNew, setShowNew] = useState(false)
  const [editing, setEditing] = useState(null)
  const [showInactive, setShowInactive] = useState(false)
  const [seeding, setSeeding] = useState(false)
  const navigate = useNavigate()

  const fetchServices = useCallback(async () => {
    if (!getToken()) { navigate('/admin'); return }
    const res = await adminFetch(`/api/admin/services?includeInactive=${showInactive}`)
    if (res?.services) setServices(res.services)
    setLoading(false)
  }, [navigate, showInactive])

  useEffect(() => { fetchServices() }, [fetchServices])

  const createService = async (form) => {
    const res = await adminFetch('/api/admin/services', { method: 'POST', body: JSON.stringify(form) })
    if (res?.error) throw new Error(res.error)
    await fetchServices()
  }

  const updateService = async (id, form) => {
    const res = await adminFetch(`/api/admin/services/${id}`, { method: 'PATCH', body: JSON.stringify(form) })
    if (res?.error) throw new Error(res.error)
    await fetchServices()
  }

  const deleteService = async (id) => {
    if (!confirm('Delete this service? Existing invoices and jobs keep their line-item copies — this only removes it from the picker.')) return
    await adminFetch(`/api/admin/services/${id}`, { method: 'DELETE' })
    fetchServices()
  }

  const seedStarter = async () => {
    if (!confirm('Seed the catalog with a starter set of common pest services? This only runs if the catalog is empty.')) return
    setSeeding(true)
    const res = await adminFetch('/api/admin/services/seed', { method: 'POST' })
    setSeeding(false)
    if (res?.seeded) {
      alert(`Seeded ${res.count} starter services. You can edit or delete any of them.`)
    } else {
      alert('Catalog already has services — skipped.')
    }
    fetchServices()
  }

  // Group by category for a nicer table view.
  const grouped = useMemo(() => {
    const groups = {}
    for (const s of services) {
      const k = s.category || 'other'
      if (!groups[k]) groups[k] = []
      groups[k].push(s)
    }
    return groups
  }, [services])

  const isEmpty = !loading && services.length === 0

  if (loading) return <AdminLayout><div className="text-center py-20 text-gray-500">Loading…</div></AdminLayout>

  return (
    <AdminLayout>
      <div className="flex items-center justify-between gap-4 mb-6 flex-wrap">
        <div>
          <h2 className="font-display font-bold text-xl text-charcoal-900">Services Catalog</h2>
          <p className="text-sm text-gray-500 mt-0.5">Services &amp; default prices that appear in the Job and Invoice line-item pickers.</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowInactive(v => !v)}
            className="px-3 py-1.5 rounded-lg text-xs font-medium bg-white border border-gray-200 hover:bg-gray-100 inline-flex items-center gap-1"
            title={showInactive ? 'Hide inactive services' : 'Show inactive services'}
          >
            {showInactive ? <EyeOff size={14} /> : <Eye size={14} />}
            {showInactive ? 'Showing inactive' : 'Active only'}
          </button>
          {isEmpty && (
            <button onClick={seedStarter} disabled={seeding} className="px-3 py-1.5 rounded-lg text-xs font-medium bg-amber-100 border border-amber-200 text-amber-900 hover:bg-amber-200 inline-flex items-center gap-1 disabled:opacity-50">
              <Sparkles size={14} />{seeding ? 'Seeding…' : 'Seed Starter Services'}
            </button>
          )}
          <button onClick={() => setShowNew(true)} className="btn-primary text-xs py-1.5 px-3">
            <Plus size={14} />New Service
          </button>
        </div>
      </div>

      {isEmpty ? (
        <div className="bg-white border border-gray-200 rounded-xl p-10 text-center">
          <Package className="text-gray-300 mx-auto mb-3" size={48} />
          <h3 className="font-display font-bold text-lg text-charcoal-900 mb-1">No services yet</h3>
          <p className="text-sm text-gray-500 mb-5">
            Add your services and default prices so Jimmy can drop them onto jobs and invoices with one click.
          </p>
          <div className="flex justify-center gap-2 flex-wrap">
            <button onClick={seedStarter} disabled={seeding} className="px-4 py-2 rounded-lg text-sm font-medium bg-amber-100 border border-amber-200 text-amber-900 hover:bg-amber-200 inline-flex items-center gap-1 disabled:opacity-50">
              <Sparkles size={14} />{seeding ? 'Seeding…' : 'Seed Starter Set'}
            </button>
            <button onClick={() => setShowNew(true)} className="btn-primary text-sm py-2 px-4">
              <Plus size={14} />Add Manually
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          {CATEGORIES.map(cat => {
            const rows = grouped[cat.value] || []
            if (rows.length === 0) return null
            return (
              <div key={cat.value} className="bg-white border border-gray-200 rounded-xl overflow-hidden">
                <div className="px-4 py-2.5 bg-gray-50 border-b border-gray-200 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <CategoryBadge value={cat.value} />
                    <span className="text-sm font-semibold text-charcoal-900">{cat.label}</span>
                    <span className="text-xs text-gray-500">· {rows.length} {rows.length === 1 ? 'service' : 'services'}</span>
                  </div>
                </div>
                <table className="w-full">
                  <thead className="bg-gray-50 border-b border-gray-100 text-[10px] uppercase tracking-wider text-gray-500">
                    <tr>
                      <th className="text-left px-4 py-2 font-semibold">Name</th>
                      <th className="text-left px-4 py-2 font-semibold hidden md:table-cell">Description</th>
                      <th className="text-right px-4 py-2 font-semibold">Price</th>
                      <th className="text-center px-4 py-2 font-semibold hidden lg:table-cell">Stripe</th>
                      <th className="w-20 px-4 py-2 font-semibold">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {rows.map(s => (
                      <tr key={s.id} className={s.active === false ? 'bg-gray-50/50 opacity-70' : ''}>
                        <td className="px-4 py-3">
                          <div className="text-sm font-medium text-charcoal-900">{s.name}</div>
                          {s.active === false && <span className="text-[10px] text-gray-500 uppercase tracking-wider">Inactive</span>}
                        </td>
                        <td className="px-4 py-3 hidden md:table-cell">
                          <div className="text-xs text-gray-500 line-clamp-2 max-w-md">{s.description || '—'}</div>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="text-sm font-semibold text-charcoal-900">{formatCurrency(s.defaultPrice)}</div>
                        </td>
                        <td className="px-4 py-3 text-center hidden lg:table-cell">
                          {s.stripeProductId ? (
                            <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold bg-purple-100 text-purple-800" title={`Product: ${s.stripeProductId}`}>
                              Synced
                            </span>
                          ) : (
                            <span className="text-[10px] text-gray-400">Not synced</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex gap-1">
                            <button
                              onClick={() => setEditing(s)}
                              className="p-1.5 rounded hover:bg-gray-100 text-gray-600"
                              title="Edit"
                            >
                              <Pencil size={14} />
                            </button>
                            <button
                              onClick={() => deleteService(s.id)}
                              className="p-1.5 rounded hover:bg-red-50 text-red-600"
                              title="Delete"
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
            )
          })}
        </div>
      )}

      {showNew && (
        <ServiceModal
          onClose={() => setShowNew(false)}
          onSave={createService}
        />
      )}
      {editing && (
        <ServiceModal
          service={editing}
          onClose={() => setEditing(null)}
          onSave={(form) => updateService(editing.id, form)}
        />
      )}
    </AdminLayout>
  )
}
