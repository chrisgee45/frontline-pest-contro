import { useState, useEffect, useCallback, useRef } from 'react'
import { useNavigate, useLocation, useSearchParams, Link } from 'react-router-dom'
import { Plus, X, ChevronDown, ChevronUp, Trash2, Send, DollarSign, Briefcase, CircleDollarSign, Ban, Calendar, Mail, RefreshCw, UserSquare, Pencil, Link2, Copy, CheckCircle2 } from 'lucide-react'
import AdminLayout from '../components/AdminLayout'
import LineItemsEditor from '../components/LineItemsEditor'
import { adminFetch, getToken, formatCurrency, formatDate } from '../hooks/useAdmin'

// Status map keyed on the server's effectiveStatus. 'partial' is new in
// Phase 1.3 — an invoice has received some payments but not the full
// balance yet.
const STATUS_MAP = {
  draft: { label: 'Draft', color: 'bg-gray-100 text-gray-700' },
  sent: { label: 'Sent', color: 'bg-blue-100 text-blue-800' },
  partial: { label: 'Partial', color: 'bg-amber-100 text-amber-800' },
  paid: { label: 'Paid', color: 'bg-green-100 text-green-800' },
  overdue: { label: 'Overdue', color: 'bg-red-100 text-red-800' },
}

const PAYMENT_METHODS = [
  { value: 'cash', label: 'Cash' },
  { value: 'check', label: 'Check' },
  { value: 'card', label: 'Card' },
  { value: 'ach', label: 'ACH / Bank Transfer' },
  { value: 'other', label: 'Other' },
]

