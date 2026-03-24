import { useState, useEffect, useMemo, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, X, Ban, Pencil, Receipt, DollarSign, TrendingUp, Calendar } from 'lucide-react'
import AdminLayout from '../components/AdminLayout'
import { adminFetch, getToken, formatCurrency, formatDate } from '../hooks/useAdmin'

const PAYMENT_METHODS = ['cash', 'check', 'card', 'transfer', 'other']
const FUNDING_SOURCES = [
  { value: 'business_checking', label: 'Business Checking' },
  { value: 'personal', label: 'Personal Account' },
  { value: 'business_credit_card', label: 'Business Credit Card' },
]

export default function AdminExpenses() {
  const [expenses, setExpenses] = useState([])
  const [accounts, setAccounts] = useState([])
  const [vendors, setVendors] = useState([])
  const [loading, setLoading] = useState(true)
  const [showNew, setShowNew] = useState(false)
  const [showVendorDialog, setShowVendorDialog] = useState(false)
  const [filterAcct, setFilterAcct] = useState('')
  const [filterVendor, setFilterVendor] = useState('')
  const navigate = useNavigate()

  const fetchData = useCallback(async () => {
    if (!getToken()) { navigate('/admin'); return }
    const [expRes, acctRes, vendRes] = await Promise.all([
      adminFetch('/api/accounting/expenses'),
      adminFetch('/api/accounting/accounts'),
      adminFetch('/api/accounting/vendors'),
    ])
    if (expRes?.data) setExpenses(expRes.data)
    if (acctRes?.data) setAccounts(acctRes.data)
    if (vendRes?.data) setVendors(vendRes.data)
    setLoading(false)
  }, [navigate])

  useEffect(() => { fetchData() }, [fetchData])

  const expenseAccounts = accounts.filter(a => a.type === 'expense' && a.isActive)
  const accountMap = useMemo(() => new Map(accounts.map(a => [a.id, a])), [accounts])
  const vendorMap = useMemo(() => new Map(vendors.map(v => [v.id, v])), [vendors])

  const now = new Date()
  const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`
  const yearStart = `${now.getFullYear()}-01-01`

  const totalMonth = expenses.filter(e => e.date >= monthStart).reduce((s, e) => s + e.amount, 0)
  const totalYTD = expenses.filter(e => e.date >= yearStart).reduce((s, e) => s + e.amount, 0)

  const filtered = expenses.filter(e => {
    if (filterAcct && e.accountId !== filterAcct) return false
    if (filterVendor && e.vendorId !== filterVendor) return false
    return true
  })

  const handleVoid = async (id) => {
    if (!confirm('Void this expense? A reversing journal entry will be created.')) return
    await adminFetch(`/api/accounting/expenses/${id}/void`, { method: 'POST' })
    fetchData()
  }

  const handleCreateExpense = async (data) => {
    await adminFetch('/api/accounting/expenses', { method: 'POST', body: JSON.stringify(data) })
    fetchData(); setShowNew(false)
  }

  const handleCreateVendor = async (data) => {
    await adminFetch('/api/accounting/vendors', { method: 'POST', body: JSON.stringify(data) })
    fetchData(); setShowVendorDialog(false)
  }

  return (
    <AdminLayout>
      <div className="flex items-center justify-between gap-4 mb-6 flex-wrap">
        <h2 className="font-display font-bold text-xl text-charcoal-900">Expenses</h2>
        <div className="flex gap-2">
          <button onClick={() => setShowVendorDialog(true)} className="px-3 py-1.5 rounded-lg text-xs font-medium bg-white border border-gray-200 hover:bg-gray-100 inline-flex items-center gap-1"><Plus size={14} />Vendor</button>
          <button onClick={() => setShowNew(true)} className="btn-primary text-xs py-1.5 px-3"><Plus size={14} />Add Expense</button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-white rounded-xl p-5 border border-gray-100 shadow-sm">
          <div className="flex items-center gap-2 mb-2"><Calendar size={16} className="text-gray-400" /><span className="text-sm text-gray-500">This Month</span></div>
          <div className="font-display font-bold text-2xl">{formatCurrency(totalMonth)}</div>
        </div>
        <div className="bg-white rounded-xl p-5 border border-gray-100 shadow-sm">
          <div className="flex items-center gap-2 mb-2"><TrendingUp size={16} className="text-gray-400" /><span className="text-sm text-gray-500">Year to Date</span></div>
          <div className="font-display font-bold text-2xl">{formatCurrency(totalYTD)}</div>
        </div>
        <div className="bg-white rounded-xl p-5 border border-gray-100 shadow-sm">
          <div className="flex items-center gap-2 mb-2"><Receipt size={16} className="text-gray-400" /><span className="text-sm text-gray-500">Total Entries</span></div>
          <div className="font-display font-bold text-2xl">{expenses.length}</div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-3 mb-4 flex-wrap">
        <select value={filterAcct} onChange={e => setFilterAcct(e.target.value)} className="px-3 py-1.5 rounded-lg border border-gray-200 text-xs bg-white">
          <option value="">All Categories</option>
          {expenseAccounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
        </select>
        <select value={filterVendor} onChange={e => setFilterVendor(e.target.value)} className="px-3 py-1.5 rounded-lg border border-gray-200 text-xs bg-white">
          <option value="">All Vendors</option>
          {vendors.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
        </select>
        {(filterAcct || filterVendor) && <button onClick={() => { setFilterAcct(''); setFilterVendor('') }} className="text-xs text-gray-500 hover:text-gray-700">Clear</button>}
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-x-auto">
        {loading ? <div className="text-center py-20 text-gray-400">Loading...</div> : filtered.length === 0 ? (
          <div className="text-center py-16"><Receipt size={40} className="text-gray-200 mx-auto mb-3" /><p className="text-gray-400 text-sm">No expenses found</p></div>
        ) : (
          <table className="w-full text-sm">
            <thead><tr className="bg-gray-50 text-left text-xs text-gray-500"><th className="px-4 py-2">Date</th><th className="px-4 py-2">Vendor</th><th className="px-4 py-2">Category</th><th className="px-4 py-2">Description</th><th className="px-4 py-2 text-right">Amount</th><th className="px-4 py-2">Paid From</th><th className="px-4 py-2 w-10" /></tr></thead>
            <tbody>
              {filtered.map(exp => (
                <tr key={exp.id} className="border-b border-gray-50 hover:bg-gray-50">
                  <td className="px-4 py-2.5 tabular-nums whitespace-nowrap">{formatDate(exp.date)}</td>
                  <td className="px-4 py-2.5">{vendorMap.get(exp.vendorId)?.name || '—'}</td>
                  <td className="px-4 py-2.5"><span className="px-2 py-0.5 rounded text-[10px] font-medium bg-gray-100 text-gray-700">{accountMap.get(exp.accountId)?.name || 'Unknown'}</span></td>
                  <td className="px-4 py-2.5 truncate max-w-[200px]">{exp.description}</td>
                  <td className="px-4 py-2.5 text-right font-medium tabular-nums">{formatCurrency(exp.amount)}</td>
                  <td className="px-4 py-2.5 text-gray-500 text-xs capitalize">{FUNDING_SOURCES.find(f => f.value === exp.fundingSource)?.label || exp.fundingSource || '—'}</td>
                  <td className="px-4 py-2.5"><button onClick={() => handleVoid(exp.id)} className="text-gray-300 hover:text-red-500" title="Void"><Ban size={14} /></button></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Vendor list */}
      {vendors.length > 0 && (
        <div className="mt-6 bg-white rounded-xl border border-gray-100 shadow-sm p-5">
          <h3 className="font-display font-bold text-base mb-3">Vendors ({vendors.length})</h3>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {vendors.map(v => (
              <div key={v.id} className="border border-gray-100 rounded-lg p-3 text-sm">
                <div className="font-medium">{v.name} {v.is1099 && <span className="text-[10px] bg-violet-50 text-violet-700 px-1.5 py-0.5 rounded ml-1">1099</span>}</div>
                {v.email && <div className="text-xs text-gray-500">{v.email}</div>}
                {v.phone && <div className="text-xs text-gray-500">{v.phone}</div>}
              </div>
            ))}
          </div>
        </div>
      )}

      {showNew && <NewExpenseDialog accounts={expenseAccounts} vendors={vendors} onClose={() => setShowNew(false)} onSave={handleCreateExpense} />}
      {showVendorDialog && <NewVendorDialog onClose={() => setShowVendorDialog(false)} onSave={handleCreateVendor} />}
    </AdminLayout>
  )
}

function NewExpenseDialog({ accounts, vendors, onClose, onSave }) {
  const [form, setForm] = useState({ vendorId: '', accountId: '', description: '', amount: '', date: new Date().toISOString().slice(0, 10), paymentMethod: 'card', fundingSource: 'business_checking', receiptNotes: '', isBillable: false, taxDeductible: true })
  const [saving, setSaving] = useState(false)
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-5 border-b"><h3 className="font-display font-bold text-lg">Add Expense</h3><button onClick={onClose}><X size={20} /></button></div>
        <form className="p-5 space-y-4" onSubmit={async e => { e.preventDefault(); setSaving(true); await onSave(form); setSaving(false) }}>
          <div className="grid grid-cols-2 gap-4">
            <div><label className="block text-xs font-medium text-gray-700 mb-1">Vendor</label>
              <select value={form.vendorId} onChange={e => set('vendorId', e.target.value)} className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm bg-white"><option value="">Select vendor</option>{vendors.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}</select>
            </div>
            <div><label className="block text-xs font-medium text-gray-700 mb-1">Category *</label>
              <select required value={form.accountId} onChange={e => set('accountId', e.target.value)} className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm bg-white"><option value="">Select category</option>{accounts.map(a => <option key={a.id} value={a.id}>{a.code} — {a.name}</option>)}</select>
            </div>
          </div>
          <div><label className="block text-xs font-medium text-gray-700 mb-1">Description *</label><input required value={form.description} onChange={e => set('description', e.target.value)} placeholder="What was this expense for?" className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm" /></div>
          <div className="grid grid-cols-2 gap-4">
            <div><label className="block text-xs font-medium text-gray-700 mb-1">Amount *</label><input type="number" step="0.01" min="0.01" required value={form.amount} onChange={e => set('amount', e.target.value)} placeholder="0.00" className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm" /></div>
            <div><label className="block text-xs font-medium text-gray-700 mb-1">Date *</label><input type="date" required value={form.date} onChange={e => set('date', e.target.value)} className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm" /></div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div><label className="block text-xs font-medium text-gray-700 mb-1">Paid From</label>
              <select value={form.fundingSource} onChange={e => set('fundingSource', e.target.value)} className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm bg-white">{FUNDING_SOURCES.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}</select>
            </div>
            <div><label className="block text-xs font-medium text-gray-700 mb-1">Payment Method</label>
              <select value={form.paymentMethod} onChange={e => set('paymentMethod', e.target.value)} className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm bg-white capitalize">{PAYMENT_METHODS.map(m => <option key={m} value={m}>{m}</option>)}</select>
            </div>
          </div>
          {form.fundingSource === 'personal' && <p className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded px-3 py-1.5">This will be recorded as an owner contribution to the business.</p>}
          <div><label className="block text-xs font-medium text-gray-700 mb-1">Receipt Notes</label><input value={form.receiptNotes} onChange={e => set('receiptNotes', e.target.value)} placeholder="Optional" className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm" /></div>
          <div className="flex gap-6">
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.taxDeductible} onChange={e => set('taxDeductible', e.target.checked)} className="rounded" /> Tax Deductible</label>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.isBillable} onChange={e => set('isBillable', e.target.checked)} className="rounded" /> Billable</label>
          </div>
          <button type="submit" disabled={saving} className="w-full btn-primary py-2.5 disabled:opacity-50">{saving ? 'Saving...' : 'Save Expense'}</button>
        </form>
      </div>
    </div>
  )
}

function NewVendorDialog({ onClose, onSave }) {
  const [form, setForm] = useState({ name: '', email: '', phone: '', address: '', taxId: '', is1099: false })
  const [saving, setSaving] = useState(false)
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl w-full max-w-md" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-5 border-b"><h3 className="font-display font-bold text-lg">Add Vendor</h3><button onClick={onClose}><X size={20} /></button></div>
        <form className="p-5 space-y-4" onSubmit={async e => { e.preventDefault(); setSaving(true); await onSave(form); setSaving(false) }}>
          <div><label className="block text-xs font-medium text-gray-700 mb-1">Name *</label><input required value={form.name} onChange={e => set('name', e.target.value)} className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm" /></div>
          <div className="grid grid-cols-2 gap-4">
            <div><label className="block text-xs font-medium text-gray-700 mb-1">Email</label><input value={form.email} onChange={e => set('email', e.target.value)} className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm" /></div>
            <div><label className="block text-xs font-medium text-gray-700 mb-1">Phone</label><input value={form.phone} onChange={e => set('phone', e.target.value)} className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm" /></div>
          </div>
          <div><label className="block text-xs font-medium text-gray-700 mb-1">Address</label><input value={form.address} onChange={e => set('address', e.target.value)} className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm" /></div>
          <div><label className="block text-xs font-medium text-gray-700 mb-1">Tax ID (EIN/SSN)</label><input value={form.taxId} onChange={e => set('taxId', e.target.value)} placeholder="XX-XXXXXXX" className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm" /></div>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.is1099} onChange={e => set('is1099', e.target.checked)} className="rounded" /> 1099 Contractor</label>
          <button type="submit" disabled={saving} className="w-full btn-primary py-2.5 disabled:opacity-50">{saving ? 'Creating...' : 'Create Vendor'}</button>
        </form>
      </div>
    </div>
  )
}
