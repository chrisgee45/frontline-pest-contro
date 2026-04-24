import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { useNavigate, useSearchParams, Link } from 'react-router-dom'
import { Plus, X, MapPin, Phone, Mail, Calendar, User, Trash2, FileText, UserCheck, UserSquare, Search, Pencil } from 'lucide-react'
import AdminLayout from '../components/AdminLayout'
import LineItemsEditor from '../components/LineItemsEditor'
import { adminFetch, getToken, formatDate, formatCurrency } from '../hooks/useAdmin'

// Format a digits-only phone to 405-555-1212 for display.
function fmtPhone(p) {
  const d = String(p || '').replace(/\D/g, '')
  if (d.length === 10) return `${d.slice(0, 3)}-${d.slice(3, 6)}-${d.slice(6)}`
  if (d.length === 11 && d.startsWith('1')) return `${d.slice(1, 4)}-${d.slice(4, 7)}-${d.slice(7)}`
  return p || ''
}

// Searchable customer picker. Shows a dropdown of matching households as
// the user types in the Customer Name field. Selecting a match fills in
// the rest of the contact fields and passes customerId through to the
// POST payload so the backend skips its own match-or-create logic.
//
// When nothing is selected, the parent's customerName/phone/email/address
// fields drive creation as before; findOrCreateCustomer on the backend
// will handle dedup.
function CustomerPicker({ form, setForm }) {
  const [suggestions, setSuggestions] = useState([])
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const containerRef = useRef(null)

  // Close the dropdown when clicking outside the picker.
  useEffect(() => {
    const onDocClick = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', onDocClick)
    return () => document.removeEventListener('mousedown', onDocClick)
  }, [])

  // Debounced search. Skip when a customer is already selected (so
  // users can edit the name cosmetically without re-triggering search)
  // or when the query is too short to be useful.
  useEffect(() => {
    if (form.customerId) return
    const q = (form.customerName || '').trim()
    if (q.length < 2) { setSuggestions([]); return }
    const timer = setTimeout(async () => {
      setLoading(true)
      const res = await adminFetch(`/api/admin/customers?q=${encodeURIComponent(q)}`)
      setLoading(false)
      if (res?.customers) {
        setSuggestions(res.customers.slice(0, 6))
        setOpen(res.customers.length > 0)
      }
    }, 250)
    return () => clearTimeout(timer)
  }, [form.customerName, form.customerId])

  const handleSelect = (cust) => {
    setForm(f => ({
      ...f,
      customerId: cust.id,
      customerName: cust.displayName,
      // Auto-fill contact details from the primary contact so Jimmy doesn't
      // have to retype them. If the customer has a default service location
      // with a different address, prefer that over billingAddress.
      phone: cust.primaryPhone ? fmtPhone(cust.primaryPhone) : f.phone,
      email: cust.primaryEmail || f.email,
      address: cust.billingAddress || f.address,
    }))
    setOpen(false)
    setSuggestions([])
  }

  const clearSelection = () => {
    setForm(f => ({ ...f, customerId: null }))
  }

  const linked = !!form.customerId

  return (
    <div className="relative" ref={containerRef}>
      <label className="block text-xs font-medium text-gray-700 mb-1">Customer Name *</label>
      <div className="relative">
        {linked ? (
          <UserSquare size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-forest-600" />
        ) : (
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        )}
        <input
          required
          value={form.customerName}
          onChange={e => setForm({ ...form, customerName: e.target.value, customerId: null })}
          onFocus={() => { if (suggestions.length > 0 && !form.customerId) setOpen(true) }}
          placeholder="Start typing — existing customers will appear below"
          className={`w-full pl-9 ${linked ? 'pr-9' : 'pr-3'} py-2 rounded-lg border text-sm focus:border-forest-500 outline-none ${linked ? 'border-forest-500 bg-forest-50' : 'border-gray-200'}`}
        />
        {linked && (
          <button
            type="button"
            onClick={clearSelection}
            title="Clear selection (treat as new customer)"
            className="absolute right-2 top-1/2 -translate-y-1/2 text-forest-700 hover:text-forest-900 p-1"
          >
            <X size={14} />
          </button>
        )}
      </div>

      {/* Linked banner */}
      {linked && (
        <p className="text-[11px] text-forest-700 mt-1 flex items-center gap-1">
          <UserSquare size={10} />Linked to existing customer — contact info pulled from the household
        </p>
      )}

      {/* Dropdown */}
      {open && !linked && suggestions.length > 0 && (
        <div className="absolute z-10 left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-72 overflow-y-auto">
          <div className="px-3 py-2 text-[10px] text-gray-400 uppercase tracking-wider border-b border-gray-100 bg-gray-50">
            {suggestions.length} existing {suggestions.length === 1 ? 'customer' : 'customers'} matching
          </div>
          {suggestions.map(c => (
            <button
              key={c.id}
              type="button"
              onClick={() => handleSelect(c)}
              className="w-full text-left px-3 py-2 hover:bg-forest-50 border-b border-gray-100 last:border-0 transition-colors"
            >
              <div className="font-medium text-sm text-charcoal-900 truncate">{c.displayName}</div>
              <div className="text-xs text-gray-500 flex items-center gap-3 flex-wrap mt-0.5">
                {c.primaryContactName && c.primaryContactName !== c.displayName && (
                  <span className="truncate">{c.primaryContactName}</span>
                )}
                {c.primaryPhone && (
                  <span className="flex items-center gap-1"><Phone size={9} />{fmtPhone(c.primaryPhone)}</span>
                )}
                {c.primaryEmail && (
                  <span className="flex items-center gap-1 truncate"><Mail size={9} />{c.primaryEmail}</span>
                )}
                {c.jobCount > 0 && (
                  <span className="text-gray-400">· {c.jobCount} {c.jobCount === 1 ? 'job' : 'jobs'}</span>
                )}
              </div>
              {c.billingAddress && (
                <div className="text-[10px] text-gray-400 mt-0.5 flex items-center gap-1 truncate">
                  <MapPin size={9} />{c.billingAddress}
                </div>
              )}
            </button>
          ))}
        </div>
      )}

      {/* Empty state hint */}
      {open && !linked && suggestions.length === 0 && !loading && (form.customerName || '').trim().length >= 2 && (
        <div className="absolute z-10 left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg px-3 py-2">
          <p className="text-xs text-gray-500">
            No existing customer matches "{form.customerName}". A new customer record will be created automatically when you save this job.
          </p>
        </div>
      )}
    </div>
  )
}