// Small modal to record a payment against an invoice. Defaults amount to
// the current remaining balance so the common case (paying in full) is
// one-click.
function RecordPaymentModal({ invoice, onClose, onSaved }) {
  const today = new Date().toISOString().slice(0, 10)
  const [amount, setAmount] = useState(String(invoice.balance ?? invoice.total ?? 0))
  const [paymentMethod, setPaymentMethod] = useState('cash')
  const [paymentDate, setPaymentDate] = useState(today)
  const [referenceNumber, setReferenceNumber] = useState('')
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSaving(true)
    setError('')
    const parsed = parseFloat(amount)
    if (!parsed || parsed <= 0) {
      setError('Amount must be a positive number')
      setSaving(false)
      return
    }
    const res = await adminFetch(`/api/admin/invoices/${invoice.id}/payments`, {
      method: 'POST',
      body: JSON.stringify({
        amount: parsed,
        paymentMethod,
        paymentDate,
        referenceNumber: referenceNumber.trim(),
        notes: notes.trim(),
      }),
    })
    setSaving(false)
    if (res && res.success) {
      onSaved(res.invoice)
      onClose()
    } else {
      setError((res && res.error) || 'Failed to record payment')
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl w-full max-w-md" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-5 border-b">
          <div>
            <h3 className="font-display font-bold text-lg">Record Payment</h3>
            <p className="text-xs text-gray-500 mt-0.5">{invoice.invoiceNumber} — {invoice.customerName}</p>
          </div>
          <button onClick={onClose}><X size={20} /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div className="bg-gray-50 rounded-lg p-3 text-sm space-y-1">
            <div className="flex justify-between"><span className="text-gray-500">Total</span><span>{formatCurrency(invoice.total)}</span></div>
            <div className="flex justify-between"><span className="text-gray-500">Already Paid</span><span>{formatCurrency(invoice.paidAmount || 0)}</span></div>
            <div className="flex justify-between font-semibold border-t border-gray-200 pt-1 mt-1"><span>Remaining</span><span>{formatCurrency(invoice.balance ?? invoice.total)}</span></div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Amount *</label>
            <input
              type="number"
              step="0.01"
              min="0.01"
              required
              value={amount}
              onChange={e => setAmount(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:border-forest-500 outline-none"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Method</label>
              <select
                value={paymentMethod}
                onChange={e => setPaymentMethod(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm bg-white focus:border-forest-500 outline-none"
              >
                {PAYMENT_METHODS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Date</label>
              <input
                type="date"
                value={paymentDate}
                onChange={e => setPaymentDate(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:border-forest-500 outline-none"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Reference / Check #</label>
            <input
              value={referenceNumber}
              onChange={e => setReferenceNumber(e.target.value)}
              placeholder="Optional"
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
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 rounded-lg border border-gray-200 text-sm font-medium hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 btn-primary py-2.5 disabled:opacity-50"
            >
              {saving ? 'Recording...' : 'Record Payment'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// Renders the payment history list + void-payment affordance, including
// a small running "remaining balance" summary.
function PaymentHistory({ invoice, onVoidPayment }) {
  const payments = invoice.payments || []

  if (payments.length === 0) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 px-3 py-2 text-xs text-gray-500 text-center">
        No payments recorded yet
      </div>
    )
  }

  return (
    <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
      <div className="px-3 py-2 bg-gray-50 border-b border-gray-200 text-xs font-medium text-gray-600">
        Payment History ({payments.length})
      </div>
      <div className="divide-y divide-gray-100">
        {payments.map(p => (
          <div key={p.id} className="flex items-center gap-3 px-3 py-2 text-sm">
            <CircleDollarSign size={14} className="text-green-600 shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="font-medium">{formatCurrency(Number(p.amount))}
                <span className="ml-2 text-xs text-gray-500 capitalize">({p.paymentMethod})</span>
              </div>
              <div className="text-xs text-gray-400 flex items-center gap-2">
                <Calendar size={10} />{formatDate(p.paymentDate)}
                {p.referenceNumber && <span className="truncate">Ref: {p.referenceNumber}</span>}
              </div>
              {p.notes && <div className="text-xs text-gray-500 mt-0.5">{p.notes}</div>}
            </div>
            <button
              onClick={() => {
                if (confirm(`Void this $${Number(p.amount).toFixed(2)} payment? A reversal entry will be posted to accounting — the original won't be deleted from the audit trail.`)) {
                  onVoidPayment(p.id)
                }
              }}
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

function InvoiceRow({ inv, expanded, onToggle, onSend, onEdit, onDelete, onOpenPaymentModal, onVoidPayment, onCopyPayLink, onSendPayLink, payLinkCopied, stripeEnabled, cardRef, highlight }) {
  // Display everything from the server-enriched effectiveStatus, paidAmount
  // and balance — these are computed on read so partial/paid/overdue always
  // reflect the actual payment state.
  const effective = inv.effectiveStatus || inv.status || 'draft'
  const s = STATUS_MAP[effective] || STATUS_MAP.draft
  const isDraft = inv.baseStatus === 'draft'
  const hasEmail = !!(inv.customerEmail && inv.customerEmail.trim())
  const canRecordPayment = (inv.balance ?? inv.total) > 0.005 && effective !== 'draft'

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
            {inv.balance > 0.005 && effective !== 'draft' && (
              <div className="text-xs text-amber-600 font-medium">{formatCurrency(inv.balance)} remaining</div>
            )}
            <div className="text-xs text-gray-400">{formatDate(inv.createdAt)}</div>
          </div>
          {expanded ? <ChevronUp size={18} className="text-gray-400" /> : <ChevronDown size={18} className="text-gray-400" />}
        </div>
      </div>
      {expanded && (
        <div className="border-t border-gray-100 p-4 bg-gray-50 space-y-4">
          {inv.customerId && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-gray-50 border border-gray-200">
              <UserSquare size={14} className="text-gray-600" />
              <span className="text-xs text-gray-700">Customer record</span>
              <Link
                to={`/admin/customers/${inv.customerId}`}
                className="ml-auto text-xs font-semibold text-forest-700 hover:text-forest-900 underline"
              >
                View Customer →
              </Link>
            </div>
          )}
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
              <thead>
                <tr className="bg-gray-50 text-left">
                  <th className="px-3 py-2 text-xs font-medium text-gray-500">Item</th>
                  <th className="px-3 py-2 text-xs font-medium text-gray-500 text-right">Qty</th>
                  <th className="px-3 py-2 text-xs font-medium text-gray-500 text-right">Rate</th>
                  <th className="px-3 py-2 text-xs font-medium text-gray-500 text-right">Amount</th>
                </tr>
              </thead>
              <tbody>
                {inv.items.map((item, i) => (
                  <tr key={i} className="border-t border-gray-100">
                    <td className="px-3 py-2">{item.description}</td>
                    <td className="px-3 py-2 text-right">{item.quantity}</td>
                    <td className="px-3 py-2 text-right">{formatCurrency(item.rate)}</td>
                    <td className="px-3 py-2 text-right font-medium">{formatCurrency(item.quantity * item.rate)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                {/* Only show a separate Subtotal/Tax row pair if the
                    invoice actually has tax. Tax-exempt invoices skip
                    straight to Total to keep the summary uncluttered. */}
                {Number(inv.tax) > 0.005 && (
                  <tr className="border-t border-gray-200"><td colSpan="3" className="px-3 py-1.5 text-right text-xs text-gray-500">Subtotal</td><td className="px-3 py-1.5 text-right text-sm">{formatCurrency(inv.subtotal)}</td></tr>
                )}
                {Number(inv.tax) > 0.005 && (
                  <tr><td colSpan="3" className="px-3 py-1.5 text-right text-xs text-gray-500">Tax ({(() => { const r = Number(inv.taxRate); if (!Number.isFinite(r) || r === 0) return '0'; return (r * 100).toFixed(2).replace(/\.?0+$/, '') })()}%)</td><td className="px-3 py-1.5 text-right text-sm">{formatCurrency(inv.tax)}</td></tr>
                )}
                <tr className="border-t border-gray-200"><td colSpan="3" className="px-3 py-2 text-right font-semibold">Total</td><td className="px-3 py-2 text-right font-display font-bold text-lg">{formatCurrency(inv.total)}</td></tr>
                {inv.paidAmount > 0 && (
                  <>
                    <tr className="border-t border-gray-100"><td colSpan="3" className="px-3 py-1.5 text-right text-xs text-green-600">Paid</td><td className="px-3 py-1.5 text-right text-sm text-green-600">{formatCurrency(inv.paidAmount)}</td></tr>
                    <tr className="border-t border-gray-200 bg-gray-50"><td colSpan="3" className="px-3 py-2 text-right font-semibold text-amber-700">Balance</td><td className="px-3 py-2 text-right font-display font-bold text-lg text-amber-700">{formatCurrency(inv.balance)}</td></tr>
                  </>
                )}
              </tfoot>
            </table>
          </div>

          <PaymentHistory invoice={inv} onVoidPayment={onVoidPayment} />

          {inv.notes && <p className="text-sm text-gray-600">{inv.notes}</p>}
          {inv.dueDate && <p className="text-xs text-gray-500">Due: {formatDate(inv.dueDate)}</p>}

          <div className="flex flex-wrap gap-2 pt-2">
            <button
              onClick={() => onEdit(inv)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-gray-200 text-charcoal-900 text-xs font-medium rounded-lg hover:bg-gray-50"
              title="Edit line items, due date, customer info, and notes"
            >
              <Pencil size={12} />Edit
            </button>
            {isDraft && (
              <button
                onClick={() => onSend(inv)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white text-xs font-medium rounded-lg hover:bg-blue-700"
                title={hasEmail
                  ? `Email this invoice to ${inv.customerEmail} and mark it Sent${stripeEnabled ? ' (includes online pay link)' : ''}`
                  : 'No customer email on file — will just mark as Sent'}
              >
                {hasEmail ? <Mail size={12} /> : <Send size={12} />}
                Send Invoice
              </button>
            )}
            {!isDraft && hasEmail && (
              <button
                onClick={() => onSend(inv)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 text-blue-700 text-xs font-medium rounded-lg hover:bg-blue-100"
                title={`Resend this invoice to ${inv.customerEmail}${stripeEnabled ? ' (includes online pay link)' : ''}`}
              >
                <RefreshCw size={12} />Resend
              </button>
            )}
            {/* Pay link actions — only show when Stripe is configured AND
                there's a balance to collect. Copy URL for Jimmy to text
                manually, or Send triggers the branded pay-link email. */}
            {stripeEnabled && canRecordPayment && (
              <>
                <button
                  onClick={() => onCopyPayLink(inv)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg ${
                    payLinkCopied
                      ? 'bg-green-100 text-green-800 border border-green-200'
                      : 'bg-purple-50 text-purple-800 border border-purple-200 hover:bg-purple-100'
                  }`}
                  title="Generate a pay link and copy the URL to your clipboard"
                >
                  {payLinkCopied ? <><CheckCircle2 size={12} />Copied</> : <><Copy size={12} />Copy Pay Link</>}
                </button>
                {hasEmail && (
                  <button
                    onClick={() => onSendPayLink(inv)}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-purple-600 text-white text-xs font-medium rounded-lg hover:bg-purple-700"
                    title={`Email a pay link to ${inv.customerEmail}`}
                  >
                    <Link2 size={12} />Send Pay Link
                  </button>
                )}
              </>
            )}
            {canRecordPayment && (
              <button onClick={() => onOpenPaymentModal(inv)} className="flex items-center gap-1.5 px-3 py-1.5 bg-green-600 text-white text-xs font-medium rounded-lg hover:bg-green-700">
                <DollarSign size={12} />Record Payment
              </button>
            )}
            <button onClick={() => { if (confirm('Delete this invoice?')) onDelete(inv.id) }} className="flex items-center gap-1.5 px-3 py-1.5 text-red-600 text-xs font-medium hover:bg-red-50 rounded-lg ml-auto">
              <Trash2 size={12} />Delete
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// Shared form body used by both New Invoice and Edit Invoice modals.
// Renders all the fields + LineItemsEditor; parent supplies form, setForm,
// items, setItems, a submit handler, and the submit button label.
function InvoiceFormFields({ form, setForm, items, setItems }) {
  return (
    <>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Customer Name *</label>
          <input
            required
            value={form.customerName}
            onChange={e => setForm({ ...form, customerName: e.target.value })}
            className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:border-forest-500 outline-none"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Due Date</label>
          <input
            type="date"
            value={form.dueDate}
            onChange={e => setForm({ ...form, dueDate: e.target.value })}
            className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:border-forest-500 outline-none"
          />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Customer Email</label>
          <input
            type="email"
            value={form.customerEmail}
            onChange={e => setForm({ ...form, customerEmail: e.target.value })}
            placeholder="customer@example.com"
            className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:border-forest-500 outline-none"
          />
          <p className="text-[10px] text-gray-400 mt-0.5">Used when you Send or Resend the invoice by email.</p>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Tax Rate</label>
          <div className="relative">
            <input
              type="number"
              step="0.01"
              min="0"
              value={form.taxRate}
              onChange={e => setForm({ ...form, taxRate: e.target.value })}
              className="w-full pr-8 px-3 py-2 rounded-lg border border-gray-200 text-sm focus:border-forest-500 outline-none"
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">%</span>
          </div>
          <p className="text-[10px] text-gray-400 mt-0.5">Default 0% — Frontline's pest-control services are sales-tax-exempt in Oklahoma. Set a rate only for taxable items (product sales, etc.).</p>
        </div>
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1">Customer Address</label>
        <input
          value={form.customerAddress}
          onChange={e => setForm({ ...form, customerAddress: e.target.value })}
          className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:border-forest-500 outline-none"
        />
      </div>

      <div className="pt-2 border-t border-gray-100">
        <label className="block text-xs font-semibold text-gray-700 mb-2">Line Items *</label>
        <LineItemsEditor
          items={items}
          onChange={setItems}
          taxRate={Number(form.taxRate) / 100 || 0}
        />
      </div>

      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1">Notes</label>
        <textarea
          value={form.notes}
          onChange={e => setForm({ ...form, notes: e.target.value })}
          rows={2}
          className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:border-forest-500 outline-none resize-none"
        />
      </div>
    </>
  )
}

function NewInvoiceModal({ onClose, onSave, prefill }) {
  // Prefill can come from a job — pick up customer info and line items.
  const prefillItems = Array.isArray(prefill?.lineItems) && prefill.lineItems.length > 0
    ? prefill.lineItems.map(li => ({
        description: li.description,
        quantity: Number(li.quantity) || 1,
        rate: Number(li.rate) || 0,
        serviceId: li.serviceId || null,
      }))
    : [{ description: prefill?.serviceType || '', quantity: 1, rate: 0, serviceId: null }]

  const [form, setForm] = useState({
    customerName: prefill?.customerName || '',
    customerEmail: prefill?.email || '',
    customerAddress: prefill?.address || '',
    jobId: prefill?.id || '',
    dueDate: '',
    taxRate: '0',
    notes: '',
  })
  const [items, setItems] = useState(prefillItems)
  const [saving, setSaving] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSaving(true)
    await onSave({
      ...form,
      taxRate: Number(form.taxRate) / 100 || 0,
      items,
    })
    setSaving(false)
    onClose()
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-5 border-b">
          <h3 className="font-display font-bold text-lg">New Invoice</h3>
          <button onClick={onClose}><X size={20} /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <InvoiceFormFields form={form} setForm={setForm} items={items} setItems={setItems} />
          <button
            type="submit"
            disabled={saving || items.every(i => !i.description)}
            className="w-full btn-primary py-2.5 disabled:opacity-50"
          >
            {saving ? 'Creating…' : 'Create Invoice'}
          </button>
        </form>
      </div>
    </div>
  )
}

function EditInvoiceModal({ invoice, onClose, onSaved }) {
  const storedTaxRate = Number(invoice.taxRate)
  const initialTaxPct = Number.isFinite(storedTaxRate) && storedTaxRate > 0
    ? (storedTaxRate * 100).toFixed(2).replace(/\.?0+$/, '') || '0'
    : '0'

  const [form, setForm] = useState({
    customerName: invoice.customerName || '',
    customerEmail: invoice.customerEmail || '',
    customerAddress: invoice.customerAddress || '',
    dueDate: invoice.dueDate || '',
    taxRate: initialTaxPct,
    notes: invoice.notes || '',
  })
  const [items, setItems] = useState(
    Array.isArray(invoice.items)
      ? invoice.items.map(li => ({
          description: li.description,
          quantity: Number(li.quantity) || 1,
          rate: Number(li.rate) || 0,
          serviceId: li.serviceId || null,
        }))
      : []
  )
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const paidAmount = Number(invoice.paidAmount || 0)
  const locked = paidAmount > 0.005

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSaving(true); setError('')
    const payload = {
      customerName: form.customerName,
      customerEmail: form.customerEmail,
      customerAddress: form.customerAddress,
      dueDate: form.dueDate,
      notes: form.notes,
    }
    // Only send items + taxRate if the invoice isn't payment-locked.
    if (!locked) {
      payload.items = items
      payload.taxRate = Number(form.taxRate) / 100 || 0
    }
    const res = await adminFetch(`/api/admin/invoices/${invoice.id}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    })
    setSaving(false)
    if (res?.success) {
      onSaved?.(res.invoice)
      onClose()
    } else {
      setError(res?.error || 'Save failed')
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-5 border-b">
          <div>
            <h3 className="font-display font-bold text-lg">Edit Invoice</h3>
            <p className="text-xs text-gray-500">{invoice.invoiceNumber} · {invoice.customerName}</p>
          </div>
          <button onClick={onClose}><X size={20} /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {locked && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-xs text-amber-900">
              <strong>Line items locked.</strong> ${paidAmount.toFixed(2)} has already been paid on this invoice.
              You can still edit the customer info, due date, and notes. To change line items or tax rate, void the payment first from the expanded invoice view.
            </div>
          )}
          <InvoiceFormFields form={form} setForm={setForm} items={items} setItems={setItems} />
          {error && <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded px-2 py-1.5">{error}</p>}
          <button
            type="submit"
            disabled={saving}
            className="w-full btn-primary py-2.5 disabled:opacity-50"
          >
            {saving ? 'Saving…' : 'Save Changes'}
          </button>
        </form>
      </div>
    </div>
  )
}

export default function AdminInvoices() {
  const [invoices, setInvoices] = useState([])
  const [showNew, setShowNew] = useState(false)
  const [editingInvoice, setEditingInvoice] = useState(null)
  const [paymentModalInvoice, setPaymentModalInvoice] = useState(null)
  const [stripeEnabled, setStripeEnabled] = useState(false)
  const [payLinkCopiedId, setPayLinkCopiedId] = useState(null)
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
    const [data, stripeStatus] = await Promise.all([
      adminFetch('/api/admin/invoices'),
      adminFetch('/api/admin/stripe/status'),
    ])
    if (data) setInvoices(data.invoices || [])
    if (stripeStatus) setStripeEnabled(!!stripeStatus.configured)
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
    if (filter !== 'all' && inv.effectiveStatus !== filter) setFilter('all')
    setTimeout(() => {
      focusedRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }, 50)
    setSearchParams({}, { replace: true })
  }, [focusId, invoices, filter, setSearchParams])

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

  // Send (or resend) an invoice via the new /send endpoint. Confirms the
  // recipient so a typo doesn't result in a surprise email to the wrong
  // address. Shows an inline summary of what happened (sent vs. marked
  // only vs. SMTP error) so the user isn't left guessing.
  const sendInvoice = async (inv) => {
    const recipient = inv.customerEmail && inv.customerEmail.trim()
    const action = inv.baseStatus === 'draft' ? 'Send' : 'Resend'
    const prompt = recipient
      ? `${action} invoice ${inv.invoiceNumber} to ${recipient}?`
      : `This invoice has no customer email. Mark ${inv.invoiceNumber} as Sent anyway?`
    if (!confirm(prompt)) return
    const res = await adminFetch(`/api/admin/invoices/${inv.id}/send`, {
      method: 'POST',
      body: JSON.stringify({}),
    })
    if (res && res.success) {
      if (res.emailed) {
        alert(`Invoice ${inv.invoiceNumber} emailed to ${res.recipient}.`)
      } else if (res.reason && /no customer email/i.test(res.reason)) {
        alert(`Invoice ${inv.invoiceNumber} marked Sent. (No customer email on file — nothing was emailed.)`)
      } else {
        alert(`Invoice ${inv.invoiceNumber} marked Sent. Email was not delivered: ${res.reason}`)
      }
    } else {
      alert(`Send failed: ${res?.error || 'unknown error'}`)
    }
    fetchInvoices()
  }
  const deleteInvoice = async (id) => { await adminFetch(`/api/admin/invoices/${id}`, { method: 'DELETE' }); fetchInvoices() }
  const voidPayment = async (paymentId) => { await adminFetch(`/api/admin/payments/${paymentId}`, { method: 'DELETE' }); fetchInvoices() }
  const openPaymentModal = (inv) => setPaymentModalInvoice(inv)

  // Generate a pay link for this invoice and copy the URL to clipboard
  // so Jimmy can text/DM it to a customer manually.
  const copyPayLink = async (inv) => {
    const res = await adminFetch(`/api/admin/invoices/${inv.id}/pay-link`, {
      method: 'POST',
      body: JSON.stringify({}),
    })
    if (!res?.success) {
      alert(`Couldn't create pay link: ${res?.error || 'unknown error'}`)
      return
    }
    try {
      await navigator.clipboard.writeText(res.publicUrl)
      setPayLinkCopiedId(inv.id)
      setTimeout(() => setPayLinkCopiedId(null), 2500)
    } catch {
      // Clipboard API can fail in some browsers — fall back to a prompt
      // so the link is never irretrievable.
      prompt('Copy this pay link:', res.publicUrl)
    }
  }

  // Email a pay link to the invoice's customerEmail with a branded
  // payment-reminder template (bigger Pay Now button, shorter body
  // than the full invoice email).
  const sendPayLink = async (inv) => {
    if (!inv.customerEmail) {
      alert('This invoice has no customer email. Use Edit to add one, or use Copy Pay Link and send it yourself.')
      return
    }
    if (!confirm(`Email a pay link for ${inv.invoiceNumber} to ${inv.customerEmail}?`)) return
    const res = await adminFetch(`/api/admin/invoices/${inv.id}/send-pay-link`, {
      method: 'POST',
      body: JSON.stringify({}),
    })
    if (res?.success) {
      if (res.sent) {
        alert(`Pay link emailed to ${res.recipient}.`)
      } else {
        alert(`Pay link prepared, but email wasn't sent: ${res.reason}`)
      }
    } else {
      alert(`Failed to send pay link: ${res?.error || 'unknown error'}`)
    }
    fetchInvoices()
  }

  const filtered = filter === 'all' ? invoices : invoices.filter(i => (i.effectiveStatus || i.status) === filter)
  const totalOutstanding = invoices
    .filter(i => i.effectiveStatus !== 'draft' && i.effectiveStatus !== 'paid')
    .reduce((s, i) => s + Number(i.balance ?? 0), 0)
  const totalCollected = invoices.reduce((s, i) => s + Number(i.paidAmount ?? 0), 0)

  return (
    <AdminLayout>
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm text-center"><div className="font-display font-bold text-xl text-charcoal-900">{invoices.length}</div><div className="text-xs text-gray-500">Total Invoices</div></div>
        <div className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm text-center"><div className="font-display font-bold text-xl text-amber-600">{formatCurrency(totalOutstanding)}</div><div className="text-xs text-gray-500">Outstanding</div></div>
        <div className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm text-center"><div className="font-display font-bold text-xl text-green-600">{formatCurrency(totalCollected)}</div><div className="text-xs text-gray-500">Collected</div></div>
      </div>

      <div className="flex justify-between items-center mb-4 flex-wrap gap-2">
        <div className="flex gap-2 flex-wrap">
          {['all', 'draft', 'sent', 'partial', 'paid', 'overdue'].map(f => (
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
              onSend={sendInvoice}
              onEdit={setEditingInvoice}
              onDelete={deleteInvoice}
              onOpenPaymentModal={openPaymentModal}
              onVoidPayment={voidPayment}
              onCopyPayLink={copyPayLink}
              onSendPayLink={sendPayLink}
              payLinkCopied={payLinkCopiedId === inv.id}
              stripeEnabled={stripeEnabled}
              cardRef={inv.id === focusId ? focusedRef : undefined}
              highlight={inv.id === highlightedId}
            />
          ))}
        </div>
      )}

      {showNew && <NewInvoiceModal onClose={() => { setShowNew(false); setPrefill(null) }} onSave={createInvoice} prefill={prefill} />}
      {editingInvoice && (
        <EditInvoiceModal
          invoice={editingInvoice}
          onClose={() => setEditingInvoice(null)}
          onSaved={() => fetchInvoices()}
        />
      )}
      {paymentModalInvoice && (
        <RecordPaymentModal
          invoice={paymentModalInvoice}
          onClose={() => setPaymentModalInvoice(null)}
          onSaved={() => fetchInvoices()}
        />
      )}
    </AdminLayout>
  )
}
