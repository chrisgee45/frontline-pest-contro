// Standalone pay links — ad-hoc payment requests that aren't tied to
// a formal invoice. Use case: Jimmy finishes a quick cash-call, doesn't
// want to go through the whole invoice flow, just wants to text the
// customer a link that says "pay me $75".
//
// Data model:
//
//   pay_links {
//     id,                    // internal UUID
//     payToken,              // unguessable UUID, used in the public URL
//     amount,                // dollars (float)
//     description,           // what the customer sees on Stripe Checkout
//     customerName,          // optional — just for Jimmy's records
//     customerEmail,         // optional — pre-fills Checkout
//     status,                // 'pending' | 'paid' | 'cancelled' | 'expired'
//     stripeSessionId,       // latest Stripe Checkout Session ID
//     stripeSessionUrl,      // latest Checkout URL
//     stripeSessionExpiresAt,// Stripe sessions expire after 24h
//     paidAt,                // ISO timestamp, set by webhook
//     stripePaymentIntentId, // populated by webhook
//     paymentId,             // if we also created an invoice+payment shadow
//     invoiceId,             // if we created a shadow invoice on successful pay
//     createdAt,
//     cancelledAt,
//   }
//
// Invoice pay links are NOT stored here — those stamp fields directly
// onto the invoice record (payToken, stripeSessionId, etc.).

const crypto = require('crypto');
const { repo } = require('./repo');

const payLinksRepo = repo('pay_links', {
  auditRecordType: 'pay_link',
  describeCreate: (pl) => `Created pay link: $${Number(pl.amount).toFixed(2)} — ${pl.description}`,
  describeUpdate: (pl) => `Updated pay link (${pl.id.slice(0, 8)})`,
  describeDelete: (pl) => `Cancelled pay link: $${Number(pl.amount).toFixed(2)}`,
});

function listPayLinks() {
  return payLinksRepo.all();
}

function getPayLink(id) {
  return payLinksRepo.find(id);
}

function getPayLinkByToken(token) {
  if (!token) return null;
  return payLinksRepo.findWhere((pl) => pl.payToken === token)[0] || null;
}

function createPayLink(data, ctx = {}) {
  const amount = Number(data.amount);
  if (!Number.isFinite(amount) || amount < 0.5) {
    throw new Error('Amount must be at least $0.50');
  }
  const description = String(data.description || '').trim() || 'Frontline Pest Control Payment';

  return payLinksRepo.create(
    {
      payToken: crypto.randomUUID(),
      amount: Math.round(amount * 100) / 100,
      description,
      customerName: String(data.customerName || '').trim(),
      customerEmail: String(data.customerEmail || '').trim(),
      status: 'pending',
      stripeSessionId: null,
      stripeSessionUrl: null,
      stripeSessionExpiresAt: null,
      paidAt: null,
      stripePaymentIntentId: null,
      paymentId: null,
      invoiceId: null,
    },
    ctx
  );
}

function updatePayLink(id, patch, ctx = {}) {
  const existing = payLinksRepo.find(id);
  if (!existing) return null;
  return payLinksRepo.update(id, patch, ctx);
}

function cancelPayLink(id, ctx = {}) {
  const existing = payLinksRepo.find(id);
  if (!existing) return null;
  if (existing.status === 'paid') {
    throw new Error('Cannot cancel a pay link that has already been paid');
  }
  return payLinksRepo.update(
    id,
    { status: 'cancelled', cancelledAt: new Date().toISOString() },
    ctx
  );
}

module.exports = {
  listPayLinks,
  getPayLink,
  getPayLinkByToken,
  createPayLink,
  updatePayLink,
  cancelPayLink,
  _repo: payLinksRepo,
};
