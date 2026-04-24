import { useState, useEffect, useCallback, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, X, Pencil, Trash2, Car, Download, MapPin, Calendar, Info, Save } from 'lucide-react'
import AdminLayout from '../components/AdminLayout'
import { adminFetch, getToken, formatCurrency, formatDate } from '../hooks/useAdmin'

const CATEGORIES = [
  { value: 'customer_visit',  label: 'Customer Visit',  color: 'bg-forest-100 text-forest-800' },
  { value: 'supply_pickup',   label: 'Supply Pickup',   color: 'bg-amber-100 text-amber-800' },
  { value: 'business_errand', label: 'Business Errand', color: 'bg-blue-100 text-blue-800' },
  { value: 'training',        label: 'Training',        color: 'bg-purple-100 text-purple-800' },
  { value: 'other',           label: 'Other',           color: 'bg-gray-100 text-gray-700' },
]

function CategoryBadge({ value }) {
  const c = CATEGORIES.find(x => x.value === value) || CATEGORIES[4]
  return <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold ${c.color}`}>{c.label}</span>
}

function MileageModal({ entry, onClose, onSave }) {
  const todayStr = new Date().toISOString().slice(0, 10)
  const [form, setForm] = useState({
    date: entry?.date || todayStr,
    vehicle: entry?.vehicle || 'Service Truck',
    startLocation: entry?.startLocation || '',
    endLocation: entry?.endLocation || '',
    miles: entry?.miles != null ? String(entry.miles) : '',
    purpose: entry?.purpose || '',
    category: entry?.category || 'customer_visit',
    notes: entry?.notes || '',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const isEdit = !!entry

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSaving(true); setError('')
    try {
      await onSave({
        ...form,
        miles: Number(form.miles),
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
          <h3 className="font-display font-bold text-lg">{isEdit ? 'Edit Mileage Entry' : 'Log Mileage'}</h3>
          <button onClick={onClose}><X size={20} /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Date *</label>
              <input
                required
                type="date"
                value={form.date}
                onChange={e => setForm({ ...form, date: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:border-forest-500 outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Miles *</label>
              <input
                required
                type="number"
                step="0.1"
                min="0.1"
                value={form.miles}
                onChange={e => setForm({ ...form, miles: e.target.value })}
                placeholder="18.5"
                className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:border-forest-500 outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Business Purpose *</label>
            <input
              required
              value={form.purpose}
              onChange={e => setForm({ ...form, purpose: e.target.value })}
              placeholder="e.g., Termite inspection — Smith residence"
              className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:border-forest-500 outline-none"
            />
            <p className="text-[10px] text-gray-400 mt-0.5">Required by IRS. Be specific — "work stuff" won't hold up on audit.</p>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Vehicle</label>
            <input
              value={form.vehicle}
              onChange={e => setForm({ ...form, vehicle: e.target.value })}
              placeholder="Service Truck, F-150, etc."
              className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:border-forest-500 outline-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Start Location</label>
              <input
                value={form.startLocation}
                onChange={e => setForm({ ...form, startLocation: e.target.value })}
                placeholder="Shop / home"
                className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:border-forest-500 outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">End Location</label>
              <input
                value={form.endLocation}
                onChange={e => setForm({ ...form, endLocation: e.target.value })}
                placeholder="Customer address / store"
                className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:border-forest-500 outline-none"
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

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Notes</label>
            <textarea
              value={form.notes}
              onChange={e => setForm({ ...form, notes: e.target.value })}
              rows={2}
              placeholder="Optional"
              className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:border-forest-500 outline-none resize-none"
            />
          </div>

          {error && <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</div>}

          <button type="submit" disabled={saving} className="w-full btn-primary py-2.5 disabled:opacity-50">
            {saving ? 'Saving…' : (isEdit ? 'Save Changes' : 'Log This Trip')}
          </button>
        </form>
      </div>
    </div>
  )
}

function RateSettingsModal({ settings, onClose, onSave }) {
  const [form, setForm] = useState({
    currentYearRate: settings?.currentYearRate != null ? String(settings.currentYearRate) : '0.70',
    rateYear: settings?.rateYear || new Date().getFullYear(),
  })
  const [saving, setSaving] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSaving(true)
    await onSave({
      currentYearRate: Number(form.currentYearRate),
      rateYear: Number(form.rateYear),
    })
    setSaving(false)
    onClose()
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl w-full max-w-md" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-5 border-b">
          <h3 className="font-display font-bold text-lg">IRS Mileage Rate</h3>
          <button onClick={onClose}><X size={20} /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-xs text-blue-900 flex items-start gap-2">
            <Info size={14} className="shrink-0 mt-0.5 text-blue-600" />
            <div>
              The IRS publishes a new standard mileage rate every December for the coming year.
              2024 was $0.67/mile; 2025 is $0.70/mile. Update this yearly when the IRS announces the new rate.
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Rate Year</label>
            <input
              type="number"
              value={form.rateYear}
              onChange={e => setForm({ ...form, rateYear: e.target.value })}
              className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:border-forest-500 outline-none"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Rate per Mile ($)</label>
            <input
              type="number"
              step="0.001"
              value={form.currentYearRate}
              onChange={e => setForm({ ...form, currentYearRate: e.target.value })}
              className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:border-forest-500 outline-none"
            />
          </div>
          <button type="submit" disabled={saving} className="w-full btn-primary py-2.5 disabled:opacity-50">
            {saving ? 'Saving…' : 'Save'}
          </button>
        </form>
      </div>
    </div>
  )
}

export default function AdminMileage() {
  const [entries, setEntries] = useState([])
  const [summary, setSummary] = useState(null)
  const [settings, setSettings] = useState(null)
  const [year, setYear] = useState(new Date().getFullYear())
  const [loading, setLoading] = useState(true)
  const [showNew, setShowNew] = useState(false)
  const [editing, setEditing] = useState(null)
  const [showSettings, setShowSettings] = useState(false)
  const navigate = useNavigate()

  const fetchData = useCallback(async () => {
    if (!getToken()) { navigate('/admin'); return }
    const [entriesRes, summaryRes, settingsRes] = await Promise.all([
      adminFetch(`/api/admin/mileage?year=${year}`),
      adminFetch(`/api/admin/mileage/summary?year=${year}`),
      adminFetch('/api/admin/mileage/settings'),
    ])
    if (entriesRes?.entries) setEntries(entriesRes.entries)
    if (summaryRes?.summary) setSummary(summaryRes.summary)
    if (settingsRes?.settings) setSettings(settingsRes.settings)
    setLoading(false)
  }, [navigate, year])

  useEffect(() => { fetchData() }, [fetchData])

  const createEntry = async (form) => {
    const res = await adminFetch('/api/admin/mileage', { method: 'POST', body: JSON.stringify(form) })
    if (res?.error) throw new Error(res.error)
    await fetchData()
  }

  const updateEntry = async (id, form) => {
    const res = await adminFetch(`/api/admin/mileage/${id}`, { method: 'PATCH', body: JSON.stringify(form) })
    if (res?.error) throw new Error(res.error)
    await fetchData()
  }

  const deleteEntry = async (id) => {
    if (!confirm('Delete this mileage entry? This removes it from your deduction total — only do this if it was a mistake.')) return
    await adminFetch(`/api/admin/mileage/${id}`, { method: 'DELETE' })
    fetchData()
  }

  const saveSettings = async (patch) => {
    await adminFetch('/api/admin/mileage/settings', { method: 'PUT', body: JSON.stringify(patch) })
    fetchData()
  }

  // Current month count for the "This Month" tile.
  const thisMonth = useMemo(() => {
    const now = new Date()
    const ym = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
    return entries.filter(e => (e.date || '').startsWith(ym)).reduce((s, e) => s + (Number(e.miles) || 0), 0)
  }, [entries])

  if (loading) return <AdminLayout><div className="text-center py-20 text-gray-500">Loading…</div></AdminLayout>

  return (
    <AdminLayout>
      <div className="flex items-center justify-between gap-4 mb-6 flex-wrap">
        <div>
          <h2 className="font-display font-bold text-xl text-charcoal-900">Mileage Log</h2>
          <p className="text-sm text-gray-500 mt-0.5">
            Business-vehicle miles for the IRS standard mileage deduction (Schedule C line 9). The law requires a contemporaneous log — log trips as you make them, not at year-end.
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <select
            value={year}
            onChange={e => setYear(Number(e.target.value))}
            className="px-3 py-1.5 rounded-lg border border-gray-200 text-xs bg-white"
          >
            {[new Date().getFullYear() + 1, new Date().getFullYear(), new Date().getFullYear() - 1, new Date().getFullYear() - 2].map(y => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
          <a
            href={`/api/admin/mileage/csv?year=${year}`}
            download
            className="px-3 py-1.5 rounded-lg text-xs font-medium bg-white border border-gray-200 hover:bg-gray-50 inline-flex items-center gap-1"
          >
            <Download size={14} />Export CSV
          </a>
          <button
            onClick={() => setShowSettings(true)}
            className="px-3 py-1.5 rounded-lg text-xs font-medium bg-white border border-gray-200 hover:bg-gray-50 inline-flex items-center gap-1"
          >
            Rate: ${(settings?.currentYearRate || 0.70).toFixed(3)}/mi
          </button>
          <button onClick={() => setShowNew(true)} className="btn-primary text-xs py-1.5 px-3">
            <Plus size={14} />Log Mileage
          </button>
        </div>
      </div>

      {/* Summary tiles */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm text-center">
          <div className="font-display font-bold text-2xl text-charcoal-900 tabular-nums">{summary?.totalMiles?.toFixed(1) || '0.0'}</div>
          <div className="text-xs text-gray-500 mt-1">Total Miles ({year})</div>
        </div>
        <div className="bg-white rounded-xl p-4 border border-forest-200 shadow-sm text-center">
          <div className="font-display font-bold text-2xl text-forest-700 tabular-nums">{formatCurrency(summary?.deductibleAmount || 0)}</div>
          <div className="text-xs text-forest-700 mt-1">Deduction ({year})</div>
          <div className="text-[10px] text-gray-400 mt-0.5">@ ${(summary?.rate || 0).toFixed(3)}/mi</div>
        </div>
        <div className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm text-center">
          <div className="font-display font-bold text-2xl text-charcoal-900 tabular-nums">{thisMonth.toFixed(1)}</div>
          <div className="text-xs text-gray-500 mt-1">This Month</div>
        </div>
        <div className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm text-center">
          <div className="font-display font-bold text-2xl text-charcoal-900 tabular-nums">{summary?.entryCount || 0}</div>
          <div className="text-xs text-gray-500 mt-1">Trips Logged</div>
        </div>
      </div>

      {/* Entries table */}
      {entries.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-xl p-10 text-center">
          <Car className="text-gray-300 mx-auto mb-3" size={48} />
          <h3 className="font-display font-bold text-lg text-charcoal-900 mb-1">No mileage logged for {year}</h3>
          <p className="text-sm text-gray-500 mb-5 max-w-md mx-auto">
            Every mile Jimmy drives to a customer, to pick up supplies, or to training is deductible at ${(summary?.rate || 0.70).toFixed(2)}/mile. It adds up fast — typical service truck puts on 15,000–25,000 business miles a year.
          </p>
          <button onClick={() => setShowNew(true)} className="btn-primary text-sm py-2 px-4">
            <Plus size={14} />Log Your First Trip
          </button>
        </div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-100 text-[10px] uppercase tracking-wider text-gray-500">
              <tr>
                <th className="text-left px-4 py-2 font-semibold">Date</th>
                <th className="text-left px-4 py-2 font-semibold">Purpose</th>
                <th className="text-left px-4 py-2 font-semibold hidden md:table-cell">Route</th>
                <th className="text-left px-4 py-2 font-semibold hidden lg:table-cell">Category</th>
                <th className="text-right px-4 py-2 font-semibold">Miles</th>
                <th className="text-right px-4 py-2 font-semibold hidden md:table-cell">Deduction</th>
                <th className="w-24 px-4 py-2 font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {entries.map(e => (
                <tr key={e.id}>
                  <td className="px-4 py-3">
                    <div className="text-xs font-medium text-charcoal-900 whitespace-nowrap">{formatDate(e.date)}</div>
                    {e.vehicle && <div className="text-[10px] text-gray-400 whitespace-nowrap">{e.vehicle}</div>}
                  </td>
                  <td className="px-4 py-3">
                    <div className="text-sm text-charcoal-900 line-clamp-1 max-w-xs">{e.purpose}</div>
                    {e.notes && <div className="text-[10px] text-gray-500 line-clamp-1 max-w-xs mt-0.5">{e.notes}</div>}
                  </td>
                  <td className="px-4 py-3 hidden md:table-cell">
                    {(e.startLocation || e.endLocation) ? (
                      <div className="text-xs text-gray-600 flex items-center gap-1 max-w-[180px]">
                        <MapPin size={10} className="shrink-0 text-gray-400" />
                        <span className="truncate">{e.startLocation || '?'} → {e.endLocation || '?'}</span>
                      </div>
                    ) : (
                      <span className="text-[10px] text-gray-400">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 hidden lg:table-cell">
                    <CategoryBadge value={e.category} />
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums font-semibold text-charcoal-900">{Number(e.miles).toFixed(1)}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-forest-700 font-medium hidden md:table-cell">
                    {formatCurrency(Number(e.miles) * (summary?.rate || 0.70))}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1">
                      <button
                        onClick={() => setEditing(e)}
                        className="p-1.5 rounded hover:bg-gray-100 text-gray-600"
                        title="Edit"
                      >
                        <Pencil size={14} />
                      </button>
                      <button
                        onClick={() => deleteEntry(e.id)}
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
      )}

      <p className="text-[10px] text-gray-400 italic mt-4 text-center">
        Rates: IRS publishes the standard mileage rate each December. Current stored rate is ${(settings?.currentYearRate || 0.70).toFixed(3)}/mile. Update in Rate Settings when the IRS publishes a new one.
      </p>

      {showNew && (
        <MileageModal
          onClose={() => setShowNew(false)}
          onSave={createEntry}
        />
      )}
      {editing && (
        <MileageModal
          entry={editing}
          onClose={() => setEditing(null)}
          onSave={(form) => updateEntry(editing.id, form)}
        />
      )}
      {showSettings && (
        <RateSettingsModal
          settings={settings}
          onClose={() => setShowSettings(false)}
          onSave={saveSettings}
        />
      )}
    </AdminLayout>
  )
}
