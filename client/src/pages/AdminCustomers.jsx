import { useState, useEffect, useCallback, useMemo } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { UserSquare, Search, Phone, Mail, MapPin, Calendar, DollarSign, ChevronRight, Plus } from 'lucide-react'
import AdminLayout from '../components/AdminLayout'
import { adminFetch, getToken, formatCurrency, formatDate } from '../hooks/useAdmin'

const SORT_OPTIONS = [
  { value: 'updatedAt', label: 'Recently updated' },
  { value: 'displayName', label: 'Name (A–Z)' },
  { value: 'balance', label: 'Balance owed' },
  { value: 'totalBilled', label: 'Lifetime billed' },
  { value: 'lastServiceDate', label: 'Last service' },
]

// Simple phone formatter for display (405-555-1212 from 4055551212).
function fmtPhone(digits) {
  const d = String(digits || '').replace(/\D/g, '')
  if (d.length === 10) return `${d.slice(0, 3)}-${d.slice(3, 6)}-${d.slice(6)}`
  if (d.length === 11 && d.startsWith('1')) return `${d.slice(1, 4)}-${d.slice(4, 7)}-${d.slice(7)}`
  return digits || ''
}

export default function AdminCustomers() {
  const [customers, setCustomers] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [sortBy, setSortBy] = useState('updatedAt')
  const [showNew, setShowNew] = useState(false)
  const navigate = useNavigate()

  // Debounce the search so we're not hammering the endpoint on each keystroke.
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search.trim()), 300)
    return () => clearTimeout(t)
  }, [search])

  const fetchCustomers = useCallback(async () => {
    if (!getToken()) { navigate('/admin'); return }
    setLoading(true)
    const params = new URLSearchParams({ sortBy })
    if (debouncedSearch) params.set('q', debouncedSearch)
    const data = await adminFetch(`/api/admin/customers?${params}`)
    if (data) setCustomers(data.customers || [])
    setLoading(false)
  }, [navigate, debouncedSearch, sortBy])

  useEffect(() => { fetchCustomers() }, [fetchCustomers])

  const totals = useMemo(() => {
    const totalBilled = customers.reduce((s, c) => s + Number(c.totalBilled || 0), 0)
    const balance = customers.reduce((s, c) => s + Number(c.balance || 0), 0)
    return { totalBilled, balance }
  }, [customers])

  return (
    <AdminLayout>
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <h2 className="font-display font-bold text-xl text-charcoal-900 flex items-center gap-2">
            <UserSquare size={22} className="text-forest-700" />
            Customers
          </h2>
          <p className="text-sm text-gray-500 mt-1">Household accounts, each with jobs and invoice history</p>
        </div>
        <button onClick={() => setShowNew(true)} className="btn-primary text-sm py-2 px-4">
          <Plus size={16} />New Customer
        </button>
      </div>

      {/* Summary tiles */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm text-center">
          <div className="font-display font-bold text-xl text-charcoal-900">{customers.length}</div>
          <div className="text-xs text-gray-500">Total Customers</div>
        </div>
        <div className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm text-center">
          <div className="font-display font-bold text-xl text-amber-600">{formatCurrency(totals.balance)}</div>
          <div className="text-xs text-gray-500">Outstanding Balance</div>
        </div>
        <div className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm text-center">
          <div className="font-display font-bold text-xl text-green-600">{formatCurrency(totals.totalBilled)}</div>
          <div className="text-xs text-gray-500">Lifetime Billed</div>
        </div>
      </div>

      {/* Search + sort */}
      <div className="flex flex-wrap gap-3 mb-4">
        <div className="relative flex-1 min-w-[240px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search name, phone, email, address…"
            className="w-full pl-10 pr-3 py-2 rounded-lg border border-gray-200 text-sm focus:border-forest-500 focus:ring-2 focus:ring-forest-500/20 outline-none"
          />
        </div>
        <select
          value={sortBy}
          onChange={e => setSortBy(e.target.value)}
          className="px-3 py-2 rounded-lg border border-gray-200 text-sm bg-white"
        >
          {SORT_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      </div>

      {/* List */}
      {loading ? (
        <div className="text-center py-20 text-gray-500">Loading…</div>
      ) : customers.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-xl border border-gray-100">
          <UserSquare size={40} className="text-gray-200 mx-auto mb-3" />
          <p className="text-gray-500">
            {debouncedSearch ? `No customers matching "${debouncedSearch}"` : 'No customers yet — they\'ll appear here automatically as leads come in'}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {customers.map(c => (
            <Link
              key={c.id}
              to={`/admin/customers/${c.id}`}
              className="block bg-white rounded-xl border border-gray-100 hover:border-forest-200 hover:shadow-md transition-all p-4 group"
            >
              <div className="flex items-center justify-between gap-4 flex-wrap">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <div className="font-semibold text-charcoal-900 truncate">{c.displayName}</div>
                    {c.tags?.length > 0 && c.tags.slice(0, 2).map(t => (
                      <span key={t} className="text-[10px] bg-forest-50 text-forest-700 px-2 py-0.5 rounded-full">{t}</span>
                    ))}
                  </div>
                  <div className="flex items-center gap-4 text-xs text-gray-500 mt-1 flex-wrap">
                    {c.primaryContactName && c.primaryContactName !== c.displayName && (
                      <span className="truncate">{c.primaryContactName}</span>
                    )}
                    {c.primaryPhone && (
                      <span className="flex items-center gap-1"><Phone size={10} />{fmtPhone(c.primaryPhone)}</span>
                    )}
                    {c.primaryEmail && (
                      <span className="flex items-center gap-1 truncate"><Mail size={10} />{c.primaryEmail}</span>
                    )}
                    {c.billingAddress && (
                      <span className="flex items-center gap-1 truncate"><MapPin size={10} />{c.billingAddress}</span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-6 shrink-0">
                  <div className="text-right">
                    <div className="text-xs text-gray-400">Jobs</div>
                    <div className="font-semibold text-sm">{c.jobCount}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs text-gray-400 flex items-center gap-1 justify-end">
                      <Calendar size={10} />Last service
                    </div>
                    <div className="font-medium text-sm text-gray-700">
                      {c.lastServiceDate ? formatDate(c.lastServiceDate) : '—'}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs text-gray-400 flex items-center gap-1 justify-end">
                      <DollarSign size={10} />Balance
                    </div>
                    <div className={`font-semibold text-sm tabular-nums ${c.balance > 0 ? 'text-amber-600' : 'text-gray-400'}`}>
                      {formatCurrency(c.balance)}
                    </div>
                  </div>
                  <ChevronRight size={18} className="text-gray-300 group-hover:text-forest-600 transition-colors" />
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}

      {showNew && <NewCustomerModal onClose={() => setShowNew(false)} onSaved={(id) => { setShowNew(false); navigate(`/admin/customers/${id}`) }} />}
    </AdminLayout>
  )
}

// "New Customer" modal — creates a household with an initial primary contact
// and a default service location. For the common residential case where the
// billing and service address are the same, just one address field is shown;
// a toggle exposes a separate billing address when needed.
function NewCustomerModal({ onClose, onSaved }) {
  const [displayName, setDisplayName] = useState('')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [address, setAddress] = useState('')
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function submit(e) {
    e.preventDefault()
    setSaving(true); setError('')
    const res = await adminFetch('/api/admin/customers', {
      method: 'POST',
      body: JSON.stringify({
        displayName: displayName.trim() || name.trim(),
        billingAddress: address.trim(),
        notes: notes.trim(),
        primaryContact: {
          name: name.trim(),
          email: email.trim(),
          phone: phone.trim(),
          role: 'Primary',
        },
        defaultLocation: address.trim() ? { label: 'Primary', address: address.trim() } : null,
      }),
    })
    setSaving(false)
    if (res?.success && res.customer) {
      onSaved(res.customer.id)
    } else {
      setError(res?.error || 'Failed to create customer')
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl w-full max-w-md" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-5 border-b">
          <h3 className="font-display font-bold text-lg">New Customer</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">×</button>
        </div>
        <form onSubmit={submit} className="p-5 space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Household / Account Name</label>
            <input
              value={displayName}
              onChange={e => setDisplayName(e.target.value)}
              placeholder="e.g. Jones Household, Acme Pest Solutions"
              className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:border-forest-500 outline-none"
            />
            <p className="text-[10px] text-gray-400 mt-1">Leave blank to use primary contact's name</p>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Primary Contact Name *</label>
            <input
              required
              value={name}
              onChange={e => setName(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:border-forest-500 outline-none"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Phone</label>
              <input
                value={phone}
                onChange={e => setPhone(e.target.value)}
                placeholder="405-555-1212"
                className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:border-forest-500 outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Email</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:border-forest-500 outline-none"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Service / Billing Address</label>
            <input
              value={address}
              onChange={e => setAddress(e.target.value)}
              placeholder="123 Main St, Edmond, OK"
              className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:border-forest-500 outline-none"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Notes</label>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              rows={2}
              className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:border-forest-500 outline-none resize-none"
            />
          </div>
          {error && <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded px-2 py-1.5">{error}</p>}
          <div className="flex gap-2 pt-2">
            <button type="button" onClick={onClose} className="flex-1 py-2.5 rounded-lg border border-gray-200 text-sm font-medium hover:bg-gray-50">Cancel</button>
            <button type="submit" disabled={saving} className="flex-1 btn-primary py-2.5 disabled:opacity-50">
              {saving ? 'Creating…' : 'Create Customer'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
