// Stripe wrapper — single place where we talk to Stripe's API.
//
// Keys come from env vars, never checked in. The module stays dormant
// when STRIPE_SECRET_KEY is missing: isConfigured() returns false,
// other helpers throw a clear "Stripe not configured" error. That way
// the rest of the app can keep working locally / in preview deploys
// without crashing.
//
// Sync contract:
//   - Services → auto-create matching Product + Price in Stripe. Price
//     changes mean creating a new Price and archiving the old one
//     (Stripe Prices are immutable — you can't mutate the amount).
//   - Invoices → create Checkout Sessions on demand for pay links.
//   - Webhooks → verify signature, parse event, let caller handle it.
//
// This file never stores card data; it all lives on Stripe's side. The
// most sensitive thing we see is the customer email and payment_intent
// ID, both of which we can safely store.

const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY || null;
const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET || null;
const STRIPE_PUBLISHABLE_KEY = process.env.STRIPE_PUBLISHABLE_KEY || null;
const APP_URL = (process.env.APP_URL || 'http://localhost:5173').replace(/\/$/, '');

let stripe = null;
let initError = null;
if (STRIPE_SECRET_KEY) {
  try {
    const Stripe = require('stripe');
    stripe = new Stripe(STRIPE_SECRET_KEY, {
      apiVersion: '2024-11-20.acacia',
      appInfo: {
        name: 'Frontline Pest Control Admin',
        version: '1.0.0',
      },
    });
    const mode = STRIPE_SECRET_KEY.startsWith('sk_live_') ? 'LIVE' : 'TEST';
    console.log(`[stripe] SDK initialised in ${mode} mode.`);
  } catch (err) {
    initError = err;
    console.error('[stripe] Failed to initialise SDK:', err.message);
  }
} else {
  console.log('[stripe] STRIPE_SECRET_KEY not set — Stripe features disabled.');
}

function isConfigured() {
  return !!stripe;
}

function getClient() {
  if (!stripe) {
    throw new Error(
      initError
        ? `Stripe SDK failed to initialise: ${initError.message}`
        : 'Stripe is not configured. Set STRIPE_SECRET_KEY in your environment.'
    );
  }
  return stripe;
}

function mode() {
  if (!STRIPE_SECRET_KEY) return 'unconfigured';
  return STRIPE_SECRET_KEY.startsWith('sk_live_') ? 'live' : 'test';
}

// ============================================================
// Service catalog sync
// ============================================================

// Create or update a Stripe Product and matching Price for a service.
// Returns the IDs to stamp back onto the service record.
//
// Behaviour:
//   - If service has no stripeProductId: create new Product + Price.
//   - If service has stripeProductId but it's been deleted in Stripe:
//     create new Product + Price (self-healing).
//   - If service has stripeProductId but amount changed: create new
//     Price, archive old Price, keep same Product.
//   - If name/description changed: update Product in place.
//   - If amount unchanged: just update Product, reuse Price.
async function syncServiceToStripe(service) {
  const client = getClient();
  const amountCents = Math.round(Number(service.defaultPrice) * 100);
  if (!Number.isFinite(amountCents) || amountCents < 0) {
    throw new Error(`Invalid price on service "${service.name}": ${service.defaultPrice}`);
  }

  // --- Product ---
  let productId = service.stripeProductId || null;

  if (productId) {
    try {
      await client.products.update(productId, {
        name: service.name,
        description: service.description || undefined,
        active: service.active !== false,
        metadata: {
          frontline_service_id: service.id,
          frontline_category: service.category || 'other',
        },
      });
    } catch (err) {
      if (err.code === 'resource_missing') {
        productId = null; // recreate below
      } else {
        throw err;
      }
    }
  }

  if (!productId) {
    const product = await client.products.create({
      name: service.name,
      description: service.description || undefined,
      active: service.active !== false,
      metadata: {
        frontline_service_id: service.id,
        frontline_category: service.category || 'other',
      },
    });
    productId = product.id;
  }

  // --- Price ---
  // Prices are immutable. If the existing stored price matches the
  // current amount (and is still active), reuse it. Otherwise archive
  // the old price and create a new one.
  let priceId = service.stripePriceId || null;
  let reusingPrice = false;

  if (priceId) {
    try {
      const existing = await client.prices.retrieve(priceId);
      if (
        existing.active &&
        existing.unit_amount === amountCents &&
        existing.currency === 'usd' &&
        existing.product === productId
      ) {
        reusingPrice = true;
      } else {
        // Archive the old price so Stripe dashboards show only the current one.
        try {
          await client.prices.update(priceId, { active: false });
        } catch (_) { /* best-effort */ }
      }
    } catch (err) {
      if (err.code !== 'resource_missing') throw err;
      // price was deleted — fall through and create a new one
    }
  }

  if (!reusingPrice) {
    const price = await client.prices.create({
      product: productId,
      unit_amount: amountCents,
      currency: 'usd',
      metadata: {
        frontline_service_id: service.id,
      },
    });
    priceId = price.id;
  }

  return {
    stripeProductId: productId,
    stripePriceId: priceId,
    stripeSyncedAt: new Date().toISOString(),
  };
}