const COLUMNS = [
  { key: 'new', label: 'New', color: 'border-blue-400', bg: 'bg-blue-50', badge: 'bg-blue-100 text-blue-800' },
  { key: 'scheduled', label: 'Scheduled', color: 'border-amber-400', bg: 'bg-amber-50', badge: 'bg-amber-100 text-amber-800' },
  { key: 'in_progress', label: 'In Progress', color: 'border-purple-400', bg: 'bg-purple-50', badge: 'bg-purple-100 text-purple-800' },
  { key: 'completed', label: 'Completed', color: 'border-green-400', bg: 'bg-green-50', badge: 'bg-green-100 text-green-800' },
]

const SERVICE_TYPES = ['Termite Treatment', 'General Pest Control', 'Rodent Control', 'Inspection', 'Other']

function JobCard({ job, invoice, expanded, onToggle, onStatusChange, onDelete, onCreateInvoice, onEdit, cardRef, highlight }) {
  // Running total of the job's line items — previews the invoice the
  // customer will receive on completion.
  const itemsTotal = Array.isArray(job.lineItems)
    ? job.lineItems.reduce((s, li) => s + (Number(li.quantity) || 0) * (Number(li.rate) || 0), 0)
    : 0
  const itemsCount = Array.isArray(job.lineItems) ? job.lineItems.length : 0

  return (
    <div
      ref={cardRef}
      className={`bg-white rounded-lg border shadow-sm p-3 cursor-pointer hover:shadow-md transition-all ${highlight ? 'border-forest-500 ring-2 ring-forest-200' : 'border-gray-200'}`}
      onClick={onToggle}
    >
      <div className="flex items-start justify-between mb-2">
        <span className="text-xs font-semibold text-forest-700 bg-forest-50 px-2 py-0.5 rounded">{job.serviceType}</span>
        {job.leadId && !expanded && (
          <span title="Converted from a lead" className="text-xs text-green-700"><UserCheck size={12} /></span>
        )}
      </div>
      <h4 className="font-semibold text-sm text-charcoal-900 mb-1">{job.customerName}</h4>
      {job.address && <p className="text-xs text-gray-500 flex items-center gap-1 mb-1"><MapPin size={11} />{job.address}</p>}
      {job.scheduledDate && <p className="text-xs text-gray-500 flex items-center gap-1 mb-1"><Calendar size={11} />{formatDate(job.scheduledDate)}</p>}
      <p className="text-xs text-gray-400 flex items-center gap-1"><User size={11} />{job.assignedTech}</p>

      {/* Pre-completion summary of line items + total. Visible on the card
          even when collapsed so Jimmy can see what a job is priced at
          without clicking in. */}
      {itemsCount > 0 && (
        <div className="mt-2 pt-2 border-t border-gray-100 flex items-center justify-between text-[11px]">
          <span className="text-gray-500">{itemsCount} line {itemsCount === 1 ? 'item' : 'items'}</span>
          <span className="font-semibold text-charcoal-900">{formatCurrency(itemsTotal)}</span>
        </div>
      )}

      {expanded && (
        <div className="mt-3 pt-3 border-t border-gray-100 space-y-2" onClick={e => e.stopPropagation()}>
          {job.customerId && (
            <div className="flex items-center gap-2 px-2 py-1.5 rounded bg-gray-50 border border-gray-200">
              <UserSquare size={11} className="text-gray-600" />
              <span className="text-[11px] text-gray-700">Customer record</span>
              <Link to={`/admin/customers/${job.customerId}`} className="ml-auto text-[10px] font-semibold text-forest-700 hover:text-forest-900 underline">View Customer →</Link>
            </div>
          )}
          {job.leadId && (
            <div className="flex items-center gap-2 px-2 py-1.5 rounded bg-green-50 border border-green-200">
              <UserCheck size={11} className="text-green-700" />
              <span className="text-[11px] text-green-900">Converted from a lead</span>
              <Link to={`/admin/leads?focus=${job.leadId}`} className="ml-auto text-[10px] font-semibold text-green-700 hover:text-green-900 underline">View Lead →</Link>
            </div>
          )}
          {job.phone && <p className="text-xs flex items-center gap-1"><Phone size={11} className="text-gray-400" /><a href={`tel:${job.phone}`} className="text-forest-700 hover:underline">{job.phone}</a></p>}

          {/* Line items preview inside the expanded card */}
          {itemsCount > 0 && (
            <div className="bg-gray-50 rounded border border-gray-200 p-2 space-y-1">
              <div className="text-[10px] uppercase tracking-wider text-gray-500 font-semibold mb-1">Services &amp; Pricing</div>
              {job.lineItems.map((li, i) => (
                <div key={i} className="flex justify-between text-[11px]">
                  <span className="text-gray-700 truncate pr-2">
                    {li.description}
                    {li.quantity > 1 && <span className="text-gray-400"> × {li.quantity}</span>}
                  </span>
                  <span className="text-gray-900 font-medium whitespace-nowrap">
                    {formatCurrency((Number(li.quantity) || 0) * (Number(li.rate) || 0))}
                  </span>
                </div>
              ))}
              <div className="flex justify-between text-[11px] font-bold text-charcoal-900 border-t border-gray-200 pt-1 mt-1">
                <span>Subtotal</span>
                <span>{formatCurrency(itemsTotal)}</span>
              </div>
            </div>
          )}

          {job.notes && <p className="text-xs text-gray-600 bg-gray-50 rounded p-2">{job.notes}</p>}
          <div className="flex flex-wrap gap-1 pt-1">
            {COLUMNS.filter(c => c.key !== job.status).map(c => (
              <button key={c.key} onClick={() => onStatusChange(job.id, c.key)} className={`px-2 py-1 rounded text-[10px] font-medium ${c.badge} hover:opacity-80`}>→ {c.label}</button>
            ))}
          </div>
          <div className="flex gap-2 pt-1 flex-wrap">
            <button onClick={() => onEdit(job)} className="flex items-center gap-1 text-[10px] text-charcoal-800 font-medium hover:underline">
              <Pencil size={11} />Edit Job
            </button>
            {invoice ? (
              <Link
                to={`/admin/invoices?focus=${invoice.id}`}
                className="flex items-center gap-1 text-[10px] text-forest-700 font-medium hover:underline"
                title={`View invoice ${invoice.invoiceNumber}`}
              >
                <FileText size={11} />View Invoice {invoice.invoiceNumber}
                {invoice.status === 'draft' && <span className="ml-1 text-gray-400">(Draft)</span>}
              </Link>
            ) : (
              <button onClick={() => onCreateInvoice(job)} className="flex items-center gap-1 text-[10px] text-forest-700 font-medium hover:underline">
                <FileText size={11} />Create Invoice
              </button>
            )}
            <button onClick={() => { if (confirm('Delete this job?')) onDelete(job.id) }} className="flex items-center gap-1 text-[10px] text-red-600 font-medium hover:underline ml-auto"><Trash2 size={11} />Delete</button>
          </div>
        </div>
      )}
    </div>
  )
}

