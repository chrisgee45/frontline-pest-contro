import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import {
  ArrowLeft, UserSquare, Phone, Mail, MapPin, Calendar, DollarSign,
  Users as UsersIcon, Briefcase, FileText, CircleDollarSign, MessageSquare,
  Plus, Pencil, X, Star, StarOff, Trash2, Tag,
} from 'lucide-react'
import AdminLayout from '../components/AdminLayout'
import { adminFetch, getToken, formatCurrency, formatDate } from '../hooks/useAdmin'

function fmtPhone(digits) {
  const d = String(digits || '').replace(/\D/g, '')
  if (d.length === 10) return `${d.slice(0, 3)}-${d.slice(3, 6)}-${d.slice(6)}`
  return digits || ''
}

const JOB_STATUS_STYLE = {
  new: 'bg-blue-100 text-blue-800',
  scheduled: 'bg-amber-100 text-amber-800',
  in_progress: 'bg-purple-100 text-purple-800',
  completed: 'bg-green-100 text-green-800',
}
const LEAD_STATUS_STYLE = {
  new: 'bg-blue-100 text-blue-800',
  contacted: 'bg-amber-100 text-amber-800',
  converted: 'bg-green-100 text-green-800',
  closed: 'bg-gray-100 text-gray-600',
}
const INVOICE_STATUS_STYLE = {
  draft: 'bg-gray-100 text-gray-700',
  sent: 'bg-blue-100 text-blue-800',
  partial: 'bg-amber-100 text-amber-800',
  paid: 'bg-green-100 text-green-800',
  overdue: 'bg-red-100 text-red-800',
}

