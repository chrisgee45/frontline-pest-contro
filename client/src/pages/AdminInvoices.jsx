import { useState, useEffect, useCallback, useRef } from 'react'
import { useNavigate, useLocation, useSearchParams, Link } from 'react-router-dom'
import { Plus, X, ChevronDown, ChevronUp, Trash2, Send, CheckCircle, DollarSign, FileText, Printer, Briefcase } from 'lucide-react'
import AdminLayout from '../components/AdminLayout'
import { adminFetch, getToken, formatCurrency, formatDate } from '../hooks/useAdmin'

const STATUS_MAP = {
  draft: { label: 'Draft', color: 'bg-gray-100 text-gray-700' },
  sent: { label: 'Sent', color: 'bg-blue-100 text-blue-800' },
  paid: { label: 'Paid', color: 'bg-green-100 text-green-800' },
  overdue: { label: 'Overdue', color: 'bg-red-100 text-red-800' },
}

function InvoiceRow({ inv, expanded, onToggle, onUpdate, onDelete, cardRef, highlight }) {
  const s = STATUS_MAP[inv.status] || STATUS_MAP.draft

  return (
    <div
      ref={cardRef}
      className={`bg-white rounded-xl border shadow-sm overflow-hidden transition-all ${highlight ? 'border-forest-500 ring-2 ring-forest-200' : 'border-gray-100'}`}
    >
      <div className="flex items-center justify-between p-4 cursor-pointer hover:bg-gray-50" onClick={onToggle}>
        <div className="flex items-center gap-4 min-w-0">
          <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${s.color}`}>{s.label}</span>
          <div className="min-w-0">
            <div className="font-semibold text-charcoal-900">{inv.invoiceNumber}</div>
            <div className="text-sm text-gray-500">{inv.customerName}</div>
          </div>
        </div>
        <div className="flex items-center gap-4 shrink-0">
          <div className="text-right hidden sm:block">
            <div className="font-display font-bold text-charcoal-900">{formatCurrency(inv.total)}</div>
            <div className="text-xs text-gray-400">{formatDate(inv.createdAt)}</div>
          </div>
          {expanded ? <ChevronUp size={18} className="text-gray-400" /> : <ChevronDown size={18} className="text-gray-400" />}
        </div>
      </div>
      {expanded && (
        <div className="border-t border-gray-100 p-4 bg-gray-50 space-y-4">
          {inv.jobId && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-blue-50 border border-blue-200">
              <Briefcase size={14} className="text-blue-700" />
              <span className="text-xs text-blue-900">This invoice was generated from a job.</span>
              <Link
                to={`/admin/jobs?focus=${inv.jobId}`}
                className="ml-auto text-xs font-semibold text-blue-700 hover:text-blue-900 underline"
              >
                View Job →
              </Link>
            </div>
          )}
          <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead><tr className="bg-gray-50 text-left"><th className="px-3 py-2 text-xs font-medium text-gray-500">Item</th><th className="px-3 py-2 text-xs font-medium text-gray-500 text-right">Qty</th><th className="px-3 py-2 text-xs font-medium text-gray-500 text-right">Rate</th><th className="px-3 py-2 text-xs font-medium text-gray-500 text-right">Amount</th></tr></thead>
              <tbody>
                {inv.items.map((item, i) => (
                  <tr key={i} className="border-t border-gray-100"><td className="px-3 py-2">{item.description}</td><td className="px-3 py-2 text-right">{item.quantity}</td><td className="px-3 py-2 text-right">{formatCurrency(item.rate)}</td><td className="px-3 py-2 text-right font-medium">{formatCurrency(item.quantity * item.rate)}</td></tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t border-gray-200"><td colSpan="3" className="px-3 py-1.5 text-right text-xs text-gray-500">Subtotal</td><td className="px-3 py-1.5 text-right text-sm">{formatCurrency(inv.subtotal)}</td></tr>
                <tr><td colSpan="3" className="px-3 py-1.5 text-right text-xs text-gray-500">Tax (8.5%)</td><td className="px-3 py-1.5 text-right text-sm">{formatCurrency(inv.tax)}</td></tr>
                <tr className="border-t border-gray-200"><td colSpan="3" className="px-3 py-2 text-right font-semibold">Total</td><td className="px-3 py-2 text-right font-display font-bold text-lg">{formatCurrency(inv.total)}</td></tr>
              </tfoot>
            </table>
          </div>
          {inv.notes && <p className="text-sm text-gray-600">{inv.notes}</p>}
          {inv.dueDate && <p className="text-xs text-gray-500">Due: {formatDate(inv.dueDate)}</p>}
          {inv.paidAt && <p className="text-xs text-green-600 font-medium">Paid on {formatDate(inv.paidAt)}</p>}
          <div className="flex flex-wrap gap-2 pt-2">
            {inv.status === 'draft' && <button onClick={() => onUpdate(inv.id, 'sent')} className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white text-xs font-medium rounded-lg hover:bg-blue-700"><Send size={12} />Mark as Sent</button>}
            {(inv.status === 'sent' || inv.status === 'overdue') && <button onClick={() => onUpdate(inv.id, 'paid')} className="flex items-center gap-1.5 px-3 py-1.5 bg-green-600 text-white text-xs font-medium rounded-lg hover:bg-green-700"><CheckCircle size={12} />Mark as Paid</button>}
            {inv.status === 'sent' && <button onClick={() => onUpdate(inv.id, 'overdue')} className="flex items-center gap-1.5 px-3 py-1.5 bg-red-100 text-red-700 text-xs font-medium rounded-lg hover:bg-red-200">Mark Overdue</button>}
            <button onClick={() => { if (confirm('Delete this invoice?')) onDelete(inv.id) }} className="flex items-center gap-1.5 px-3 py-1.5 text-red-600 text-xs font-medium hover:bg-red-50 rounded-lg"><Trash2 size={12} />Delete</button>
          </div>
        </div>
      )}
    </div>
  )
}

function NewInvoiceModal({ onClose, onSave, prefill }) {
  const [form, setForm] = useState({
    customerName: prefill?.customerName || '', customerEmail: prefill?.email || '', customerAddress: prefill?.address || '',
    jobId: prefill?.id || '', dueDate: '', notes: '',
  })
  const [items, setItems] = useState([{ description: prefill?.serviceType || '', quantity: 1, rate: 0 }])
  const [saving, setSaving] = useState(false)

  const addItem = () => setItems([...items, { description: '', quantity: 1, rate: 0 }])
  const removeItem = (i) => setItems(items.filter((_, j) => j !== i))
  const updateItem = (i, field, value) => { const next = [...items]; next[i][field] = field === 'description' ? value : parseFloat(value) || 0; setItems(next) }

  const subtotal = items.reduce((s, item) => s + item.quantity * item.rate, 0)
  const tax = Math.round(subtotal * 0.085 * 100) / 100
  const total = subtotal + tax

  const handleSubmit = async (e) => {
    e.preventDefault(); setSaving(true)
    await onSave({ ...form, items }); setSaving(false); onClose()
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-5 border-b"><h3 className="font-display font-bold text-lg">New Invoice</h3><button onClick={onClose}><X size={20} /></button></div>
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div><label className="block text-xs font-medium text-gray-700 mb-1">Customer Name *</label><input required value={form.customerName} onChange={e => setForm({...form, customerName: e.target.value})} className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:border-forest-500 outline-none" /></div>
            <div><label className="block text-xs font-medium text-gray-700 mb-1">Due Date</label><input type="date" value={form.dueDate} onChange={e => setForm({...form, dueDate: e.target.value})} className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:border-forest-500 outline-none" /></div>
          </div>
          <div><label className="block text-xs font-medium text-gray-700 mb-1">Customer Address</label><input value={form.customerAddress} onChange={e => setForm({...form, customerAddress: e.target.value})} className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:border-forest-500 outline-none" /></div>

          <div>
            <div className="flex items-center justify-between mb-2"><label className="text-xs font-medium text-gray-700">Line Items</label><button type="button" onClick={addItem} className="text-xs text-forest-700 font-medium hover:underline">+ Add Item</button></div>
            <div className="space-y-2">
              {items.map((item, i) => (
                <div key={i} className="flex gap-2 items-center">
                  <input placeholder="Description" value={item.description} onChange={e => updateItem(i, 'description', e.target.value)} className="flex-1 px-3 py-2 rounded-lg border border-gray-200 text-sm focus:border-forest-500 outline-none" />
                  <input type="number" placeholder="Qty" value={item.quantity} onChange={e => updateItem(i, 'quantity', e.target.value)} className="w-16 px-2 py-2 rounded-lg border border-gray-200 text-sm text-center focus:border-forest-500 outline-none" />
                  <input type="number" step="0.01" placeholder="Rate" value={item.rate} onChange={e => updateItem(i, 'rate', e.target.value)} className="w-24 px-2 py-2 rounded-lg border border-gray-200 text-sm text-right focus:border-forest-500 outline-none" />
                  <span className="w-20 text-sm text-right font-medium">{formatCurrency(item.quantity * item.rate)}</span>
                  {items.length > 1 && <button type="button" onClick={() => removeItem(i)} className="text-red-400 hover:text-red-600"><X size={16} /></button>}
                </div>
              ))}
            </div>
          </div>

          <div className="bg-gray-50 rounded-lg p-3 text-sm space-y-1">
            <div className="flex justify-between"><span className="text-gray-500">Subtotal</span><span>{formatCurrency(subtotal)}</span></div>
            <div className="flex justify-between"><span className="text-gray-500">Tax (8.5%)</span><span>{formatCurrency(tax)}</span></div>
            <div className="flex justify-between font-display font-bold text-lg border-t border-gray-200 pt-2 mt-2"><span>Total</span><span>{formatCurrency(total)}</span></div>
          </div>

          <div><label className="block text-xs font-medium text-gray-700 mb-1">Notes</label><textarea value={form.notes} onChange={e => setForm({...form, notes: e.target.value})} rows={2} className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:border-forest-500 outline-none resize-none" /></div>
          <button type="submit" disabled={saving || items.every(i => !i.description)} className="w-full btn-primary py-2.5 disabled:opacity-50">{saving ? 'Creating...' : 'Create Invoice'}</button>
        </form>
      </div>
    </div>
  )
}

export default function AdminInvoices() {
  const [invoices, setInvoices] = useState([])
  const [showNew, setShowNew] = useState(false)
  const [filter, setFilter] = useState('all')
  const [loading, setLoading] = useState(true)
  const [prefill, setPrefill] = useState(null)
  const [expandedId, setExpandedId] = useState(null)
  const [highlightedId, setHighlightedId] = useState(null)
  const navigate = useNavigate()
  const location = useLocation()
  const [searchParams, setSearchParams] = useSearchParams()
  const focusId = searchParams.get('focus')
  const focusedRef = useRef(null)

  const fetchInvoices = useCallback(async () => {
    if (!getToken()) { navigate('/admin'); return }
    const data = await adminFetch('/api/admin/invoices')
    if (data) setInvoices(data.invoices || [])
    setLoading(false)
  }, [navigate])

  useEffect(() => { fetchInvoices() }, [fetchInvoices])

  useEffect(() => {
    if (location.state?.fromJob) { setPrefill(location.state.fromJob); setShowNew(true); window.history.replaceState({}, '') }
  }, [location.state])

  // When navigated here with ?focus=<invoiceId>, auto-expand the matching
  // invoice, scroll it into view, force-clear any filter that might be
  // hiding it, then clean the URL so a refresh doesn't re-trigger the
  // scroll. Same pattern used by AdminLeads and AdminJobs for 1.6.
  useEffect(() => {
    if (!focusId || invoices.length === 0) return
    const inv = invoices.find(i => i.id === focusId)
    if (!inv) return
    setExpandedId(focusId)
    setHighlightedId(focusId)
    if (filter !== 'all' && inv.status !== filter) setFilter('all')
    setTimeout(() => {
      focusedRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }, 50)
    setSearchParams({}, { replace: true })
  }, [focusId, invoices, filter, setSearchParams])

  // Fade the highlight ring 2.5s after it's set. Separate effect keyed on
  // highlightedId so setSearchParams doesn't tear down the fade timer
  // (same bug fix as Commit D-fix, same pattern).
  useEffect(() => {
    if (!highlightedId) return
    const timer = setTimeout(() => setHighlightedId(null), 2500)
    return () => clearTimeout(timer)
  }, [highlightedId])

  const createInvoice = async (form) => {
    if (form.jobId) {
      await adminFetch(`/api/admin/jobs/${form.jobId}/invoice`, { method: 'POST', body: JSON.stringify(form) })
    } else {
      await adminFetch('/api/admin/invoices', { method: 'POST', body: JSON.stringify(form) })
    }
    fetchInvoices()
  }

  const updateStatus = async (id, status) => { await adminFetch(`/api/admin/invoices/${id}`, { method: 'PATCH', body: JSON.stringify({ status }) }); fetchInvoices() }
  const deleteInvoice = async (id) => { await adminFetch(`/api/admin/invoices/${id}`, { method: 'DELETE' }); fetchInvoices() }

  const filtered = filter === 'all' ? invoices : invoices.filter(i => i.status === filter)
  const totalOutstanding = invoices.filter(i => i.status === 'sent' || i.status === 'overdue').reduce((s, i) => s + i.total, 0)
  const totalPaid = invoices.filter(i => i.status === 'paid').reduce((s, i) => s + i.total, 0)

  return (
    <AdminLayout>
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm text-center"><div className="font-display font-bold text-xl text-charcoal-900">{invoices.length}</div><div className="text-xs text-gray-500">Total Invoices</div></div>
        <div className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm text-center"><div className="font-display font-bold text-xl text-amber-600">{formatCurrency(totalOutstanding)}</div><div className="text-xs text-gray-500">Outstanding</div></div>
        <div className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm text-center"><div className="font-display font-bold text-xl text-green-600">{formatCurrency(totalPaid)}</div><div className="text-xs text-gray-500">Collected</div></div>
      </div>

      <div className="flex justify-between items-center mb-4 flex-wrap gap-2">
        <div className="flex gap-2">
          {['all', 'draft', 'sent', 'paid', 'overdue'].map(f => (
            <button key={f} onClick={() => setFilter(f)} className={`px-3 py-1.5 rounded-lg text-xs font-medium capitalize ${filter === f ? 'bg-forest-700 text-white' : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-100'}`}>{f}</button>
          ))}
        </div>
        <button onClick={() => { setPrefill(null); setShowNew(true) }} className="btn-primary text-sm py-2 px-4"><Plus size={16} />New Invoice</button>
      </div>

      {loading ? <div className="text-center py-20 text-gray-500">Loading...</div> : (
        <div className="space-y-3">
          {filtered.length === 0 ? (
            <div className="text-center py-16 bg-white rounded-xl border border-gray-100"><p className="text-gray-500">No invoices</p></div>
          ) : filtered.map(inv => (
            <InvoiceRow
              key={inv.id}
              inv={inv}
              expanded={expandedId === inv.id}
              onToggle={() => setExpandedId(expandedId === inv.id ? null : inv.id)}
              onUpdate={updateStatus}
              onDelete={deleteInvoice}
              cardRef={inv.id === focusId ? focusedRef : undefined}
              highlight={inv.id === highlightedId}
            />
          ))}
        </div>
      )}

      {showNew && <NewInvoiceModal onClose={() => { setShowNew(false); setPrefill(null) }} onSave={createInvoice} prefill={prefill} />}
    </AdminLayout>
  )
}