// Shared form used by both New Job and Edit Job modals. Renders all the
// fields plus the LineItemsEditor — the wrapper modals decide the title,
// submit label, and whether the customer picker is shown.
function JobFormFields({ form, setForm, showCustomerPicker }) {
  // Load the technicians list once per modal open. Inactive ones are
  // hidden from the picker but their name stays on old jobs.
  const [techs, setTechs] = useState([])
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const res = await adminFetch('/api/admin/technicians')
      if (!cancelled && res?.technicians) setTechs(res.technicians)
    })()
    return () => { cancelled = true }
  }, [])

  return (
    <>
      {showCustomerPicker
        ? <CustomerPicker form={form} setForm={setForm} />
        : (
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Customer Name *</label>
            <input
              required
              value={form.customerName}
              onChange={e => setForm({ ...form, customerName: e.target.value })}
              className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:border-forest-500 outline-none"
            />
          </div>
        )
      }
      <div className="grid grid-cols-2 gap-4">
        <div><label className="block text-xs font-medium text-gray-700 mb-1">Phone</label><input value={form.phone} onChange={e => setForm({...form, phone: e.target.value})} className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:border-forest-500 outline-none" /></div>
        <div><label className="block text-xs font-medium text-gray-700 mb-1">Email</label><input type="email" value={form.email} onChange={e => setForm({...form, email: e.target.value})} className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:border-forest-500 outline-none" /></div>
      </div>
      <div><label className="block text-xs font-medium text-gray-700 mb-1">Address</label><input value={form.address} onChange={e => setForm({...form, address: e.target.value})} className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:border-forest-500 outline-none" /></div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Service Type *</label>
          <select value={form.serviceType} onChange={e => setForm({...form, serviceType: e.target.value})} className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm bg-white focus:border-forest-500 outline-none">
            {SERVICE_TYPES.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
          <p className="text-[10px] text-gray-400 mt-0.5">Headline category for the kanban card.</p>
        </div>
        <div><label className="block text-xs font-medium text-gray-700 mb-1">Scheduled Date</label><input type="date" value={form.scheduledDate} onChange={e => setForm({...form, scheduledDate: e.target.value})} className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:border-forest-500 outline-none" /></div>
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1">Assigned Technician</label>
        {techs.length > 0 ? (
          <>
            <select
              value={form.assignedTech}
              onChange={e => {
                if (e.target.value === '__manage__') {
                  // Escape hatch: open the technicians page in a new tab
                  // so Jimmy can add someone without losing his place.
                  window.open('/admin/technicians', '_blank')
                  return
                }
                setForm({ ...form, assignedTech: e.target.value })
              }}
              className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm bg-white focus:border-forest-500 outline-none"
            >
              {/* Preserve the current value even if it's no longer in the
                  active list (e.g., a retired tech on an old job). */}
              {form.assignedTech && !techs.some(t => t.name === form.assignedTech) && (
                <option value={form.assignedTech}>{form.assignedTech} (inactive)</option>
              )}
              {techs.map(t => (
                <option key={t.id} value={t.name}>
                  {t.name}{t.role === 'owner' ? ' (owner)' : ''}
                </option>
              ))}
              <option disabled>──────────</option>
              <option value="__manage__">+ Add/Manage Technicians…</option>
            </select>
            <p className="text-[10px] text-gray-400 mt-0.5">
              Manage the full list on the <Link to="/admin/technicians" className="underline">Technicians</Link> page.
            </p>
          </>
        ) : (
          // Fall back to free-text input if the technicians list hasn't
          // loaded yet or the API is unreachable — never block the form.
          <input
            value={form.assignedTech}
            onChange={e => setForm({ ...form, assignedTech: e.target.value })}
            className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:border-forest-500 outline-none"
          />
        )}
      </div>

      {/* Line items — the actual services + pricing that will drive the
          invoice when this job is marked completed. */}
      <div className="pt-2 border-t border-gray-100">
        <label className="block text-xs font-semibold text-gray-700 mb-2">
          Services &amp; Pricing
          <span className="ml-1 text-gray-400 font-normal">— becomes the invoice when job is completed</span>
        </label>
        <LineItemsEditor
          items={form.lineItems}
          onChange={(lineItems) => setForm({ ...form, lineItems })}
        />
      </div>

      <div><label className="block text-xs font-medium text-gray-700 mb-1">Notes</label><textarea value={form.notes} onChange={e => setForm({...form, notes: e.target.value})} rows={2} className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:border-forest-500 outline-none resize-none" /></div>
    </>
  )
}