export default function AdminCustomerDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [customer, setCustomer] = useState(null)
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState('timeline')
  const [editOpen, setEditOpen] = useState(false)
  const [newContactOpen, setNewContactOpen] = useState(false)
  const [newLocationOpen, setNewLocationOpen] = useState(false)

  const fetchDetail = useCallback(async () => {
    if (!getToken()) { navigate('/admin'); return }
    setLoading(true)
    const data = await adminFetch(`/api/admin/customers/${id}`)
    if (data?.customer) setCustomer(data.customer)
    setLoading(false)
  }, [id, navigate])

  useEffect(() => { fetchDetail() }, [fetchDetail])

  if (loading) return <AdminLayout><div className="text-center py-20 text-gray-500">Loading…</div></AdminLayout>
  if (!customer) return <AdminLayout><div className="text-center py-20 text-gray-500">Customer not found</div></AdminLayout>

  const primary = customer.contacts.find(c => c.isPrimary) || customer.contacts[0]
  const defaultLocation = customer.locations.find(l => l.isDefault) || customer.locations[0]

  return (
    <AdminLayout>
      {/* Back link */}
      <Link to="/admin/customers" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-forest-700 mb-4">
        <ArrowLeft size={14} />Back to Customers
      </Link>

      {/* Header card */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 mb-6">
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <UserSquare size={24} className="text-forest-700" />
              <h1 className="font-display font-bold text-2xl text-charcoal-900">{customer.displayName}</h1>
              {customer.tags?.map(t => (
                <span key={t} className="text-xs bg-forest-50 text-forest-700 px-2 py-0.5 rounded-full flex items-center gap-1">
                  <Tag size={10} />{t}
                </span>
              ))}
            </div>
            <div className="grid sm:grid-cols-2 gap-x-6 gap-y-1 mt-3 text-sm text-gray-600">
              {primary?.name && primary.name !== customer.displayName && (
                <div className="flex items-center gap-2"><UsersIcon size={14} className="text-gray-400" />{primary.name}</div>
              )}
              {primary?.phone && (
                <div className="flex items-center gap-2">
                  <Phone size={14} className="text-gray-400" />
                  <a href={`tel:${primary.phone}`} className="text-forest-700 hover:underline">{fmtPhone(primary.phone)}</a>
                </div>
              )}
              {primary?.email && (
                <div className="flex items-center gap-2 truncate">
                  <Mail size={14} className="text-gray-400" />
                  <a href={`mailto:${primary.email}`} className="text-forest-700 hover:underline truncate">{primary.email}</a>
                </div>
              )}
              {customer.billingAddress && (
                <div className="flex items-center gap-2 truncate"><MapPin size={14} className="text-gray-400" />{customer.billingAddress}</div>
              )}
            </div>
            {customer.notes && (
              <div className="mt-4 bg-gray-50 border border-gray-100 rounded-lg px-3 py-2 text-sm text-gray-700">
                {customer.notes}
              </div>
            )}
          </div>
          <button onClick={() => setEditOpen(true)} className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 text-gray-700 text-xs font-medium rounded-lg hover:bg-gray-200">
            <Pencil size={12} />Edit
          </button>
        </div>
      </div>

      {/* Stat tiles */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <StatTile icon={DollarSign} label="Total Billed" value={formatCurrency(customer.stats.totalBilled)} color="text-charcoal-900" />
        <StatTile icon={CircleDollarSign} label="Total Paid" value={formatCurrency(customer.stats.totalPaid)} color="text-green-600" />
        <StatTile icon={DollarSign} label="Balance" value={formatCurrency(customer.stats.balance)} color={customer.stats.balance > 0 ? 'text-amber-600' : 'text-gray-400'} />
        <StatTile
          icon={Calendar}
          label={customer.stats.nextServiceDate ? 'Next service' : 'Last service'}
          value={customer.stats.nextServiceDate ? formatDate(customer.stats.nextServiceDate) : (customer.stats.lastServiceDate ? formatDate(customer.stats.lastServiceDate) : '—')}
          color="text-charcoal-900"
        />
      </div>

      {/* Contacts + Locations side-by-side */}
      <div className="grid md:grid-cols-2 gap-4 mb-6">
        {/* Contacts */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-display font-bold text-charcoal-900 flex items-center gap-2"><UsersIcon size={16} />Contacts</h3>
            <button onClick={() => setNewContactOpen(true)} className="text-xs font-medium text-forest-700 hover:underline flex items-center gap-1">
              <Plus size={12} />Add
            </button>
          </div>
          {customer.contacts.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-4">No contacts yet</p>
          ) : (
            <div className="space-y-2">
              {customer.contacts.map(c => (
                <ContactRow key={c.id} customerId={customer.id} contact={c} onChange={fetchDetail} />
              ))}
            </div>
          )}
        </div>

        {/* Service locations */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-display font-bold text-charcoal-900 flex items-center gap-2"><MapPin size={16} />Service Locations</h3>
            <button onClick={() => setNewLocationOpen(true)} className="text-xs font-medium text-forest-700 hover:underline flex items-center gap-1">
              <Plus size={12} />Add
            </button>
          </div>
          {customer.locations.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-4">No service locations yet</p>
          ) : (
            <div className="space-y-2">
              {customer.locations.map(l => (
                <LocationRow key={l.id} customerId={customer.id} location={l} onChange={fetchDetail} />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="flex border-b border-gray-100 overflow-x-auto">
          <TabButton active={tab === 'timeline'} onClick={() => setTab('timeline')} icon={MessageSquare} label="Timeline" count={customer.leads.length + customer.jobs.length + customer.invoices.length + customer.payments.length} />
          <TabButton active={tab === 'leads'} onClick={() => setTab('leads')} icon={UsersIcon} label="Leads" count={customer.leads.length} />
          <TabButton active={tab === 'jobs'} onClick={() => setTab('jobs')} icon={Briefcase} label="Jobs" count={customer.jobs.length} />
          <TabButton active={tab === 'invoices'} onClick={() => setTab('invoices')} icon={FileText} label="Invoices" count={customer.invoices.length} />
          <TabButton active={tab === 'payments'} onClick={() => setTab('payments')} icon={CircleDollarSign} label="Payments" count={customer.payments.length} />
        </div>

        <div className="p-5">
          {tab === 'timeline' && <TimelineTab customer={customer} />}
          {tab === 'leads' && <LeadsTab leads={customer.leads} />}
          {tab === 'jobs' && <JobsTab jobs={customer.jobs} />}
          {tab === 'invoices' && <InvoicesTab invoices={customer.invoices} />}
          {tab === 'payments' && <PaymentsTab payments={customer.payments} invoices={customer.invoices} />}
        </div>
      </div>

      {editOpen && <EditCustomerModal customer={customer} onClose={() => setEditOpen(false)} onSaved={() => { setEditOpen(false); fetchDetail() }} />}
      {newContactOpen && <ContactModal customerId={customer.id} onClose={() => setNewContactOpen(false)} onSaved={() => { setNewContactOpen(false); fetchDetail() }} />}
      {newLocationOpen && <LocationModal customerId={customer.id} onClose={() => setNewLocationOpen(false)} onSaved={() => { setNewLocationOpen(false); fetchDetail() }} />}
    </AdminLayout>
  )
}

function StatTile({ icon: Icon, label, value, color }) {
  return (
    <div className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm">
      <div className="flex items-center gap-2 text-xs text-gray-500 mb-1">
        <Icon size={12} />{label}
      </div>
      <div className={`font-display font-bold text-xl ${color}`}>{value}</div>
    </div>
  )
}

function TabButton({ active, onClick, icon: Icon, label, count }) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 px-4 py-3 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
        active
          ? 'border-forest-700 text-forest-700'
          : 'border-transparent text-gray-500 hover:text-charcoal-900'
      }`}
    >
      <Icon size={14} />
      {label}
      <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${active ? 'bg-forest-100 text-forest-800' : 'bg-gray-100 text-gray-600'}`}>{count}</span>
    </button>
  )
}

function ContactRow({ customerId, contact, onChange }) {
  const [editing, setEditing] = useState(false)
  const toggleStar = async () => {
    await adminFetch(`/api/admin/customers/${customerId}/contacts/${contact.id}`, {
      method: 'PATCH',
      body: JSON.stringify({ isPrimary: !contact.isPrimary }),
    })
    onChange()
  }
  const remove = async () => {
    if (!confirm(`Remove contact ${contact.name || contact.email || contact.phone}?`)) return
    await adminFetch(`/api/admin/customers/${customerId}/contacts/${contact.id}`, { method: 'DELETE' })
    onChange()
  }

  if (editing) {
    return <ContactModal customerId={customerId} contact={contact} inline onClose={() => setEditing(false)} onSaved={() => { setEditing(false); onChange() }} />
  }

  return (
    <div className="flex items-center gap-3 p-2 rounded-lg border border-gray-100 hover:bg-gray-50">
      <button onClick={toggleStar} title={contact.isPrimary ? 'Primary contact' : 'Set as primary'} className="shrink-0">
        {contact.isPrimary
          ? <Star size={14} className="text-amber-500 fill-amber-400" />
          : <StarOff size={14} className="text-gray-300 hover:text-amber-500" />}
      </button>
      <div className="min-w-0 flex-1">
        <div className="text-sm font-medium text-charcoal-900 truncate">{contact.name || '—'}</div>
        <div className="text-xs text-gray-500 flex items-center gap-3 flex-wrap">
          {contact.phone && <span><Phone size={10} className="inline mr-0.5" />{fmtPhone(contact.phone)}</span>}
          {contact.email && <span className="truncate"><Mail size={10} className="inline mr-0.5" />{contact.email}</span>}
          {contact.role && <span className="text-gray-400">· {contact.role}</span>}
        </div>
      </div>
      <button onClick={() => setEditing(true)} className="text-gray-400 hover:text-gray-600 p-1"><Pencil size={12} /></button>
      <button onClick={remove} className="text-gray-400 hover:text-red-500 p-1"><Trash2 size={12} /></button>
    </div>
  )
}

function LocationRow({ customerId, location, onChange }) {
  const [editing, setEditing] = useState(false)
  const toggleDefault = async () => {
    await adminFetch(`/api/admin/customers/${customerId}/locations/${location.id}`, {
      method: 'PATCH',
      body: JSON.stringify({ isDefault: !location.isDefault }),
    })
    onChange()
  }
  const remove = async () => {
    if (!confirm(`Remove location ${location.label}?`)) return
    await adminFetch(`/api/admin/customers/${customerId}/locations/${location.id}`, { method: 'DELETE' })
    onChange()
  }

  if (editing) {
    return <LocationModal customerId={customerId} location={location} inline onClose={() => setEditing(false)} onSaved={() => { setEditing(false); onChange() }} />
  }

  return (
    <div className="flex items-center gap-3 p-2 rounded-lg border border-gray-100 hover:bg-gray-50">
      <button onClick={toggleDefault} title={location.isDefault ? 'Default location' : 'Set as default'} className="shrink-0">
        {location.isDefault
          ? <Star size={14} className="text-amber-500 fill-amber-400" />
          : <StarOff size={14} className="text-gray-300 hover:text-amber-500" />}
      </button>
      <div className="min-w-0 flex-1">
        <div className="text-sm font-medium text-charcoal-900">{location.label}</div>
        <div className="text-xs text-gray-500 truncate">{location.address}</div>
        {location.notes && <div className="text-[10px] text-gray-400 truncate">{location.notes}</div>}
      </div>
      <button onClick={() => setEditing(true)} className="text-gray-400 hover:text-gray-600 p-1"><Pencil size={12} /></button>
      <button onClick={remove} className="text-gray-400 hover:text-red-500 p-1"><Trash2 size={12} /></button>
    </div>
  )
}

// --- Tabs ---

function TimelineTab({ customer }) {
  // Mix all events into one chronological stream.
  const events = []
  for (const l of customer.leads) events.push({ t: l.createdAt, kind: 'lead', payload: l })
  for (const j of customer.jobs) events.push({ t: j.createdAt, kind: 'job', payload: j })
  for (const i of customer.invoices) events.push({ t: i.createdAt, kind: 'invoice', payload: i })
  for (const p of customer.payments) events.push({ t: p.paymentDate || p.createdAt, kind: 'payment', payload: p })
  events.sort((a, b) => (b.t || '').localeCompare(a.t || ''))

  if (events.length === 0) return <p className="text-sm text-gray-400 text-center py-6">No history yet</p>

  return (
    <div className="space-y-3">
      {events.map((e, i) => (
        <div key={i} className="flex items-start gap-3">
          <div className="shrink-0 w-8 h-8 rounded-full bg-forest-50 flex items-center justify-center">
            {e.kind === 'lead' && <UsersIcon size={14} className="text-forest-700" />}
            {e.kind === 'job' && <Briefcase size={14} className="text-forest-700" />}
            {e.kind === 'invoice' && <FileText size={14} className="text-forest-700" />}
            {e.kind === 'payment' && <CircleDollarSign size={14} className="text-green-600" />}
          </div>
          <div className="flex-1 min-w-0 pb-3 border-b border-gray-100">
            <div className="flex items-center gap-2 flex-wrap">
              {e.kind === 'lead' && <span className="text-sm font-medium">Lead: {e.payload.service}</span>}
              {e.kind === 'job' && <Link to={`/admin/jobs?focus=${e.payload.id}`} className="text-sm font-medium hover:text-forest-700 hover:underline">Job: {e.payload.serviceType}</Link>}
              {e.kind === 'invoice' && <Link to={`/admin/invoices?focus=${e.payload.id}`} className="text-sm font-medium hover:text-forest-700 hover:underline">Invoice {e.payload.invoiceNumber}</Link>}
              {e.kind === 'payment' && <span className="text-sm font-medium">Payment {formatCurrency(Number(e.payload.amount))} ({e.payload.paymentMethod})</span>}
              {e.payload.status && (
                <span className={`text-[10px] px-2 py-0.5 rounded-full ${
                  (e.kind === 'lead' && LEAD_STATUS_STYLE[e.payload.status]) ||
                  (e.kind === 'job' && JOB_STATUS_STYLE[e.payload.status]) ||
                  (e.kind === 'invoice' && INVOICE_STATUS_STYLE[e.payload.effectiveStatus || e.payload.status]) ||
                  'bg-gray-100 text-gray-600'
                }`}>
                  {(e.kind === 'invoice' ? (e.payload.effectiveStatus || e.payload.status) : e.payload.status).replace('_', ' ')}
                </span>
              )}
              {e.kind === 'invoice' && <span className="text-sm tabular-nums text-gray-600">{formatCurrency(e.payload.total)}</span>}
            </div>
            <div className="text-xs text-gray-400 mt-0.5">{formatDate(e.t)}</div>
          </div>
        </div>
      ))}
    </div>
  )
}

function LeadsTab({ leads }) {
  if (leads.length === 0) return <p className="text-sm text-gray-400 text-center py-6">No leads on this customer</p>
  return (
    <div className="space-y-2">
      {leads.map(l => (
        <div key={l.id} className="flex items-center gap-3 p-3 rounded-lg border border-gray-100 hover:bg-gray-50">
          <span className={`text-[10px] px-2 py-0.5 rounded-full ${LEAD_STATUS_STYLE[l.status] || 'bg-gray-100 text-gray-600'}`}>{l.status}</span>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium">{l.name} — {l.service}</div>
            <div className="text-xs text-gray-400">{formatDate(l.createdAt)}{l.message ? ` · ${l.message.slice(0, 80)}` : ''}</div>
          </div>
        </div>
      ))}
    </div>
  )
}

function JobsTab({ jobs }) {
  if (jobs.length === 0) return <p className="text-sm text-gray-400 text-center py-6">No jobs on this customer</p>
  return (
    <div className="space-y-2">
      {jobs.map(j => (
        <Link key={j.id} to={`/admin/jobs?focus=${j.id}`} className="flex items-center gap-3 p-3 rounded-lg border border-gray-100 hover:bg-gray-50 hover:border-forest-200">
          <span className={`text-[10px] px-2 py-0.5 rounded-full ${JOB_STATUS_STYLE[j.status] || 'bg-gray-100 text-gray-600'}`}>{j.status.replace('_', ' ')}</span>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium">{j.serviceType}</div>
            <div className="text-xs text-gray-400">{j.scheduledDate ? `Scheduled ${formatDate(j.scheduledDate)}` : `Created ${formatDate(j.createdAt)}`} · {j.assignedTech}</div>
          </div>
        </Link>
      ))}
    </div>
  )
}

function InvoicesTab({ invoices }) {
  if (invoices.length === 0) return <p className="text-sm text-gray-400 text-center py-6">No invoices on this customer</p>
  return (
    <div className="space-y-2">
      {invoices.map(i => (
        <Link key={i.id} to={`/admin/invoices?focus=${i.id}`} className="flex items-center gap-3 p-3 rounded-lg border border-gray-100 hover:bg-gray-50 hover:border-forest-200">
          <span className={`text-[10px] px-2 py-0.5 rounded-full ${INVOICE_STATUS_STYLE[i.effectiveStatus || i.status] || 'bg-gray-100 text-gray-600'}`}>{(i.effectiveStatus || i.status).replace('_', ' ')}</span>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium">{i.invoiceNumber}</div>
            <div className="text-xs text-gray-400">{formatDate(i.createdAt)}{i.dueDate ? ` · due ${formatDate(i.dueDate)}` : ''}</div>
          </div>
          <div className="text-right tabular-nums">
            <div className="text-sm font-semibold">{formatCurrency(i.total)}</div>
            {i.balance != null && i.balance > 0.005 && i.effectiveStatus !== 'draft' && (
              <div className="text-xs text-amber-600">{formatCurrency(i.balance)} left</div>
            )}
          </div>
        </Link>
      ))}
    </div>
  )
}

function PaymentsTab({ payments, invoices }) {
  if (payments.length === 0) return <p className="text-sm text-gray-400 text-center py-6">No payments on this customer</p>
  const invById = new Map(invoices.map(i => [i.id, i]))
  return (
    <div className="space-y-2">
      {payments.map(p => {
        const inv = invById.get(p.invoiceId)
        return (
          <div key={p.id} className="flex items-center gap-3 p-3 rounded-lg border border-gray-100 hover:bg-gray-50">
            <CircleDollarSign size={16} className="text-green-600 shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium">{formatCurrency(Number(p.amount))} <span className="text-xs text-gray-500 capitalize">({p.paymentMethod})</span></div>
              <div className="text-xs text-gray-400">
                {formatDate(p.paymentDate || p.createdAt)}
                {inv && <> · <Link to={`/admin/invoices?focus=${inv.id}`} className="hover:text-forest-700 hover:underline">{inv.invoiceNumber}</Link></>}
                {p.referenceNumber && <> · Ref: {p.referenceNumber}</>}
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}

// --- Modals ---

function EditCustomerModal({ customer, onClose, onSaved }) {
  const [displayName, setDisplayName] = useState(customer.displayName || '')
  const [billingAddress, setBillingAddress] = useState(customer.billingAddress || '')
  const [notes, setNotes] = useState(customer.notes || '')
  const [tagsInput, setTagsInput] = useState((customer.tags || []).join(', '))
  const [saving, setSaving] = useState(false)

  async function submit(e) {
    e.preventDefault()
    setSaving(true)
    await adminFetch(`/api/admin/customers/${customer.id}`, {
      method: 'PATCH',
      body: JSON.stringify({
        displayName: displayName.trim(),
        billingAddress: billingAddress.trim(),
        notes: notes.trim(),
        tags: tagsInput.split(',').map(t => t.trim()).filter(Boolean),
      }),
    })
    setSaving(false)
    onSaved()
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl w-full max-w-md" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-5 border-b">
          <h3 className="font-display font-bold text-lg">Edit Customer</h3>
          <button onClick={onClose}><X size={20} /></button>
        </div>
        <form onSubmit={submit} className="p-5 space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Household / Account Name *</label>
            <input required value={displayName} onChange={e => setDisplayName(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:border-forest-500 outline-none" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Billing Address</label>
            <input value={billingAddress} onChange={e => setBillingAddress(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:border-forest-500 outline-none" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Tags <span className="text-gray-400">(comma-separated)</span></label>
            <input value={tagsInput} onChange={e => setTagsInput(e.target.value)} placeholder="vip, commercial, quarterly-plan" className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:border-forest-500 outline-none" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Notes</label>
            <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={3} className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:border-forest-500 outline-none resize-none" />
          </div>
          <div className="flex gap-2 pt-2">
            <button type="button" onClick={onClose} className="flex-1 py-2.5 rounded-lg border border-gray-200 text-sm font-medium hover:bg-gray-50">Cancel</button>
            <button type="submit" disabled={saving} className="flex-1 btn-primary py-2.5 disabled:opacity-50">{saving ? 'Saving…' : 'Save'}</button>
          </div>
        </form>
      </div>
    </div>
  )
}

function ContactModal({ customerId, contact, onClose, onSaved, inline }) {
  const [name, setName] = useState(contact?.name || '')
  const [email, setEmail] = useState(contact?.email || '')
  const [phone, setPhone] = useState(contact?.phone || '')
  const [role, setRole] = useState(contact?.role || '')
  const [isPrimary, setIsPrimary] = useState(contact?.isPrimary || false)
  const [saving, setSaving] = useState(false)

  async function submit(e) {
    e.preventDefault()
    setSaving(true)
    const body = { name: name.trim(), email: email.trim(), phone: phone.trim(), role: role.trim(), isPrimary }
    if (contact?.id) {
      await adminFetch(`/api/admin/customers/${customerId}/contacts/${contact.id}`, { method: 'PATCH', body: JSON.stringify(body) })
    } else {
      await adminFetch(`/api/admin/customers/${customerId}/contacts`, { method: 'POST', body: JSON.stringify(body) })
    }
    setSaving(false)
    onSaved()
  }

  const wrapClass = inline
    ? 'p-3 rounded-lg border border-forest-200 bg-forest-50'
    : 'fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4'

  const inner = (
    <form onSubmit={submit} className="space-y-3">
      <div className="grid grid-cols-2 gap-2">
        <input value={name} onChange={e => setName(e.target.value)} placeholder="Name" className="px-3 py-2 rounded-lg border border-gray-200 text-sm focus:border-forest-500 outline-none" />
        <input value={role} onChange={e => setRole(e.target.value)} placeholder="Role (optional)" className="px-3 py-2 rounded-lg border border-gray-200 text-sm focus:border-forest-500 outline-none" />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <input value={phone} onChange={e => setPhone(e.target.value)} placeholder="Phone" className="px-3 py-2 rounded-lg border border-gray-200 text-sm focus:border-forest-500 outline-none" />
        <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="Email" className="px-3 py-2 rounded-lg border border-gray-200 text-sm focus:border-forest-500 outline-none" />
      </div>
      <label className="flex items-center gap-2 text-xs text-gray-700">
        <input type="checkbox" checked={isPrimary} onChange={e => setIsPrimary(e.target.checked)} />
        Primary contact
      </label>
      <div className="flex gap-2">
        <button type="button" onClick={onClose} className="flex-1 py-2 rounded-lg border border-gray-200 text-xs font-medium hover:bg-gray-50">Cancel</button>
        <button type="submit" disabled={saving} className="flex-1 btn-primary py-2 text-xs disabled:opacity-50">{saving ? 'Saving…' : (contact?.id ? 'Save' : 'Add')}</button>
      </div>
    </form>
  )

  if (inline) return <div className={wrapClass}>{inner}</div>

  return (
    <div className={wrapClass} onClick={onClose}>
      <div className="bg-white rounded-2xl w-full max-w-md p-5" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-display font-bold text-lg">{contact?.id ? 'Edit Contact' : 'Add Contact'}</h3>
          <button onClick={onClose}><X size={20} /></button>
        </div>
        {inner}
      </div>
    </div>
  )
}

function LocationModal({ customerId, location, onClose, onSaved, inline }) {
  const [label, setLabel] = useState(location?.label || '')
  const [address, setAddress] = useState(location?.address || '')
  const [notes, setNotes] = useState(location?.notes || '')
  const [isDefault, setIsDefault] = useState(location?.isDefault || false)
  const [saving, setSaving] = useState(false)

  async function submit(e) {
    e.preventDefault()
    setSaving(true)
    const body = { label: label.trim(), address: address.trim(), notes: notes.trim(), isDefault }
    if (location?.id) {
      await adminFetch(`/api/admin/customers/${customerId}/locations/${location.id}`, { method: 'PATCH', body: JSON.stringify(body) })
    } else {
      await adminFetch(`/api/admin/customers/${customerId}/locations`, { method: 'POST', body: JSON.stringify(body) })
    }
    setSaving(false)
    onSaved()
  }

  const wrapClass = inline
    ? 'p-3 rounded-lg border border-forest-200 bg-forest-50'
    : 'fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4'

  const inner = (
    <form onSubmit={submit} className="space-y-3">
      <input value={label} onChange={e => setLabel(e.target.value)} placeholder="Label (Home, Rental #2, Main Office…)" className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:border-forest-500 outline-none" />
      <input value={address} onChange={e => setAddress(e.target.value)} placeholder="Address" className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:border-forest-500 outline-none" />
      <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} placeholder="Notes (access code, dog on-site, etc.)" className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:border-forest-500 outline-none resize-none" />
      <label className="flex items-center gap-2 text-xs text-gray-700">
        <input type="checkbox" checked={isDefault} onChange={e => setIsDefault(e.target.checked)} />
        Default service location
      </label>
      <div className="flex gap-2">
        <button type="button" onClick={onClose} className="flex-1 py-2 rounded-lg border border-gray-200 text-xs font-medium hover:bg-gray-50">Cancel</button>
        <button type="submit" disabled={saving} className="flex-1 btn-primary py-2 text-xs disabled:opacity-50">{saving ? 'Saving…' : (location?.id ? 'Save' : 'Add')}</button>
      </div>
    </form>
  )

  if (inline) return <div className={wrapClass}>{inner}</div>

  return (
    <div className={wrapClass} onClick={onClose}>
      <div className="bg-white rounded-2xl w-full max-w-md p-5" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-display font-bold text-lg">{location?.id ? 'Edit Location' : 'Add Service Location'}</h3>
          <button onClick={onClose}><X size={20} /></button>
        </div>
        {inner}
      </div>
    </div>
  )
}