// Archive a service's Product + Price in Stripe (called when the
// service is deleted locally). Stripe doesn't allow hard-deletion of
// products that have been used on invoices, so we archive instead.
async function archiveServiceInStripe(service) {
  if (!service.stripeProductId) return { archived: false };
  const client = getClient();
  try {
    await client.products.update(service.stripeProductId, { active: false });
    if (service.stripePriceId) {
      try {
        await client.prices.update(service.stripePriceId, { active: false });
      } catch (_) { /* best-effort */ }
    }
    return { archived: true };
  } catch (err) {
    if (err.code === 'resource_missing') return { archived: false };
    throw err;
  }
}

// ============================================================
// Checkout Sessions (pay links)
// ============================================================

// Create a Stripe Checkout Session for an invoice. Line items map 1:1 to
// the invoice's items, with tax folded in as a separate line so the total
// lines up exactly with what the customer sees in Stripe Checkout.
//
// Returns { sessionId, url, expiresAt } — the URL is the customer's pay page.
async function createCheckoutSessionForInvoice(invoice, { successUrl, cancelUrl } = {}) {
  const client = getClient();

  const lineItems = (invoice.items || []).map((item) => ({
    price_data: {
      currency: 'usd',
      product_data: {
        name: item.description || 'Service',
      },
      unit_amount: Math.round(Number(item.rate) * 100),
    },
    quantity: Math.max(1, Math.round(Number(item.quantity) || 1)),
  }));

  // Tax as its own line — keeps totals transparent to the customer and
  // matches the invoice they received to the penny.
  const taxAmount = Math.round(Number(invoice.tax || 0) * 100);
  if (taxAmount > 0) {
    const taxPct = (Number(invoice.taxRate || 0.085) * 100).toFixed(2).replace(/\.?0+$/, '');
    lineItems.push({
      price_data: {
        currency: 'usd',
        product_data: { name: `Sales Tax (${taxPct}%)` },
        unit_amount: taxAmount,
      },
      quantity: 1,
    });
  }

  const session = await client.checkout.sessions.create({
    mode: 'payment',
    line_items: lineItems,
    success_url: successUrl,
    cancel_url: cancelUrl,
    customer_email: invoice.customerEmail || undefined,
    metadata: {
      frontline_invoice_id: invoice.id,
      frontline_invoice_number: invoice.invoiceNumber,
      frontline_kind: 'invoice',
    },
    payment_intent_data: {
      description: `Invoice ${invoice.invoiceNumber} — ${invoice.customerName}`,
      metadata: {
        frontline_invoice_id: invoice.id,
        frontline_invoice_number: invoice.invoiceNumber,
      },
    },
  });

  return {
    sessionId: session.id,
    url: session.url,
    expiresAt: session.expires_at ? new Date(session.expires_at * 1000).toISOString() : null,
  };
}

// Create a Stripe Checkout Session for a standalone pay link (no
// invoice attached). Used for ad-hoc charges Jimmy texts to a customer.
async function createStandalonePayLinkSession({ amount, description, customerEmail, successUrl, cancelUrl, metadata = {} }) {
  const client = getClient();
  const amountCents = Math.round(Number(amount) * 100);
  if (!Number.isFinite(amountCents) || amountCents < 50) {
    // Stripe's minimum charge is $0.50 USD.
    throw new Error('Amount must be at least $0.50');
  }

  const session = await client.checkout.sessions.create({
    mode: 'payment',
    line_items: [{
      price_data: {
        currency: 'usd',
        product_data: { name: description || 'Frontline Pest Control Payment' },
        unit_amount: amountCents,
      },
      quantity: 1,
    }],
    success_url: successUrl,
    cancel_url: cancelUrl,
    customer_email: customerEmail || undefined,
    metadata: { ...metadata, frontline_kind: 'standalone' },
    payment_intent_data: {
      description: description || 'Frontline Pest Control Payment',
      metadata: { ...metadata, frontline_kind: 'standalone' },
    },
  });

  return {
    sessionId: session.id,
    url: session.url,
    expiresAt: session.expires_at ? new Date(session.expires_at * 1000).toISOString() : null,
  };
}

// Retrieve the latest state of a Checkout Session (used for the return
// flow — after the customer lands back on our success page, we look up
// the session and verify payment_status === 'paid' before thanking them).
async function retrieveCheckoutSession(sessionId) {
  const client = getClient();
  return client.checkout.sessions.retrieve(sessionId);
}

// ============================================================
// Webhooks
// ============================================================

// Verify the Stripe-Signature header and return the parsed event.
// `rawBody` MUST be a Buffer (not a JSON-parsed object) — that's why
// the webhook route uses express.raw() instead of express.json().
function verifyWebhookSignature(rawBody, signature) {
  if (!stripe) throw new Error('Stripe not configured');
  if (!STRIPE_WEBHOOK_SECRET) {
    throw new Error('STRIPE_WEBHOOK_SECRET not set — cannot verify webhooks');
  }
  return stripe.webhooks.constructEvent(rawBody, signature, STRIPE_WEBHOOK_SECRET);
}

module.exports = {
  isConfigured,
  getClient,
  mode,
  syncServiceToStripe,
  archiveServiceInStripe,
  createCheckoutSessionForInvoice,
  createStandalonePayLinkSession,
  retrieveCheckoutSession,
  verifyWebhookSignature,
  // Exposed for URL construction in route handlers
  APP_URL,
  STRIPE_PUBLISHABLE_KEY,
};