function NewJobModal({ onClose, onSave }) {
  const [form, setForm] = useState({
    customerName: '',
    address: '',
    phone: '',
    email: '',
    customerId: null, // set by CustomerPicker when an existing customer is selected
    serviceType: 'General Pest Control',
    scheduledDate: '',
    assignedTech: 'Jimmy Manharth',
    notes: '',
    lineItems: [],
  })
  const [saving, setSaving] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault(); setSaving(true)
    await onSave(form); setSaving(false); onClose()
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-5 border-b"><h3 className="font-display font-bold text-lg">New Job</h3><button onClick={onClose}><X size={20} /></button></div>
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <JobFormFields form={form} setForm={setForm} showCustomerPicker />
          <button type="submit" disabled={saving} className="w-full btn-primary py-2.5 disabled:opacity-50">{saving ? 'Creating...' : 'Create Job'}</button>
        </form>
      </div>
    </div>
  )
}

function EditJobModal({ job, onClose, onSave }) {
  const [form, setForm] = useState({
    customerName: job.customerName || '',
    address: job.address || '',
    phone: job.phone || '',
    email: job.email || '',
    serviceType: job.serviceType || 'General Pest Control',
    scheduledDate: job.scheduledDate || '',
    assignedTech: job.assignedTech || 'Jimmy Manharth',
    notes: job.notes || '',
    lineItems: Array.isArray(job.lineItems) ? job.lineItems : [],
  })
  const [saving, setSaving] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault(); setSaving(true)
    await onSave(job.id, form); setSaving(false); onClose()
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-5 border-b">
          <div>
            <h3 className="font-display font-bold text-lg">Edit Job</h3>
            <p className="text-xs text-gray-500">{job.customerName} · {job.serviceType}</p>
          </div>
          <button onClick={onClose}><X size={20} /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <JobFormFields form={form} setForm={setForm} showCustomerPicker={false} />
          <button type="submit" disabled={saving} className="w-full btn-primary py-2.5 disabled:opacity-50">{saving ? 'Saving…' : 'Save Changes'}</button>
        </form>
      </div>
    </div>
  )
}

