import { useEffect, useState } from 'react'
import { useParams, useSearchParams, Link } from 'react-router-dom'
import { CheckCircle2, AlertCircle, Lock, Phone, Mail, Clock } from 'lucide-react'
import { LogoIcon } from '../components/Logo'

// Customer-facing pay page. Served at /pay/:token with NO admin auth —
// customers land here from the "Pay Online" button in invoice emails or
// a pay link Jimmy texted them.
//
// Flow:
//   1. Fetch /api/pay/:token to load invoice/pay-link details
//   2. Show a branded summary (customer name, items, total, balance)
//   3. Click "Pay Now" → redirect to Stripe Checkout (their hosted page)
//   4. Stripe redirects back to /pay/:token/success after payment
//   5. Success view shows confirmation while the webhook records the
//      payment in the admin ledger in the background

function formatCurrency(n) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(Number(n || 0))
}

function formatDate(d) {
  if (!d) return ''
  return new Date(d).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
}

export default function PublicPayPage({ mode = 'pay' }) {
  const { token } = useParams()
  const [searchParams] = useSearchParams()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [redirecting, setRedirecting] = useState(false)

  // On success, the session_id is included in the URL by Stripe. We
  // don't actually need to verify it client-side — the webhook already
  // recorded the payment server-side before the redirect. But we show
  // it as a nice confirmation anyway.
  const sessionId = searchParams.get('session_id')

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const res = await fetch(`/api/pay/${encodeURIComponent(token)}`)
        if (!res.ok) {
          const body = await res.json().catch(() => ({}))
          if (!cancelled) setError(body.error || 'This payment link is no longer valid.')
        } else {
          const body = await res.json()
          if (!cancelled) setData(body)
        }
      } catch {
        if (!cancelled) setError('We couldn\'t load your payment details. Please try again, or call us.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [token])

  const handlePay = async () => {
    setRedirecting(true)
    try {
      // Use the cached session URL if we have one, otherwise refresh.
      let checkoutUrl = data?.stripeCheckoutUrl
      if (!checkoutUrl) {
        const res = await fetch(`/api/pay/${encodeURIComponent(token)}/refresh`, { method: 'POST' })
        const body = await res.json()
        if (!res.ok) throw new Error(body.error || 'Failed to prepare payment')
        checkoutUrl = body.stripeCheckoutUrl
      }
      if (!checkoutUrl) throw new Error('No checkout URL returned')
      window.location.href = checkoutUrl
    } catch (err) {
      setError(err.message)
      setRedirecting(false)
    }
  }

  // ---------- Loading and error states ----------
  if (loading) {
    return (
      <PageShell>
        <div className="text-center py-12">
          <div className="animate-pulse text-gray-500">Loading your payment details…</div>
        </div>
      </PageShell>
    )
  }
  if (error || !data) {
    return (
      <PageShell>
        <div className="text-center py-12">
          <AlertCircle size={48} className="text-amber-500 mx-auto mb-4" />
          <h2 className="font-display font-bold text-xl text-charcoal-900 mb-2">Payment link unavailable</h2>
          <p className="text-gray-600 mb-6">{error || 'This pay link is no longer valid.'}</p>
          <p className="text-sm text-gray-500">
            Please call us at <a href="tel:4055311034" className="text-forest-700 font-semibold">(405) 531-1034</a> or
            email <a href="mailto:info@frontlinepestok.com" className="text-forest-700 font-semibold">info@frontlinepestok.com</a> and
            we'll get you sorted.
          </p>
        </div>
      </PageShell>
    )
  }

  // ---------- Success page (after Stripe redirect) ----------
  if (mode === 'success') {
    return (
      <PageShell>
        <div className="text-center py-8">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-green-100 mb-4">
            <CheckCircle2 size={48} className="text-green-600" />
          </div>
          <h2 className="font-display font-bold text-2xl text-charcoal-900 mb-2">Payment Received</h2>
          <p className="text-gray-600 mb-6">
            Thank you! Your payment has been processed successfully.
            {data.kind === 'invoice' && data.invoiceNumber && (
              <> A receipt for invoice <strong>{data.invoiceNumber}</strong> has been emailed to you by Stripe.</>
            )}
          </p>
          {sessionId && (
            <p className="text-[11px] text-gray-400 font-mono mb-6 break-all">
              Confirmation: {sessionId}
            </p>
          )}
          <div className="bg-gray-50 rounded-lg p-5 text-left max-w-md mx-auto">
            <div className="text-xs uppercase tracking-wider text-gray-500 font-semibold mb-2">What happens next</div>
            <ul className="text-sm text-gray-700 space-y-2">
              <li className="flex gap-2">
                <span className="text-green-600">•</span>
                <span>Jimmy will be notified of your payment right away.</span>
              </li>
              <li className="flex gap-2">
                <span className="text-green-600">•</span>
                <span>You'll get a Stripe-generated email receipt within a few minutes.</span>
              </li>
              <li className="flex gap-2">
                <span className="text-green-600">•</span>
                <span>Your records with Frontline will reflect the payment automatically.</span>
              </li>
            </ul>
          </div>
          <div className="mt-8 pt-6 border-t border-gray-200 text-center">
            <p className="text-xs text-gray-500">
              Questions? Call <a href="tel:4055311034" className="text-forest-700 font-semibold">(405) 531-1034</a>
            </p>
          </div>
        </div>
      </PageShell>
    )
  }

  // ---------- Already paid state ----------
  const isInvoicePaid = data.kind === 'invoice' && data.balance != null && data.balance <= 0.005
  const isStandalonePaid = data.kind === 'standalone' && data.status === 'paid'
  if (isInvoicePaid || isStandalonePaid) {
    return (
      <PageShell>
        <div className="text-center py-8">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-green-100 mb-4">
            <CheckCircle2 size={48} className="text-green-600" />
          </div>
          <h2 className="font-display font-bold text-2xl text-charcoal-900 mb-2">Already Paid</h2>
          <p className="text-gray-600 mb-6">
            {data.kind === 'invoice'
              ? `Invoice ${data.invoiceNumber} was paid in full${data.paidAt ? ` on ${formatDate(data.paidAt)}` : ''}. Thank you!`
              : `This payment was completed${data.paidAt ? ` on ${formatDate(data.paidAt)}` : ''}. Thank you!`
            }
          </p>
          <p className="text-sm text-gray-500">
            Questions? Call <a href="tel:4055311034" className="text-forest-700 font-semibold">(405) 531-1034</a>
          </p>
        </div>
      </PageShell>
    )
  }

  // ---------- Cancelled standalone ----------
  if (data.kind === 'standalone' && data.status === 'cancelled') {
    return (
      <PageShell>
        <div className="text-center py-8">
          <AlertCircle size={48} className="text-gray-400 mx-auto mb-4" />
          <h2 className="font-display font-bold text-xl text-charcoal-900 mb-2">This pay link was cancelled</h2>
          <p className="text-gray-600">Please contact us if you still need to make a payment.</p>
          <p className="text-sm text-gray-500 mt-4">
            <a href="tel:4055311034" className="text-forest-700 font-semibold">(405) 531-1034</a>
          </p>
        </div>
      </PageShell>
    )
  }

  // ---------- Main pay view ----------
  const isInvoice = data.kind === 'invoice'
  const amountToPay = isInvoice ? data.balance : data.amount
  const customerDisplayName = data.customerName || 'Customer'

  return (
    <PageShell>
      {/* Heading */}
      <div className="mb-6">
        <div className="text-xs text-gray-500 uppercase tracking-wider font-semibold mb-1">
          {isInvoice ? 'Secure Payment Link' : 'Payment Request'}
        </div>
        <h1 className="font-display font-bold text-2xl text-charcoal-900">
          {isInvoice ? `Invoice ${data.invoiceNumber}` : data.description}
        </h1>
        <p className="text-sm text-gray-600 mt-1">
          From Frontline Termite &amp; Pest Control to <strong>{customerDisplayName}</strong>
        </p>
      </div>

      {/* Invoice line items (only for invoices) */}
      {isInvoice && data.items?.length > 0 && (
        <div className="bg-gray-50 rounded-lg p-4 mb-4">
          <div className="text-[10px] uppercase tracking-wider text-gray-500 font-semibold mb-2">Services</div>
          <div className="space-y-1.5">
            {data.items.map((item, i) => (
              <div key={i} className="flex justify-between text-sm">
                <span className="text-gray-700 pr-2">
                  {item.description}
                  {item.quantity > 1 && <span className="text-gray-400"> × {item.quantity}</span>}
                </span>
                <span className="text-charcoal-900 font-medium whitespace-nowrap">
                  {formatCurrency(item.amount)}
                </span>
              </div>
            ))}
          </div>
          <div className="border-t border-gray-200 mt-2 pt-2 space-y-1 text-sm">
            {/* Only show the Subtotal + Tax rows when tax > 0; tax-exempt
                invoices go straight to Total so the summary stays clean. */}
            {data.tax > 0 && (
              <>
                <div className="flex justify-between text-gray-600">
                  <span>Subtotal</span>
                  <span>{formatCurrency(data.subtotal)}</span>
                </div>
                <div className="flex justify-between text-gray-600">
                  <span>Tax ({((data.taxRate || 0) * 100).toFixed(2).replace(/\.?0+$/, '')}%)</span>
                  <span>{formatCurrency(data.tax)}</span>
                </div>
              </>
            )}
            <div className="flex justify-between font-bold text-charcoal-900 pt-1 border-t border-gray-200">
              <span>Total</span>
              <span>{formatCurrency(data.total)}</span>
            </div>
            {data.paidAmount > 0 && (
              <>
                <div className="flex justify-between text-green-700">
                  <span>Already paid</span>
                  <span>−{formatCurrency(data.paidAmount)}</span>
                </div>
                <div className="flex justify-between font-bold text-forest-700 pt-1 border-t border-forest-200">
                  <span>Balance due</span>
                  <span>{formatCurrency(data.balance)}</span>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Due date for invoices */}
      {isInvoice && data.dueDate && (
        <div className="flex items-center gap-2 text-sm text-gray-500 mb-6">
          <Clock size={14} />
          Due {formatDate(data.dueDate)}
        </div>
      )}

      {/* Pay button */}
      <button
        onClick={handlePay}
        disabled={redirecting}
        className="w-full bg-forest-700 hover:bg-forest-800 disabled:opacity-50 text-white font-bold py-4 px-6 rounded-lg text-lg flex items-center justify-center gap-2 transition-colors"
      >
        <Lock size={18} />
        {redirecting ? 'Redirecting…' : `Pay ${formatCurrency(amountToPay)} Now`}
      </button>
      <p className="text-center text-xs text-gray-500 mt-2">
        Secure checkout powered by Stripe. We never see your card details.
      </p>

      {/* Fallback contact */}
      <div className="mt-8 pt-6 border-t border-gray-200">
        <div className="text-xs uppercase tracking-wider text-gray-500 font-semibold mb-3 text-center">
          Prefer to pay another way?
        </div>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <a
            href="tel:4055311034"
            className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-white border border-gray-200 hover:bg-gray-50 text-charcoal-900 text-sm font-medium"
          >
            <Phone size={14} /> (405) 531-1034
          </a>
          <a
            href="mailto:info@frontlinepestok.com"
            className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-white border border-gray-200 hover:bg-gray-50 text-charcoal-900 text-sm font-medium"
          >
            <Mail size={14} /> info@frontlinepestok.com
          </a>
        </div>
      </div>
    </PageShell>
  )
}

// Shared wrapper that renders the branded Frontline page chrome around
// whatever state the pay page is in (loading, error, success, pay,
// already-paid, cancelled).
function PageShell({ children }) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-charcoal-900 via-charcoal-950 to-forest-900 flex items-center justify-center p-4">
      <div className="w-full max-w-xl">
        {/* Logo header */}
        <div className="text-center mb-6">
          <Link to="/" className="inline-flex items-center gap-2 text-white">
            <LogoIcon size={44} />
            <div className="text-left leading-tight">
              <div className="font-display font-extrabold text-lg tracking-tight">FRONTLINE</div>
              <div className="text-[10px] text-forest-300 font-medium tracking-wide uppercase">Termite &amp; Pest Control</div>
            </div>
          </Link>
        </div>

        {/* Card */}
        <div className="bg-white rounded-2xl shadow-2xl p-6 md:p-8">
          {children}
        </div>

        {/* Footer */}
        <p className="text-center text-xs text-gray-400 mt-4">
          Edmond, Oklahoma &mdash; Licensed &amp; Insured
        </p>
      </div>
    </div>
  )
}
