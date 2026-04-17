import { useState, useEffect, useCallback, Fragment } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, X, DollarSign, Clock, AlertTriangle, CreditCard, ChevronDown, ChevronRight, Trash2, Ban, CircleDollarSign, Calendar } from 'lucide-react'
import AdminLayout from '../components/AdminLayout'
import { adminFetch, getToken, formatCurrency, formatDate } from '../hooks/useAdmin'

// Phase 1.4 — Payment history panel shown when a bill row is expanded.
// Each payment has a Void (Ban) button that calls the new
// POST /api/accounting/bill-payments/:id/void endpoint, which posts a
// reversal entry to the ledger AND a negative transaction to the
// dashboard feed — nothing is silently deleted.
function BillPaymentHistory({ billId, refreshKey, onVoidComplete }) {
  const [payments, setPayments] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    adminFetch(`/api/accounting/bills/${billId}/payments`).then(res => {
      if (cancelled) return
      setPayments(res?.data || [])
      setLoading(false)
    })
    return () => { cancelled = true }
  }, [billId, refreshKey])

  const handleVoid = async (paymentId, amount) => {
    if (!confirm(`Void this $${Number(amount).toFixed(2)} payment? A reversal entry will be posted to accounting — the original won't be deleted from the audit trail.`)) return
    await adminFetch(`/api/accounting/bill-payments/${paymentId}/void`, { method: 'POST' })
    onVoidComplete()
  }

  if (loading) return <div className="px-4 py-2 text-xs text-gray-400">Loading payment history...</div>
  if (payments.length === 0) return <div className="px-4 py-2 text-xs text-gray-500 italic">No payments recorded yet</div>

  return (
    <div className="px-4 py-2">
      <div className="text-xs font-medium text-gray-600 mb-2">Payment History ({payments.length})</div>
      <div className="bg-white rounded-lg border border-gray-200 divide-y divide-gray-100">
        {payments.map(p => (
          <div key={p.id} className="flex items-center gap-3 px-3 py-2 text-sm">
            <CircleDollarSign size={14} className="text-green-600 shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="font-medium">
                {formatCurrency(Number(p.amount))}
                {p.paymentMethod && <span className="ml-2 text-xs text-gray-500 capitalize">({p.paymentMethod})</span>}
              </div>
              <div className="text-xs text-gray-400 flex items-center gap-2">
                <Calendar size={10} />{formatDate(p.paidAt)}
                {p.memo && <span className="truncate">{p.memo}</span>}
              </div>
            </div>
            <button
              onClick={() => handleVoid(p.id, p.amount)}
              className="text-red-400 hover:text-red-600 p-1"
              title="Void payment"
            >
              <Ban size={14} />
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}

const STATUS_STYLES = {
  pending: 'bg-amber-50 text-amber-700', partially_paid: 'bg-blue-50 text-blue-700',
  paid: 'bg-green-50 text-green-700', overdue: 'bg-red-50 text-red-700', void: 'bg-gray-50 text-gray-500',
}

export default function AdminBills() {
  const [bills, setBills] = useState([])
  const [vendors, setVendors] = useState([])
  const [accounts, setAccounts] = useState([])
  const [loading, setLoading] = useState(true)
  const [showNew, setShowNew] = useState(false)
  const [showPay, setShowPay] = useState(null)
  const [expandedId, setExpandedId] = useState(null)
  const [refreshKey, setRefreshKey] = useState(0)
  const [filter, setFilter] = useState('all')
  const navigate = useNavigate()

  const fetchData = useCallback(async () => {
    if (!getToken()) { navigate('/admin'); return }
    const [billsRes, vendorsRes, acctsRes] = await Promise.all([
      adminFetch('/api/accounting/bills'),
      adminFetch('/api/accounting/vendors'),
      adminFetch('/api/accounting/accounts'),
    ])
    if (billsRes?.data) setBills(billsRes.data)
    if (vendorsRes?.data) setVendors(vendorsRes.data)
    if (acctsRes?.data) setAccounts(acctsRes.data)
    setLoading(false)
  }, [navigate])

  useEffect(() => { fetchData() }, [fetchData])

  const expenseAccounts = accounts.filter(a => a.type === 'expense')
  const vendorMap = new Map(vendors.map(v => [v.id, v]))
  const unpaid = bills.filter(b => ['pending', 'partially_paid', 'overdue'].includes(b.status))
  const totalOutstanding = unpaid.reduce((s, b) => s + (b.amount - b.paidAmount), 0)
  const now = new Date()
  const overdueBills = unpaid.filter(b => new Date(b.dueDate) < now)
  const overdueTotal = overdueBills.reduce((s, b) => s + (b.amount - b.paidAmount), 0)

  const filtered = filter === 'all' ? bills : filter === 'unpaid' ? unpaid : bills.filter(b => b.status === filter)

  const handleCreate = async (data) => {
    await adminFetch('/api/accounting/bills', { method: 'POST', body: JSON.stringify(data) })
    fetchData(); setShowNew(false)
  }

  const handlePay = async (billId, amount, method, memo) => {
    await adminFetch(`/api/accounting/bills/${billId}/pay`, { method: 'POST', body: JSON.stringify({ amount, paymentMethod: method, memo }) })
    fetchData(); setShowPay(null)
  }

  return (
    <AdminLayout>
      <div className="flex items-center justify-between mb-6">
        <h2 className="font-display font-bold text-xl text-charcoal-900">Bills / Accounts Payable</h2>
        <button onClick={() => setShowNew(true)} className="btn-primary text-xs py-1.5 px-3"><Plus size={14} />New Bill</button>
      </div>

      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-white rounded-xl p-5 border border-gray-100 shadow-sm">
          <div className="flex items-center gap-2 mb-2"><DollarSign size={16} className="text-gray-400" /><span className="text-sm text-gray-500">Outstanding</span></div>
          <div className="font-display font-bold text-2xl">{formatCurrency(totalOutstanding)}</div>
          <p className="text-xs text-gray-400">{unpaid.length} unpaid bills</p>
        </div>
        <div className="bg-white rounded-xl p-5 border border-gray-100 shadow-sm">
          <div className="flex items-center gap-2 mb-2"><AlertTriangle size={16} className="text-red-400" /><span className="text-sm text-gray-500">Overdue</span></div>
          <div className="font-display font-bold text-2xl text-red-600">{formatCurrency(overdueTotal)}</div>
          <p className="text-xs text-gray-400">{overdueBills.length} overdue</p>
        </div>
        <div className="bg-white rounded-xl p-5 border border-gray-100 shadow-sm">
          <div className="flex items-center gap-2 mb-2"><Clock size={16} className="text-gray-400" /><span className="text-sm text-gray-500">Total Bills</span></div>
          <div className="font-display font-bold text-2xl">{bills.length}</div>
        </div>
      </div>

      <div className="flex gap-2 mb-4">
        {['all', 'unpaid', 'paid', 'void'].map(f => (
          <button key={f} onClick={() => setFilter(f)} className={`px-3 py-1.5 rounded-lg text-xs font-medium capitalize ${filter === f ? 'bg-forest-700 text-white' : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-100'}`}>{f}</button>
        ))}
      </div>

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-x-auto">
        {loading ? <div className="text-center py-20 text-gray-400">Loading...</div> : filtered.length === 0 ? (
          <div className="text-center py-16 text-gray-400 text-sm">No bills found</div>
        ) : (
          <table className="w-full text-sm">
            <thead><tr className="bg-gray-50 text-left text-xs text-gray-500"><th className="px-4 py-2 w-8" /><th className="px-4 py-2">Vendor</th><th className="px-4 py-2">Description</th><th className="px-4 py-2">Due Date</th><th className="px-4 py-2 text-right">Amount</th><th className="px-4 py-2 text-right">Paid</th><th className="px-4 py-2 text-right">Balance</th><th className="px-4 py-2">Status</th><th className="px-4 py-2 w-24" /></tr></thead>
            <tbody>
              {filtered.map(bill => {
                const vendor = vendorMap.get(bill.vendorId)
                const balance = bill.amount - bill.paidAmount
                const isOverdue = ['pending', 'partially_paid'].includes(bill.status) && new Date(bill.dueDate) < now
                const isExpanded = expandedId === bill.id
                return (
                  <Fragment key={bill.id}>
                    <tr className={`border-b border-gray-50 ${isOverdue ? 'bg-red-50/30' : ''}`}>
                      <td className="px-4 py-2.5"><button onClick={() => setExpandedId(isExpanded ? null : bill.id)}>{isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}</button></td>
                      <td className="px-4 py-2.5 font-medium">{vendor?.name || 'Unknown'}</td>
                      <td className="px-4 py-2.5 text-gray-500 truncate max-w-[200px]">{bill.description || '—'}</td>
                      <td className="px-4 py-2.5 tabular-nums">{formatDate(bill.dueDate)}</td>
                      <td className="px-4 py-2.5 text-right tabular-nums">{formatCurrency(bill.amount)}</td>
                      <td className="px-4 py-2.5 text-right tabular-nums text-gray-400">{formatCurrency(bill.paidAmount)}</td>
                      <td className="px-4 py-2.5 text-right tabular-nums font-semibold">{formatCurrency(balance)}</td>
                      <td className="px-4 py-2.5"><span className={`px-2 py-0.5 rounded text-[10px] font-medium ${STATUS_STYLES[isOverdue && bill.status !== 'paid' ? 'overdue' : bill.status] || ''}`}>{isOverdue && bill.status !== 'paid' ? 'Overdue' : bill.status}</span></td>
                      <td className="px-4 py-2.5">
                        {bill.status !== 'paid' && bill.status !== 'void' && (
                          <button onClick={() => { setShowPay(bill) }} className="px-2 py-1 rounded text-xs font-medium bg-forest-50 text-forest-700 hover:bg-forest-100"><CreditCard size={12} className="inline mr-1" />Pay</button>
                        )}
                      </td>
                    </tr>
                    {isExpanded && (
                      <tr className="bg-gray-50/50">
                        <td colSpan={9} className="p-0">
                          <BillPaymentHistory
                            billId={bill.id}
                            refreshKey={refreshKey}
                            onVoidComplete={() => { setRefreshKey(k => k + 1); fetchData() }}
                          />
                        </td>
                      </tr>
                    )}
                  </Fragment>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      {showNew && <NewBillDialog vendors={vendors} accounts={expenseAccounts} onClose={() => setShowNew(false)} onSave={handleCreate} />}
      {showPay && <PayBillDialog bill={showPay} onClose={() => setShowPay(null)} onPay={handlePay} />}
    </AdminLayout>
  )
}

function NewBillDialog({ vendors, accounts, onClose, onSave }) {
  const [form, setForm] = useState({ vendorId: '', amount: '', dueDate: '', description: '', reference: '', accountId: '' })
  const [saving, setSaving] = useState(false)
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))
  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl w-full max-w-md" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-5 border-b"><h3 className="font-display font-bold text-lg">New Bill</h3><button onClick={onClose}><X size={20} /></button></div>
        <form className="p-5 space-y-4" onSubmit={async e => { e.preventDefault(); setSaving(true); await onSave(form); setSaving(false) }}>
          <div><label className="block text-xs font-medium text-gray-700 mb-1">Vendor *</label><select required value={form.vendorId} onChange={e => set('vendorId', e.target.value)} className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm bg-white"><option value="">Select vendor</option>{vendors.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}</select></div>
          <div className="grid grid-cols-2 gap-4">
            <div><label className="block text-xs font-medium text-gray-700 mb-1">Amount *</label><input type="number" step="0.01" min="0.01" required value={form.amount} onChange={e => set('amount', e.target.value)} className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm" /></div>
            <div><label className="block text-xs font-medium text-gray-700 mb-1">Due Date *</label><input type="date" required value={form.dueDate} onChange={e => set('dueDate', e.target.value)} className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm" /></div>
          </div>
          <div><label className="block text-xs font-medium text-gray-700 mb-1">Category</label><select value={form.accountId} onChange={e => set('accountId', e.target.value)} className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm bg-white"><option value="">Select category</option>{accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}</select></div>
          <div><label className="block text-xs font-medium text-gray-700 mb-1">Description</label><textarea value={form.description} onChange={e => set('description', e.target.value)} rows={2} className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm resize-none" /></div>
          <div><label className="block text-xs font-medium text-gray-700 mb-1">Reference #</label><input value={form.reference} onChange={e => set('reference', e.target.value)} className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm" /></div>
          <button type="submit" disabled={saving} className="w-full btn-primary py-2.5 disabled:opacity-50">{saving ? 'Creating...' : 'Create Bill'}</button>
        </form>
      </div>
    </div>
  )
}

function PayBillDialog({ bill, onClose, onPay }) {
  const balance = bill.amount - bill.paidAmount
  const [amount, setAmount] = useState(balance.toFixed(2))
  const [method, setMethod] = useState('cash')
  const [memo, setMemo] = useState('')
  const [saving, setSaving] = useState(false)
  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl w-full max-w-sm" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-5 border-b"><h3 className="font-display font-bold text-lg">Record Payment</h3><button onClick={onClose}><X size={20} /></button></div>
        <div className="p-5 space-y-4">
          <p className="text-sm text-gray-500">Balance: {formatCurrency(balance)}</p>
          <div><label className="block text-xs font-medium text-gray-700 mb-1">Amount *</label><input type="number" step="0.01" value={amount} onChange={e => setAmount(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm" /></div>
          <div><label className="block text-xs font-medium text-gray-700 mb-1">Method</label><select value={method} onChange={e => setMethod(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm bg-white"><option value="cash">Cash / Check</option><option value="card">Credit Card</option><option value="transfer">Bank Transfer</option></select></div>
          <div><label className="block text-xs font-medium text-gray-700 mb-1">Memo</label><input value={memo} onChange={e => setMemo(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm" /></div>
          <button onClick={async () => { setSaving(true); await onPay(bill.id, parseFloat(amount), method, memo); setSaving(false) }} disabled={saving} className="w-full btn-primary py-2.5 disabled:opacity-50">{saving ? 'Recording...' : 'Record Payment'}</button>
        </div>
      </div>
    </div>
  )
}