export default function AdminJobs() {
  const [jobs, setJobs] = useState([])
  const [invoices, setInvoices] = useState([])
  const [showNew, setShowNew] = useState(false)
  const [editingJob, setEditingJob] = useState(null)
  const [loading, setLoading] = useState(true)
  const [expandedId, setExpandedId] = useState(null)
  const [highlightedId, setHighlightedId] = useState(null)
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const focusId = searchParams.get('focus')
  const focusedRef = useRef(null)

  // Index invoices by jobId so each card can look up "does this job have
  // an invoice yet?" without scanning the full list.
  const invoiceByJobId = useMemo(() => {
    const map = {}
    for (const i of invoices) {
      if (i.jobId) map[i.jobId] = i
    }
    return map
  }, [invoices])

  const fetchJobs = useCallback(async () => {
    if (!getToken()) { navigate('/admin'); return }
    const [jobsRes, invoicesRes] = await Promise.all([
      adminFetch('/api/admin/jobs'),
      adminFetch('/api/admin/invoices'),
    ])
    if (jobsRes) setJobs(jobsRes.jobs || [])
    if (invoicesRes) setInvoices(invoicesRes.invoices || [])
    setLoading(false)
  }, [navigate])

  useEffect(() => { fetchJobs() }, [fetchJobs])

  // Auto-expand the focused job and scroll it into view after the kanban
  // mounts. Clears the query param so a refresh doesn't re-scroll.
  useEffect(() => {
    if (!focusId || jobs.length === 0) return
    const job = jobs.find(j => j.id === focusId)
    if (!job) return
    setExpandedId(focusId)
    setHighlightedId(focusId)
    setTimeout(() => {
      focusedRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }, 50)
    setSearchParams({}, { replace: true })
  }, [focusId, jobs, setSearchParams])

  // Fade the highlight ring 2.5s after it's set. Kept in its own effect
  // (keyed on highlightedId, not focusId) so the cleanup isn't torn down
  // when setSearchParams clears focusId immediately after the highlight
  // is applied.
  useEffect(() => {
    if (!highlightedId) return
    const timer = setTimeout(() => setHighlightedId(null), 2500)
    return () => clearTimeout(timer)
  }, [highlightedId])

  const createJob = async (form) => { await adminFetch('/api/admin/jobs', { method: 'POST', body: JSON.stringify(form) }); fetchJobs() }
  const updateStatus = async (id, status) => {
    const res = await adminFetch(`/api/admin/jobs/${id}`, { method: 'PATCH', body: JSON.stringify({ status }) })
    fetchJobs()
    // Notify Jimmy when a status change auto-drafted a new invoice from
    // the job's line items (e.g. transitioning to Completed).
    if (res?.autoInvoice) {
      const count = Array.isArray(res.autoInvoice.items) ? res.autoInvoice.items.length : 0
      setTimeout(() => {
        alert(`Invoice ${res.autoInvoice.invoiceNumber} drafted with ${count} line ${count === 1 ? 'item' : 'items'} — total $${Number(res.autoInvoice.total).toFixed(2)}.`)
      }, 100)
    }
  }
  const updateJob = async (id, form) => { await adminFetch(`/api/admin/jobs/${id}`, { method: 'PATCH', body: JSON.stringify(form) }); fetchJobs() }
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
                  <JobCard
                    key={job.id}
                    job={job}
                    invoice={invoiceByJobId[job.id]}
                    expanded={expandedId === job.id}
                    onToggle={() => setExpandedId(expandedId === job.id ? null : job.id)}
                    onStatusChange={updateStatus}
                    onDelete={deleteJob}
                    onCreateInvoice={createInvoice}
                    onEdit={setEditingJob}
                    cardRef={job.id === focusId ? focusedRef : undefined}
                    highlight={job.id === highlightedId}
                  />
                ))}
              </div>
            </div>
          )
        })}
      </div>

      {showNew && <NewJobModal onClose={() => setShowNew(false)} onSave={createJob} />}
      {editingJob && (
        <EditJobModal
          job={editingJob}
          onClose={() => setEditingJob(null)}
          onSave={updateJob}
        />
      )}
    </AdminLayout>
  )
}
