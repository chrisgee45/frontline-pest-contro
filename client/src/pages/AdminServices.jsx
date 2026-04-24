import { useState, useEffect, useCallback, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, X, Pencil, Trash2, Package, Sparkles, Eye, EyeOff, RefreshCw, CheckCircle2, AlertCircle } from 'lucide-react'
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
  const [syncing, setSyncing] = useState(false)
  const [stripeStatus, setStripeStatus] = useState({ configured: false, mode: 'unconfigured' })
  const [rowSyncing, setRowSyncing] = useState(null) // id of service currently syncing
  const navigate = useNavigate()

  const fetchServices = useCallback(async () => {
    if (!getToken()) { navigate('/admin'); return }
    const [svcRes, stripeRes] = await Promise.all([
      adminFetch(`/api/admin/services?includeInactive=${showInactive}`),
      adminFetch('/api/admin/stripe/status'),
    ])
    if (svcRes?.services) setServices(svcRes.services)
    if (stripeRes) setStripeStatus(stripeRes)
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

  // Sync all services to Stripe. Creates matching Products + Prices for
  // any service that doesn't yet have a stripeProductId. Safe to click
  // repeatedly — already-synced services are skipped.
  const syncAllToStripe = async () => {
    if (!stripeStatus.configured) {
      alert('Stripe is not configured yet. Add STRIPE_SECRET_KEY to Railway first.')
      return
    }
    if (!confirm('Sync all unsynced services to Stripe? This creates matching Products + Prices in Jimmy\'s Stripe dashboard.')) return
    setSyncing(true)
    const res = await adminFetch('/api/admin/services/sync-all', { method: 'POST' })
    setSyncing(false)
    if (res?.success) {
      const parts = []
      if (res.synced > 0) parts.push(`${res.synced} synced`)
      if (res.skipped > 0) parts.push(`${res.skipped} already synced (skipped)`)
      if (res.errors?.length > 0) parts.push(`${res.errors.length} errors — check the console`)
      alert(parts.join(', ') || 'Nothing to sync.')
      if (res.errors?.length > 0) console.error('[stripe sync-all] errors:', res.errors)
    } else {
      alert(`Sync failed: ${res?.error || 'unknown error'}`)
    }
    fetchServices()
  }

  // Sync a single service. Used for rows that errored out, or for
  // services created before Stripe was configured.
  const syncOneToStripe = async (id) => {
    if (!stripeStatus.configured) return
    setRowSyncing(id)
    const res = await adminFetch(`/api/admin/services/${id}/sync`, { method: 'POST' })
    setRowSyncing(null)
    if (!res?.success) {
      alert(`Sync failed: ${res?.error || 'unknown error'}`)
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

  // Stripe sync counters for the header banner
  const unsyncedCount = services.filter(s => !s.stripeProductId).length
  const syncedCount = services.length - unsyncedCount

  const isEmpty = !loading && services.length === 0

  if (loading) return <AdminLayout><div className="text-center py-20 text-gray-500">Loading…</div></AdminLayout>

  return (
    <AdminLayout>
      <div className="flex items-center justify-between gap-4 mb-6 flex-wrap">
        <div>
          <h2 className="font-display font-bold text-xl text-charcoal-900">Services Catalog</h2>
          <p className="text-sm text-gray-500 mt-0.5">Services &amp; default prices that appear in the Job and Invoice line-item pickers.</p>
        </div>
        <div className="flex gap-2 flex-wrap">
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
          {stripeStatus.configured && unsyncedCount > 0 && (
            <button
              onClick={syncAllToStripe}
              disabled={syncing}
              className="px-3 py-1.5 rounded-lg text-xs font-medium bg-purple-100 border border-purple-200 text-purple-900 hover:bg-purple-200 inline-flex items-center gap-1 disabled:opacity-50"
              title="Create matching Stripe Products + Prices for any un-synced services"
            >
              <RefreshCw size={14} className={syncing ? 'animate-spin' : ''} />
              {syncing ? 'Syncing…' : `Sync ${unsyncedCount} to Stripe`}
            </button>
          )}
          <button onClick={() => setShowNew(true)} className="btn-primary text-xs py-1.5 px-3">
            <Plus size={14} />New Service
          </button>
        </div>
      </div>

      {/* Stripe status banner — so Jimmy knows where he stands at a glance */}
      {!loading && services.length > 0 && (
        stripeStatus.configured ? (
          <div className={`mb-4 rounded-lg border px-4 py-2.5 flex items-center gap-3 text-sm ${
            unsyncedCount === 0
              ? 'bg-green-50 border-green-200 text-green-900'
              : 'bg-purple-50 border-purple-200 text-purple-900'
          }`}>
            {unsyncedCount === 0
              ? <CheckCircle2 size={16} className="text-green-600 shrink-0" />
              : <AlertCircle size={16} className="text-purple-600 shrink-0" />
            }
            <div className="flex-1 min-w-0">
              <strong>Stripe {stripeStatus.mode === 'live' ? 'LIVE' : 'test'} mode.</strong>{' '}
              {unsyncedCount === 0
                ? `All ${syncedCount} services are synced — they appear in Jimmy's Stripe dashboard as Products.`
                : `${syncedCount} synced, ${unsyncedCount} not yet synced. Click "Sync ${unsyncedCount} to Stripe" to push them.`
              }
            </div>
          </div>
        ) : (
          <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-2.5 flex items-center gap-3 text-sm text-amber-900">
            <AlertCircle size={16} className="text-amber-600 shrink-0" />
            <div className="flex-1 min-w-0">
              <strong>Stripe is not configured.</strong> Services work locally, but they won't appear in Stripe until you add <code className="text-[11px] bg-amber-100 px-1 py-0.5 rounded">STRIPE_SECRET_KEY</code> to Railway environment variables.
            </div>
          </div>
        )
      )}

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
                            <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold bg-purple-100 text-purple-800" title={`Stripe Product: ${s.stripeProductId}`}>
                              <CheckCircle2 size={10} className="inline mr-0.5" />Synced
                            </span>
                          ) : stripeStatus.configured ? (
                            <button
                              onClick={() => syncOneToStripe(s.id)}
                              disabled={rowSyncing === s.id}
                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-200 disabled:opacity-50"
                              title="Create matching Stripe Product + Price"
                            >
                              <RefreshCw size={10} className={rowSyncing === s.id ? 'animate-spin' : ''} />
                              {rowSyncing === s.id ? 'Syncing…' : 'Sync'}
                            </button>
                          ) : (
                            <span className="text-[10px] text-gray-400">—</span>
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
