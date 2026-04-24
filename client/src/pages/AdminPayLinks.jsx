import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, X, Copy, Trash2, Link2, CheckCircle2, Clock, Ban, DollarSign, ExternalLink, AlertCircle } from 'lucide-react'
import AdminLayout from '../components/AdminLayout'
import { adminFetch, getToken, formatCurrency, formatDate } from '../hooks/useAdmin'

const STATUS_BADGES = {
  pending:   { label: 'Pending',   color: 'bg-amber-100 text-amber-800', icon: Clock },
  paid:      { label: 'Paid',      color: 'bg-green-100 text-green-800', icon: CheckCircle2 },
  cancelled: { label: 'Cancelled', color: 'bg-gray-100 text-gray-700',   icon: Ban },
  expired:   { label: 'Expired',   color: 'bg-red-100 text-red-800',     icon: AlertCircle },
}

function NewPayLinkModal({ onClose, onCreated, appUrl }) {
  const [form, setForm] = useState({
    amount: '',
    description: 'Frontline Pest Control — Service Payment',
    customerName: '',
    customerEmail: '',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [created, setCreated] = useState(null)
  const [copied, setCopied] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSaving(true); setError('')
    const amt = Number(form.amount)
    if (!Number.isFinite(amt) || amt < 0.5) {
      setError('Amount must be at least $0.50')
      setSaving(false); return
    }
    const res = await adminFetch('/api/admin/pay-links', {
      method: 'POST',
      body: JSON.stringify({ ...form, amount: amt }),
    })
    setSaving(false)
    if (res?.success) {
      setCreated(res)
      onCreated?.()
    } else {
      setError(res?.error || 'Failed to create pay link')
    }
  }

  const copyUrl = async () => {
    if (!created?.publicUrl) return
    try {
      await navigator.clipboard.writeText(created.publicUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      prompt('Copy this link:', created.publicUrl)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl w-full max-w-lg" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-5 border-b">
          <h3 className="font-display font-bold text-lg">{created ? 'Pay Link Ready' : 'New Pay Link'}</h3>
          <button onClick={onClose}><X size={20} /></button>
        </div>

        {created ? (
          <div className="p-5 space-y-4">
            <div className="bg-green-50 border border-green-200 rounded-lg p-4 flex items-start gap-3">
              <CheckCircle2 size={20} className="text-green-600 shrink-0 mt-0.5" />
              <div>
                <div className="font-semibold text-green-900 text-sm">Pay link created</div>
                <div className="text-xs text-green-800 mt-0.5">
                  Text, email, or DM this link to the customer. They'll pay securely via Stripe and the payment will show up in your accounting automatically.
                </div>
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Pay Link URL</label>
              <div className="flex gap-2">
                <input
                  readOnly
                  value={created.publicUrl}
                  onClick={e => e.target.select()}
                  className="flex-1 px-3 py-2 rounded-lg border border-gray-200 text-sm font-mono bg-gray-50 focus:border-forest-500 outline-none"
                />
                <button
                  type="button"
                  onClick={copyUrl}
                  className={`px-3 py-2 rounded-lg text-xs font-medium inline-flex items-center gap-1 ${
                    copied
                      ? 'bg-green-100 text-green-800 border border-green-200'
                      : 'bg-forest-700 hover:bg-forest-800 text-white'
                  }`}
                >
                  {copied ? <><CheckCircle2 size={14} />Copied!</> : <><Copy size={14} />Copy</>}
                </button>
              </div>
            </div>

            <div className="bg-gray-50 rounded-lg p-3 text-sm space-y-1">
              <div className="flex justify-between"><span className="text-gray-500">Amount</span><span className="font-semibold">{formatCurrency(created.payLink.amount)}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">Description</span><span className="text-right max-w-[60%] truncate">{created.payLink.description}</span></div>
              {created.payLink.customerName && (
                <div className="flex justify-between"><span className="text-gray-500">Customer</span><span>{created.payLink.customerName}</span></div>
              )}
              {created.payLink.customerEmail && (
                <div className="flex justify-between"><span className="text-gray-500">Email</span><span>{created.payLink.customerEmail}</span></div>
              )}
            </div>

            <div className="flex gap-2 pt-2">
              <a
                href={`sms:?body=${encodeURIComponent(`Here's the payment link for Frontline Pest Control: ${created.publicUrl}`)}`}
                className="flex-1 inline-flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-white border border-gray-200 hover:bg-gray-50 text-sm font-medium"
              >
                Text to customer
              </a>
              <a
                href={`mailto:${created.payLink.customerEmail || ''}?subject=${encodeURIComponent('Payment Link — Frontline Pest Control')}&body=${encodeURIComponent(`Hi,\n\nHere's a secure link to pay for your service:\n\n${created.publicUrl}\n\nThanks,\nJimmy — Frontline Pest Control`)}`}
                className="flex-1 inline-flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-white border border-gray-200 hover:bg-gray-50 text-sm font-medium"
              >
                Email to customer
              </a>
            </div>
            <button
              onClick={onClose}
              className="w-full btn-primary py-2.5"
            >
              Done
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="p-5 space-y-4">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Amount *</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">$</span>
                <input
                  required
                  type="number"
                  step="0.01"
                  min="0.50"
                  value={form.amount}
                  onChange={e => setForm({ ...form, amount: e.target.value })}
                  placeholder="0.00"
                  className="w-full pl-7 pr-3 py-2 rounded-lg border border-gray-200 text-sm focus:border-forest-500 outline-none"
                />
              </div>
              <p className="text-[10px] text-gray-400 mt-0.5">Minimum $0.50 (Stripe's minimum charge).</p>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Description *</label>
              <input
                required
                value={form.description}
                onChange={e => setForm({ ...form, description: e.target.value })}
                placeholder="What's this payment for?"
                className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:border-forest-500 outline-none"
              />
              <p className="text-[10px] text-gray-400 mt-0.5">
                Shows up on the customer's Stripe Checkout page and receipt.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Customer Name</label>
                <input
                  value={form.customerName}
                  onChange={e => setForm({ ...form, customerName: e.target.value })}
                  placeholder="Optional"
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:border-forest-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Customer Email</label>
                <input
                  type="email"
                  value={form.customerEmail}
                  onChange={e => setForm({ ...form, customerEmail: e.target.value })}
                  placeholder="Optional"
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:border-forest-500 outline-none"
                />
              </div>
            </div>

            {error && <div className="text-xs text-red-600 bg-red-50 border border-red-200 rounded px-2 py-1.5">{error}</div>}

            <button type="submit" disabled={saving} className="w-full btn-primary py-2.5 disabled:opacity-50">
              {saving ? 'Creating…' : 'Create Pay Link'}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}

export default function AdminPayLinks() {
  const [links, setLinks] = useState([])
  const [loading, setLoading] = useState(true)
  const [showNew, setShowNew] = useState(false)
  const [stripeStatus, setStripeStatus] = useState({ configured: false, mode: 'unconfigured' })
  const [copiedId, setCopiedId] = useState(null)
  const navigate = useNavigate()

  const fetchLinks = useCallback(async () => {
    if (!getToken()) { navigate('/admin'); return }
    const [linksRes, stripeRes] = await Promise.all([
      adminFetch('/api/admin/pay-links'),
      adminFetch('/api/admin/stripe/status'),
    ])
    if (linksRes?.payLinks) setLinks(linksRes.payLinks)
    if (stripeRes) setStripeStatus(stripeRes)
    setLoading(false)
  }, [navigate])

  useEffect(() => { fetchLinks() }, [fetchLinks])

  const cancelLink = async (id) => {
    if (!confirm('Cancel this pay link? The URL will stop working immediately and the customer won\'t be able to pay with it.')) return
    await adminFetch(`/api/admin/pay-links/${id}`, { method: 'DELETE' })
    fetchLinks()
  }

  const copyLink = async (link) => {
    const url = `${window.location.origin}/pay/${link.payToken}`
    try {
      await navigator.clipboard.writeText(url)
      setCopiedId(link.id)
      setTimeout(() => setCopiedId(null), 2000)
    } catch {
      prompt('Copy this link:', url)
    }
  }

  if (loading) return <AdminLayout><div className="text-center py-20 text-gray-500">Loading…</div></AdminLayout>

  const pendingCount = links.filter(l => l.status === 'pending').length
  const paidCount = links.filter(l => l.status === 'paid').length
  const pendingAmount = links.filter(l => l.status === 'pending').reduce((s, l) => s + Number(l.amount), 0)
  const paidAmount = links.filter(l => l.status === 'paid').reduce((s, l) => s + Number(l.amount), 0)

  return (
    <AdminLayout>
      <div className="flex items-center justify-between gap-4 mb-6 flex-wrap">
        <div>
          <h2 className="font-display font-bold text-xl text-charcoal-900">Pay Links</h2>
          <p className="text-sm text-gray-500 mt-0.5">
            Ad-hoc payment links — no invoice needed. Text or email one to a customer for a quick collect.
          </p>
        </div>
        <button
          onClick={() => setShowNew(true)}
          disabled={!stripeStatus.configured}
          className="btn-primary text-xs py-1.5 px-3 disabled:opacity-50"
          title={stripeStatus.configured ? 'Create a new pay link' : 'Stripe not configured'}
        >
          <Plus size={14} />New Pay Link
        </button>
      </div>

      {!stripeStatus.configured && (
        <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-2.5 flex items-center gap-3 text-sm text-amber-900">
          <AlertCircle size={16} className="text-amber-600 shrink-0" />
          <div>
            <strong>Stripe is not configured.</strong> Add <code className="text-[11px] bg-amber-100 px-1 py-0.5 rounded">STRIPE_SECRET_KEY</code> to Railway environment variables to enable pay links.
          </div>
        </div>
      )}

      {/* Summary tiles */}
      {links.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm text-center">
            <div className="font-display font-bold text-xl text-charcoal-900">{links.length}</div>
            <div className="text-xs text-gray-500">Total Links</div>
          </div>
          <div className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm text-center">
            <div className="font-display font-bold text-xl text-amber-600">{pendingCount}</div>
            <div className="text-xs text-gray-500">Pending ({formatCurrency(pendingAmount)})</div>
          </div>
          <div className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm text-center">
            <div className="font-display font-bold text-xl text-green-600">{paidCount}</div>
            <div className="text-xs text-gray-500">Paid</div>
          </div>
          <div className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm text-center">
            <div className="font-display font-bold text-xl text-green-700">{formatCurrency(paidAmount)}</div>
            <div className="text-xs text-gray-500">Collected</div>
          </div>
        </div>
      )}

      {links.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-xl p-10 text-center">
          <Link2 className="text-gray-300 mx-auto mb-3" size={48} />
          <h3 className="font-display font-bold text-lg text-charcoal-900 mb-1">No pay links yet</h3>
          <p className="text-sm text-gray-500 mb-5">
            Create a pay link for quick customer payments &mdash; no invoice required.
          </p>
          <button
            onClick={() => setShowNew(true)}
            disabled={!stripeStatus.configured}
            className="btn-primary text-sm py-2 px-4 disabled:opacity-50"
          >
            <Plus size={14} />New Pay Link
          </button>
        </div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-100 text-[10px] uppercase tracking-wider text-gray-500">
              <tr>
                <th className="text-left px-4 py-2 font-semibold">Description</th>
                <th className="text-right px-4 py-2 font-semibold">Amount</th>
                <th className="text-left px-4 py-2 font-semibold hidden md:table-cell">Customer</th>
                <th className="text-left px-4 py-2 font-semibold">Status</th>
                <th className="text-left px-4 py-2 font-semibold hidden lg:table-cell">Created</th>
                <th className="w-48 px-4 py-2 font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {links.map(link => {
                const badge = STATUS_BADGES[link.status] || STATUS_BADGES.pending
                const Icon = badge.icon
                return (
                  <tr key={link.id} className={link.status === 'cancelled' ? 'opacity-60' : ''}>
                    <td className="px-4 py-3">
                      <div className="text-sm font-medium text-charcoal-900 line-clamp-1 max-w-xs">{link.description}</div>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="text-sm font-semibold text-charcoal-900">{formatCurrency(link.amount)}</div>
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell">
                      <div className="text-xs text-gray-700">{link.customerName || '—'}</div>
                      {link.customerEmail && <div className="text-[10px] text-gray-500 truncate max-w-[160px]">{link.customerEmail}</div>}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold ${badge.color}`}>
                        <Icon size={10} />{badge.label}
                      </span>
                    </td>
                    <td className="px-4 py-3 hidden lg:table-cell">
                      <div className="text-xs text-gray-500">{formatDate(link.createdAt)}</div>
                      {link.paidAt && <div className="text-[10px] text-green-700">Paid {formatDate(link.paidAt)}</div>}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1 flex-wrap">
                        {link.status === 'pending' && (
                          <>
                            <button
                              onClick={() => copyLink(link)}
                              title="Copy pay URL to clipboard"
                              className={`p-1.5 rounded text-gray-600 ${copiedId === link.id ? 'bg-green-100 text-green-700' : 'hover:bg-gray-100'}`}
                            >
                              {copiedId === link.id ? <CheckCircle2 size={14} /> : <Copy size={14} />}
                            </button>
                            <a
                              href={`/pay/${link.payToken}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              title="Open pay page in new tab"
                              className="p-1.5 rounded hover:bg-gray-100 text-gray-600"
                            >
                              <ExternalLink size={14} />
                            </a>
                            <button
                              onClick={() => cancelLink(link.id)}
                              title="Cancel this pay link"
                              className="p-1.5 rounded hover:bg-red-50 text-red-600"
                            >
                              <Trash2 size={14} />
                            </button>
                          </>
                        )}
                        {link.status === 'paid' && (
                          <span className="inline-flex items-center gap-1 text-xs text-green-700 font-medium">
                            <DollarSign size={12} />Settled
                          </span>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {showNew && (
        <NewPayLinkModal
          onClose={() => setShowNew(false)}
          onCreated={fetchLinks}
          appUrl={window.location.origin}
        />
      )}
    </AdminLayout>
  )
}
