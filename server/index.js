const express = require('express');
const cors = require('cors');
const path = require('path');
const crypto = require('crypto');

const { readJSON, writeJSON } = require('./data-dir');
const { repo } = require('./repo');
const { recordAudit, queryAudit, listDistinct } = require('./audit-helpers');
const customers = require('./customers');
const services = require('./services');
const backup = require('./backup');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// --- Collections routed through the audited repo layer ---
const leadsRepo = repo('leads');
const jobsRepo = repo('jobs');
const invoicesRepo = repo('invoices');
const transactionsRepo = repo('transactions');
const paymentsRepo = repo('payments');

// Admin credentials (stored in JSON, supports password changes)
function getAdminCreds() {
  return readJSON('admin_creds', {
    email: 'jmanharth@gmail.com',
    password: 'Password26!',
    name: 'Jimmy Manharth',
  });
}

// Pull the actor (username/email) out of the request's bearer token.
// Used to stamp audit events with who performed the action.
function actorFromReq(req) {
  const h = req.headers.authorization;
  if (!h || !h.startsWith('Bearer ')) return 'anonymous';
  const token = h.split(' ')[1];
  const sessions = readJSON('sessions', []);
  const session = sessions.find(s => s.token === token);
  return session?.actor || 'admin';
}

// --- Auth ---
app.post('/api/admin/login', (req, res) => {
  const { email, password, username } = req.body;
  const creds = getAdminCreds();
  // Support both email and legacy username login
  const emailMatch = email && email.toLowerCase() === creds.email.toLowerCase();
  const legacyMatch = username && (username === 'jimmy' || username.toLowerCase() === creds.email.toLowerCase());
  if ((emailMatch || legacyMatch) && password === creds.password) {
    const token = crypto.randomBytes(32).toString('hex');
    const sessions = readJSON('sessions', []);
    sessions.push({ token, actor: creds.email, createdAt: new Date().toISOString() });
    writeJSON('sessions', sessions);

    recordAudit({
      action: 'login',
      recordType: 'session',
      recordId: token.slice(0, 8),
      actor: creds.email,
      description: `Login: ${creds.email}`,
    });

    return res.json({ success: true, token, name: creds.name, email: creds.email });
  }
  // Log the failed attempt (without leaking the password)
  recordAudit({
    action: 'login_failed',
    recordType: 'session',
    actor: email || username || 'unknown',
    description: `Failed login attempt for ${email || username || 'unknown'}`,
  });
  res.status(401).json({ error: 'Invalid email or password' });
});

app.post('/api/admin/logout', (req, res) => {
  const h = req.headers.authorization;
  if (!h || !h.startsWith('Bearer ')) return res.status(401).json({ error: 'Unauthorized' });
  const token = h.split(' ')[1];
  const sessions = readJSON('sessions', []);
  const idx = sessions.findIndex(s => s.token === token);
  if (idx < 0) return res.status(401).json({ error: 'Invalid token' });
  const session = sessions[idx];
  sessions.splice(idx, 1);
  writeJSON('sessions', sessions);

  recordAudit({
    action: 'logout',
    recordType: 'session',
    recordId: token.slice(0, 8),
    actor: session.actor || 'admin',
    description: `Logout: ${session.actor || 'admin'}`,
  });

  res.json({ success: true });
});

// Change password
app.post('/api/admin/change-password', (req, res) => {
  const h = req.headers.authorization;
  if (!h || !h.startsWith('Bearer ')) return res.status(401).json({ error: 'Unauthorized' });
  const token = h.split(' ')[1];
  const sessions = readJSON('sessions', []);
  const session = sessions.find(s => s.token === token);
  if (!session) return res.status(401).json({ error: 'Unauthorized' });

  const { currentPassword, newPassword } = req.body;
  const creds = getAdminCreds();

  if (currentPassword !== creds.password) {
    return res.status(400).json({ error: 'Current password is incorrect' });
  }
  if (!newPassword || newPassword.length < 6) {
    return res.status(400).json({ error: 'New password must be at least 6 characters' });
  }

  creds.password = newPassword;
  writeJSON('admin_creds', creds);

  recordAudit({
    action: 'update',
    recordType: 'settings',
    recordId: 'password',
    actor: session.actor || 'admin',
    description: 'Password changed',
  });

  res.json({ success: true, message: 'Password updated successfully' });
});

// Get admin profile
app.get('/api/admin/profile', (req, res) => {
  const h = req.headers.authorization;
  if (!h || !h.startsWith('Bearer ')) return res.status(401).json({ error: 'Unauthorized' });
  const token = h.split(' ')[1];
  const sessions = readJSON('sessions', []);
  if (!sessions.some(s => s.token === token)) return res.status(401).json({ error: 'Unauthorized' });

  const creds = getAdminCreds();
  res.json({ name: creds.name, email: creds.email });
});

function auth(req, res, next) {
  const h = req.headers.authorization;
  if (!h || !h.startsWith('Bearer ')) return res.status(401).json({ error: 'Unauthorized' });
  const token = h.split(' ')[1];
  const sessions = readJSON('sessions', []);
  if (!sessions.some(s => s.token === token)) return res.status(401).json({ error: 'Invalid token' });
  next();
}

// ===================
// CONTACT / LEADS API
// ===================
app.post('/api/contact', (req, res) => {
  const { name, email, phone, address, service, urgency, message } = req.body;
  if (!name || !phone) return res.status(400).json({ error: 'Name and phone are required.' });

  // Customer management — find an existing household by phone/email or
  // create a new one. `matched` tells us to flag the lead with the
  // auto-link banner when the frontend renders it.
  const match = customers.findOrCreateCustomer(
    { name, email, phone, address },
    { actor: 'public_form' }
  );

  const lead = leadsRepo.create(
    {
      name,
      email: email || '',
      phone,
      address: address || '',
      service: service || 'General',
      urgency: urgency || '',
      message: message || '',
      status: 'new',
      notes: '',
      jobId: null,
      customerId: match.customer.id,
      contactId: match.contact?.id || null,
      autoLinkedCustomerId: match.matched ? match.customer.id : null,
      matchedBy: match.matchedBy || null,
    },
    {
      actor: 'public_form',
      description: match.matched
        ? `New lead from ${name} — matched to existing customer ${match.customer.displayName} by ${match.matchedBy}`
        : `New lead from ${name} (${service || 'General'}) — new customer created`,
    }
  );

  // Send email notification (async — don't block response)
  try {
    const { sendLeadNotification } = require('./email');
    sendLeadNotification(lead).catch(err => console.error('Lead email error:', err));
  } catch (e) {
    // email module may not be present in tests; safe to ignore
  }

  res.json({ success: true, message: 'Thank you! We will contact you shortly.' });
});

app.get('/api/admin/leads', auth, (req, res) => {
  res.json({ leads: leadsRepo.all() });
});

app.patch('/api/admin/leads/:id', auth, (req, res) => {
  const lead = leadsRepo.find(req.params.id);
  if (!lead) return res.status(404).json({ error: 'Lead not found' });

  // Block direct 'converted' status changes — converted is only settable
  // as a side-effect of POST /api/admin/leads/:id/convert. (Phase 1.7)
  if (req.body.status === 'converted' && !lead.jobId) {
    return res.status(409).json({
      error: "A lead becomes 'Converted' only after Convert to Job is run. Use POST /api/admin/leads/:id/convert instead.",
    });
  }

  const patch = {};
  if (req.body.status !== undefined) patch.status = req.body.status;
  if (req.body.notes !== undefined) patch.notes = req.body.notes;
  if (req.body.name !== undefined) patch.name = req.body.name;
  if (req.body.email !== undefined) patch.email = req.body.email;
  if (req.body.phone !== undefined) patch.phone = req.body.phone;

  const updated = leadsRepo.update(req.params.id, patch, { actor: actorFromReq(req) });
  res.json({ success: true, lead: updated });
});

app.delete('/api/admin/leads/:id', auth, (req, res) => {
  const ok = leadsRepo.delete(req.params.id, { actor: actorFromReq(req) });
  if (!ok) return res.status(404).json({ error: 'Lead not found' });
  res.json({ success: true });
});

// ===================
// JOBS API
// ===================
app.get('/api/admin/jobs', auth, (req, res) => {
  res.json({ jobs: jobsRepo.all() });
});

app.post('/api/admin/jobs', auth, (req, res) => {
  const { customerName, address, phone, email, serviceType, scheduledDate, assignedTech, notes, status, customerId: providedCustomerId } = req.body;
  if (!customerName || !serviceType) return res.status(400).json({ error: 'Customer name and service type required' });

  const actor = actorFromReq(req);

  // Customer resolution. If the caller already knows the customerId
  // (e.g. from a "New Job for Customer X" flow in the UI) use it as-is.
  // Otherwise match or create by phone/email.
  let customerId = providedCustomerId || null;
  let contactId = null;
  let autoLinkedCustomerId = null;
  let matchedBy = null;
  if (!customerId) {
    const match = customers.findOrCreateCustomer(
      { name: customerName, email, phone, address },
      { actor }
    );
    customerId = match.customer.id;
    contactId = match.contact?.id || null;
    autoLinkedCustomerId = match.matched ? match.customer.id : null;
    matchedBy = match.matchedBy || null;
  }

  const job = jobsRepo.create(
    {
      customerName,
      address: address || '',
      phone: phone || '',
      email: email || '',
      serviceType,
      scheduledDate: scheduledDate || '',
      assignedTech: assignedTech || 'Jimmy Manharth',
      notes: notes || '',
      status: status || 'new',
      leadId: null,
      customerId,
      contactId,
      autoLinkedCustomerId,
      matchedBy,
    },
    {
      actor,
      description: autoLinkedCustomerId
        ? `New job: ${serviceType} for ${customerName} — matched existing customer by ${matchedBy}`
        : `New job: ${serviceType} for ${customerName}`,
    }
  );

  // Phase 1.1 — if the job was created directly as completed (rare but
  // supported), auto-draft the invoice right away. `autoInvoice` in the
  // response signals "a new invoice was just drafted"; it's null when
  // nothing new happened.
  let autoInvoice = null;
  if (job.status === 'completed' && !findInvoiceByJobId(job.id)) {
    autoInvoice = autoDraftInvoiceForJob(job, actor);
  }

  res.json({ success: true, job, autoInvoice });
});

app.patch('/api/admin/jobs/:id', auth, (req, res) => {
  const job = jobsRepo.find(req.params.id);
  if (!job) return res.status(404).json({ error: 'Job not found' });

  const fields = ['customerName', 'address', 'phone', 'email', 'serviceType', 'scheduledDate', 'assignedTech', 'notes', 'status'];
  const patch = {};
  fields.forEach(f => { if (req.body[f] !== undefined) patch[f] = req.body[f]; });

  const actor = actorFromReq(req);
  const updated = jobsRepo.update(req.params.id, patch, { actor });

  // Phase 1.1 — On a transition to Completed, auto-draft a blank invoice
  // if one doesn't already exist for this job. Runs only on the actual
  // not-completed → completed transition, and only if no invoice (manual
  // or otherwise) has been created for this job yet. `autoInvoice` in the
  // response is non-null only when something new was actually created.
  let autoInvoice = null;
  if (
    req.body.status === 'completed' &&
    job.status !== 'completed' &&
    !findInvoiceByJobId(updated.id)
  ) {
    autoInvoice = autoDraftInvoiceForJob(updated, actor);
  }

  res.json({ success: true, job: updated, autoInvoice });
});

app.delete('/api/admin/jobs/:id', auth, (req, res) => {
  const ok = jobsRepo.delete(req.params.id, { actor: actorFromReq(req) });
  if (!ok) return res.status(404).json({ error: 'Job not found' });
  res.json({ success: true });
});

// Convert lead to job — stamps both sides with the back-reference. (Phase 1.6)
app.post('/api/admin/leads/:id/convert', auth, (req, res) => {
  const lead = leadsRepo.find(req.params.id);
  if (!lead) return res.status(404).json({ error: 'Lead not found' });

  if (lead.jobId) {
    return res.status(409).json({ error: 'Lead is already converted', jobId: lead.jobId });
  }

  const actor = actorFromReq(req);

  const job = jobsRepo.create(
    {
      customerName: lead.name,
      address: lead.address,
      phone: lead.phone,
      email: lead.email,
      serviceType: lead.service || 'General',
      scheduledDate: req.body.scheduledDate || '',
      assignedTech: req.body.assignedTech || 'Jimmy Manharth',
      notes: lead.message || '',
      status: 'new',
      leadId: lead.id,
      // Customer management — carry the lead's customerId onto the job
      // so history links continue through the pipeline.
      customerId: lead.customerId || null,
      contactId: lead.contactId || null,
    },
    { actor, description: `Lead converted: ${lead.name} → ${lead.service || 'General'} job` }
  );

  leadsRepo.update(
    lead.id,
    { status: 'converted', jobId: job.id },
    { actor, description: `Converted to job ${job.id.slice(0, 8)}` }
  );

  res.json({ success: true, job });
});

// ===================
// INVOICES API
// ===================

// Phase 1.3 — Compute a per-invoice payment summary. Separated from the
// enrichment so endpoints that only need one piece (balance before adding
// a payment, for example) can call this directly without the status
// derivation overhead.
function getInvoicePayments(invoiceId) {
  return paymentsRepo.all().filter(p => p.invoiceId === invoiceId);
}

function getInvoiceTotals(invoice) {
  const payments = getInvoicePayments(invoice.id);
  const paidAmount = payments.reduce((s, p) => s + Number(p.amount), 0);
  const balance = Math.round((Number(invoice.total) - paidAmount) * 100) / 100;
  return {
    paidAmount: Math.round(paidAmount * 100) / 100,
    balance,
    payments,
  };
}

// Phase 1.3 — Derive the effective status. Persisted invoice.status is
// only "draft", "sent", or the legacy "paid"/"overdue" values from pre-1.3
// data. Everything meaningful (paid/partial/overdue) is computed from
// the payments table at read time.
function getEffectiveStatus(invoice, paidAmount) {
  const total = Number(invoice.total);
  if (total > 0 && paidAmount >= total - 0.005) return 'paid';
  if (paidAmount > 0.005) return 'partial';
  // No payments — fall back to the persisted status. Legacy data may
  // have invoice.status === 'paid' with no payments attached (pre-1.3);
  // in that case we respect it so nothing regresses visually.
  if (invoice.status === 'paid') return 'paid';
  // If the invoice is marked sent AND the due date has passed, it's overdue.
  if ((invoice.status === 'sent' || invoice.status === 'overdue') && invoice.dueDate) {
    const due = new Date(invoice.dueDate);
    if (!isNaN(due.getTime()) && due < new Date()) return 'overdue';
  }
  return invoice.status || 'draft';
}

// Phase 1.3 — Return an invoice object with the derived payment fields
// attached. The frontend reads effectiveStatus for display; baseStatus is
// the persisted value the user can toggle between draft and sent.
function enrichInvoice(invoice) {
  const { paidAmount, balance, payments } = getInvoiceTotals(invoice);
  const effectiveStatus = getEffectiveStatus(invoice, paidAmount);
  return {
    ...invoice,
    baseStatus: invoice.status,
    paidAmount,
    balance,
    effectiveStatus,
    payments: payments.sort((a, b) => (b.paymentDate || '').localeCompare(a.paymentDate || '')),
  };
}

app.get('/api/admin/invoices', auth, (req, res) => {
  res.json({ invoices: invoicesRepo.all().map(enrichInvoice) });
});

function computeInvoiceTotals(items) {
  const subtotal = items.reduce((sum, item) => sum + (Number(item.quantity) * Number(item.rate)), 0);
  const tax = Math.round(subtotal * 0.085 * 100) / 100; // 8.5% OK sales tax
  const total = Math.round((subtotal + tax) * 100) / 100;
  return { subtotal: Math.round(subtotal * 100) / 100, tax, total };
}

function nextInvoiceNumber() {
  const all = invoicesRepo.all();
  return `FL-${String(all.length + 1001).padStart(4, '0')}`;
}

// Phase 1.1 — Look up an existing invoice for a given job, if any. Used to
// guarantee idempotency when auto-drafting on status=completed.
function findInvoiceByJobId(jobId) {
  if (!jobId) return null;
  return invoicesRepo.all().find(i => i.jobId === jobId) || null;
}

// Phase 1.1 — Auto-draft a blank invoice from a completed job. Returns the
// newly-created invoice, or the existing one if a match for this jobId is
// already in the system (never creates duplicates).
//
// The draft has:
//   - customer fields inherited from the job
//   - a single line item using the service type as the description (rate 0,
//     qty 1 — Phase 2 will introduce a Services catalog with real prices)
//   - status = 'draft'
//   - due date = today + 30 days
//   - jobId back-reference for "View Invoice" links
function autoDraftInvoiceForJob(job, actor) {
  const existing = findInvoiceByJobId(job.id);
  if (existing) return existing;

  const items = [{ description: job.serviceType || 'Service', quantity: 1, rate: 0 }];
  const { subtotal, tax, total } = computeInvoiceTotals(items);
  const invoiceNumber = nextInvoiceNumber();

  const due = new Date();
  due.setDate(due.getDate() + 30);
  const dueDate = due.toISOString().slice(0, 10); // yyyy-mm-dd

  return invoicesRepo.create(
    {
      invoiceNumber,
      jobId: job.id,
      customerName: job.customerName,
      customerEmail: job.email || '',
      customerAddress: job.address || '',
      items,
      notes: '',
      subtotal,
      tax,
      total,
      status: 'draft',
      dueDate,
      paidAt: '',
      // Carry the job's customerId onto the auto-drafted invoice so the
      // customer history chain stays intact.
      customerId: job.customerId || null,
    },
    {
      actor: actor || 'system',
      description: `Auto-drafted invoice ${invoiceNumber} from completed job (${job.serviceType}) for ${job.customerName}`,
    }
  );
}

// Phase 1.3 + 1.2 — Record a payment against an invoice. Posts to the
// simple transactions feed (for dashboard tiles) AND the double-entry
// accounting ledger (for financial reports). Both posting IDs are
// stored on the Payment so they can be reversed cleanly on delete.
//
// Throws on invalid input; caller is responsible for status-code handling.
const VALID_PAYMENT_METHODS = ['cash', 'check', 'card', 'ach', 'other', 'unknown'];

function recordPayment(invoice, { amount, paymentDate, paymentMethod, referenceNumber, notes }, actor) {
  const amt = Number(amount);
  if (!Number.isFinite(amt) || amt <= 0) {
    throw new Error('amount must be a positive number');
  }
  const method = (paymentMethod || 'cash').toLowerCase();
  if (!VALID_PAYMENT_METHODS.includes(method)) {
    throw new Error(`paymentMethod must be one of: ${VALID_PAYMENT_METHODS.join(', ')}`);
  }

  const { balance } = getInvoiceTotals(invoice);
  if (amt > balance + 0.005) {
    throw new Error(`Payment amount ($${amt.toFixed(2)}) exceeds remaining balance ($${balance.toFixed(2)})`);
  }

  const dateIso = paymentDate
    ? new Date(paymentDate).toISOString()
    : new Date().toISOString();

  // 1. Post to the simple transactions feed that the dashboard reads.
  const txn = transactionsRepo.create(
    {
      type: 'income',
      amount: amt,
      description: `Payment for Invoice ${invoice.invoiceNumber} — ${invoice.customerName}`,
      category: 'Service Revenue',
      referenceId: invoice.id,
      date: dateIso,
    },
    {
      actor: actor || 'system',
      description: `Income $${amt.toFixed(2)} — Invoice ${invoice.invoiceNumber}`,
    }
  );

  // 2. Post to the double-entry accounting ledger.
  let journalEntryId = null;
  try {
    const acct = require('./accounting');
    let revenueCode = '4000';
    const serviceType = (invoice.items?.[0]?.description || '').toLowerCase();
    if (serviceType.includes('termite')) revenueCode = '4010';
    else if (serviceType.includes('inspect')) revenueCode = '4020';
    const revenueAcct = acct.getAccountByCode(revenueCode);
    if (revenueAcct) {
      const entry = acct.recordRevenue({
        amount: amt,
        revenueAccountId: revenueAcct.id,
        paymentMethod: method,
        memo: `Payment for Invoice ${invoice.invoiceNumber} — ${invoice.customerName}`,
        date: dateIso,
      });
      journalEntryId = entry?.id || null;
    }
  } catch (e) {
    // If the ledger post fails, we still create the payment so the user's
    // action isn't lost — but log it loudly so the failure is noticed.
    console.error('[payment] accounting ledger post failed:', e.message);
  }

  // 3. Create the Payment record itself.
  const payment = paymentsRepo.create(
    {
      invoiceId: invoice.id,
      amount: Math.round(amt * 100) / 100,
      paymentDate: dateIso,
      paymentMethod: method,
      referenceNumber: referenceNumber || '',
      notes: notes || '',
      transactionId: txn.id,
      journalEntryId,
    },
    {
      actor: actor || 'system',
      description: `Recorded payment of $${amt.toFixed(2)} (${method}) for Invoice ${invoice.invoiceNumber}`,
    }
  );

  return payment;
}

// Phase 1.2 — Reverse a payment. Creates a reversal journal entry in
// accounting.js (so the ledger shows the original and the reversal,
// never silently erases history), adds a negative-amount transaction
// to the dashboard feed, and deletes the Payment record. All three
// changes are individually audited via the repo.
function reversePayment(payment, actor) {
  // 1. Void the linked journal entry — accounting.voidJournalEntry creates
  //    a reversal entry (mirror of debits/credits) and marks the original
  //    as voided. It also writes its own audit event.
  if (payment.journalEntryId) {
    try {
      const acct = require('./accounting');
      acct.voidJournalEntry(payment.journalEntryId, actor || 'system');
    } catch (e) {
      console.error('[payment-reversal] voidJournalEntry failed:', e.message);
    }
  }

  // 2. Add a reversal transaction to the simple feed so dashboard totals
  //    update correctly. Never mutates the original transaction.
  if (payment.transactionId) {
    const original = transactionsRepo.find(payment.transactionId);
    if (original) {
      transactionsRepo.create(
        {
          type: original.type,
          amount: -Number(payment.amount),
          description: `REVERSAL: ${original.description}`,
          category: original.category,
          referenceId: payment.transactionId,
          reversalOf: payment.transactionId,
          date: new Date().toISOString(),
        },
        {
          actor: actor || 'system',
          description: `Reversal transaction for voided payment ${payment.id.slice(0, 8)}`,
        }
      );
    }
  }

  // 3. Delete the payment (audit entry includes the `before` snapshot).
  paymentsRepo.delete(payment.id, {
    actor: actor || 'system',
    description: `Voided payment of $${Number(payment.amount).toFixed(2)}`,
  });
}

// POST /api/admin/invoices/:id/payments — record a payment against an
// invoice. Returns { payment, invoice } with the invoice re-enriched so
// the caller sees the new paidAmount/balance/effectiveStatus.
app.post('/api/admin/invoices/:id/payments', auth, (req, res) => {
  const invoice = invoicesRepo.find(req.params.id);
  if (!invoice) return res.status(404).json({ error: 'Invoice not found' });
  try {
    const payment = recordPayment(invoice, req.body, actorFromReq(req));
    res.json({ success: true, payment, invoice: enrichInvoice(invoicesRepo.find(invoice.id)) });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

// GET /api/admin/invoices/:id/payments — list payments for a specific
// invoice. Frontend uses this for the payment history panel.
app.get('/api/admin/invoices/:id/payments', auth, (req, res) => {
  const invoice = invoicesRepo.find(req.params.id);
  if (!invoice) return res.status(404).json({ error: 'Invoice not found' });
  const payments = getInvoicePayments(invoice.id)
    .sort((a, b) => (b.paymentDate || '').localeCompare(a.paymentDate || ''));
  res.json({ payments });
});

// DELETE /api/admin/payments/:id — reverse a payment. Creates reversal
// entries in both the accounting ledger and the dashboard transaction
// feed, then removes the Payment itself.
app.delete('/api/admin/payments/:id', auth, (req, res) => {
  const payment = paymentsRepo.find(req.params.id);
  if (!payment) return res.status(404).json({ error: 'Payment not found' });
  const actor = actorFromReq(req);
  reversePayment(payment, actor);
  const invoice = invoicesRepo.find(payment.invoiceId);
  res.json({
    success: true,
    invoice: invoice ? enrichInvoice(invoice) : null,
  });
});

app.post('/api/admin/invoices', auth, (req, res) => {
  const { jobId, customerName, customerEmail, customerAddress, items, notes, dueDate, customerId: providedCustomerId } = req.body;
  if (!customerName || !items || !items.length) return res.status(400).json({ error: 'Customer name and at least one line item required' });

  const { subtotal, tax, total } = computeInvoiceTotals(items);
  const invoiceNumber = nextInvoiceNumber();
  const actor = actorFromReq(req);

  // Customer resolution — honour explicit customerId, otherwise fall back
  // to the job's customerId if jobId was supplied, otherwise match/create
  // by contact fields.
  let customerId = providedCustomerId || null;
  if (!customerId && jobId) {
    const job = jobsRepo.find(jobId);
    if (job?.customerId) customerId = job.customerId;
  }
  if (!customerId) {
    const match = customers.findOrCreateCustomer(
      { name: customerName, email: customerEmail, phone: '', address: customerAddress },
      { actor }
    );
    customerId = match.customer.id;
  }

  const invoice = invoicesRepo.create(
    {
      invoiceNumber,
      jobId: jobId || '',
      customerName,
      customerEmail: customerEmail || '',
      customerAddress: customerAddress || '',
      items,
      notes: notes || '',
      subtotal,
      tax,
      total,
      status: 'draft',
      dueDate: dueDate || '',
      paidAt: '',
      customerId,
    },
    {
      actor,
      description: `Invoice ${invoiceNumber} created for ${customerName} — $${total.toFixed(2)}`,
    }
  );

  res.json({ success: true, invoice });
});

app.patch('/api/admin/invoices/:id', auth, (req, res) => {
  const inv = invoicesRepo.find(req.params.id);
  if (!inv) return res.status(404).json({ error: 'Invoice not found' });

  const actor = actorFromReq(req);
  const patch = {};
  if (req.body.notes !== undefined) patch.notes = req.body.notes;

  // Phase 1.3 — 'paid' is no longer a manually-settable status. Invoices
  // become paid by having payments recorded against them. For backward
  // compatibility with any old clients that still PATCH status=paid, we
  // self-heal: auto-record a payment for the remaining balance, don't
  // touch the persisted status. The derived effectiveStatus will come
  // out as 'paid' on the next GET. 'partial' and 'overdue' are likewise
  // derived, not persisted.
  let synthesizedPayment = null;
  if (req.body.status === 'paid') {
    const { balance } = getInvoiceTotals(inv);
    if (balance > 0.005) {
      try {
        synthesizedPayment = recordPayment(
          inv,
          { amount: balance, paymentMethod: 'unknown', notes: 'Auto-recorded via legacy Mark-as-Paid' },
          actor
        );
      } catch (e) {
        return res.status(400).json({ error: e.message });
      }
    }
    // Fall through — no status field change on the invoice itself
  } else if (req.body.status && req.body.status !== inv.status) {
    if (!['draft', 'sent'].includes(req.body.status)) {
      return res.status(400).json({
        error: `Status '${req.body.status}' is not manually settable. Use POST /api/admin/invoices/:id/payments to record a payment.`,
      });
    }
    patch.status = req.body.status;
  }

  const updated = Object.keys(patch).length > 0
    ? invoicesRepo.update(req.params.id, patch, {
        actor,
        description: patch.status
          ? `Invoice ${inv.invoiceNumber} → ${patch.status}`
          : undefined,
      })
    : inv;

  res.json({
    success: true,
    invoice: enrichInvoice(updated),
    synthesizedPayment,
  });
});

// POST /api/admin/invoices/:id/send — email the invoice to the customer
// and (if it was draft) transition status to sent. If the invoice has no
// customerEmail, falls back to just marking sent so the Send button is
// never a dead-end for the user. Records a dedicated 'send' audit event
// with the recipient and SMTP result so Jimmy can prove what went out
// and when.
app.post('/api/admin/invoices/:id/send', auth, async (req, res) => {
  const invoice = invoicesRepo.find(req.params.id);
  if (!invoice) return res.status(404).json({ error: 'Invoice not found' });

  const actor = actorFromReq(req);
  const recipient = (req.body?.to || invoice.customerEmail || '').trim();

  // No email on file — mark the invoice sent (status transition only) so
  // the Send button still does something useful.
  if (!recipient) {
    const updated = invoice.status === 'draft'
      ? invoicesRepo.update(invoice.id, { status: 'sent' }, {
          actor,
          description: `Invoice ${invoice.invoiceNumber} marked sent (no customer email on file)`,
        })
      : invoice;
    recordAudit({
      action: 'send',
      recordType: 'invoices',
      recordId: invoice.id,
      actor,
      description: `Invoice ${invoice.invoiceNumber} sent — no customer email, status transition only`,
      context: { emailed: false, reason: 'no customer email' },
    });
    return res.json({ success: true, invoice: enrichInvoice(updated), emailed: false, reason: 'no customer email' });
  }

  // Send the email. Enrich the invoice first so the template has the
  // computed balance/paidAmount/effectiveStatus fields.
  let emailResult;
  try {
    const { sendInvoiceEmail } = require('./email');
    emailResult = await sendInvoiceEmail(enrichInvoice(invoice), { to: recipient });
  } catch (e) {
    console.error('sendInvoiceEmail threw:', e);
    emailResult = { sent: false, reason: e.message };
  }

  // Transition status to 'sent' on a successful send OR a deliberate send
  // that couldn't reach SMTP (user still considers it sent from their end).
  // We don't roll back the status on SMTP failure because the user's
  // intent was to send; the audit log captures the failure reason.
  let updated = invoice;
  if (invoice.status === 'draft') {
    updated = invoicesRepo.update(invoice.id, { status: 'sent' }, {
      actor,
      description: `Invoice ${invoice.invoiceNumber} sent to ${recipient}`,
    });
  }

  recordAudit({
    action: 'send',
    recordType: 'invoices',
    recordId: invoice.id,
    actor,
    description: emailResult.sent
      ? `Emailed invoice ${invoice.invoiceNumber} to ${recipient}`
      : `Attempted to email invoice ${invoice.invoiceNumber} to ${recipient} — ${emailResult.reason || 'unknown error'}`,
    context: { recipient, emailed: emailResult.sent, reason: emailResult.reason || null },
  });

  res.json({
    success: true,
    invoice: enrichInvoice(updated),
    emailed: emailResult.sent,
    reason: emailResult.reason || null,
    recipient,
  });
});

app.delete('/api/admin/invoices/:id', auth, (req, res) => {
  const ok = invoicesRepo.delete(req.params.id, { actor: actorFromReq(req) });
  if (!ok) return res.status(404).json({ error: 'Invoice not found' });
  res.json({ success: true });
});

// Create invoice from job (manual — kept for Phase 1.1 "Create Invoice" button)
app.post('/api/admin/jobs/:id/invoice', auth, (req, res) => {
  const job = jobsRepo.find(req.params.id);
  if (!job) return res.status(404).json({ error: 'Job not found' });

  const { items, notes, dueDate } = req.body;
  if (!items || !items.length) return res.status(400).json({ error: 'At least one line item required' });

  const { subtotal, tax, total } = computeInvoiceTotals(items);
  const invoiceNumber = nextInvoiceNumber();

  const invoice = invoicesRepo.create(
    {
      invoiceNumber,
      jobId: job.id,
      customerName: job.customerName,
      customerEmail: job.email,
      customerAddress: job.address,
      items,
      notes: notes || '',
      subtotal,
      tax,
      total,
      status: 'draft',
      dueDate: dueDate || '',
      paidAt: '',
      customerId: job.customerId || null,
    },
    {
      actor: actorFromReq(req),
      description: `Invoice ${invoiceNumber} created from job for ${job.customerName}`,
    }
  );

  res.json({ success: true, invoice });
});

// ===================
// TRANSACTIONS API (legacy simple feed — still used by dashboard tiles)
// ===================
app.get('/api/admin/transactions', auth, (req, res) => {
  res.json({ transactions: transactionsRepo.all() });
});

app.post('/api/admin/transactions', auth, (req, res) => {
  const { type, amount, description, category, date } = req.body;
  if (!type || !amount || !description) return res.status(400).json({ error: 'Type, amount, and description required' });

  const txn = transactionsRepo.create(
    {
      type,
      amount: parseFloat(amount),
      description,
      category: category || 'Uncategorized',
      referenceId: '',
      date: date || new Date().toISOString(),
    },
    {
      actor: actorFromReq(req),
      description: `${type === 'income' ? 'Income' : 'Expense'}: $${parseFloat(amount).toFixed(2)} — ${description}`,
    }
  );

  res.json({ success: true, transaction: txn });
});

app.delete('/api/admin/transactions/:id', auth, (req, res) => {
  const ok = transactionsRepo.delete(req.params.id, { actor: actorFromReq(req) });
  if (!ok) return res.status(404).json({ error: 'Transaction not found' });
  res.json({ success: true });
});

// ===================
// DASHBOARD STATS
// ===================
app.get('/api/admin/dashboard', auth, (req, res) => {
  const leads = leadsRepo.all();
  const jobs = jobsRepo.all();
  const invoices = invoicesRepo.all().map(enrichInvoice);
  const txns = transactionsRepo.all();

  const today = new Date().toISOString().split('T')[0];
  const thisMonth = today.substring(0, 7);

  const totalRevenue = txns.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
  const totalExpenses = txns.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
  const monthRevenue = txns.filter(t => t.type === 'income' && (t.date || '').startsWith(thisMonth)).reduce((s, t) => s + t.amount, 0);
  const monthExpenses = txns.filter(t => t.type === 'expense' && (t.date || '').startsWith(thisMonth)).reduce((s, t) => s + t.amount, 0);

  // Outstanding is the sum of balances on invoices that are either sent,
  // partial, or overdue — effectively anything not draft and not paid.
  // Using balance (not total) so partially-paid invoices only contribute
  // what's actually still owed.
  const unpaidInvoices = invoices.filter(i => i.effectiveStatus !== 'draft' && i.effectiveStatus !== 'paid');
  const outstandingAmount = Math.round(unpaidInvoices.reduce((s, i) => s + Number(i.balance), 0) * 100) / 100;

  // Monthly revenue for chart (last 6 months)
  const monthlyRevenue = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date();
    d.setMonth(d.getMonth() - i);
    const key = d.toISOString().substring(0, 7);
    const label = d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
    const income = txns.filter(t => t.type === 'income' && (t.date || '').startsWith(key)).reduce((s, t) => s + t.amount, 0);
    const expense = txns.filter(t => t.type === 'expense' && (t.date || '').startsWith(key)).reduce((s, t) => s + t.amount, 0);
    monthlyRevenue.push({ month: label, income: Math.round(income * 100) / 100, expense: Math.round(expense * 100) / 100 });
  }

  // Recent activity now comes from the unified audit log
  const recentAudit = queryAudit({ limit: 20 });
  const recentActivity = recentAudit.logs.map(ev => ({
    id: ev.id,
    type: ev.recordType,
    message: ev.description || `${ev.action} ${ev.recordType}`,
    timestamp: ev.performedAt,
  }));

  res.json({
    leads: { total: leads.length, new: leads.filter(l => l.status === 'new').length, today: leads.filter(l => (l.createdAt || '').startsWith(today)).length },
    jobs: { total: jobs.length, new: jobs.filter(j => j.status === 'new').length, scheduled: jobs.filter(j => j.status === 'scheduled').length, inProgress: jobs.filter(j => j.status === 'in_progress').length, completed: jobs.filter(j => j.status === 'completed').length },
    invoices: {
      total: invoices.length,
      draft: invoices.filter(i => i.effectiveStatus === 'draft').length,
      sent: invoices.filter(i => i.effectiveStatus === 'sent').length,
      partial: invoices.filter(i => i.effectiveStatus === 'partial').length,
      paid: invoices.filter(i => i.effectiveStatus === 'paid').length,
      overdue: invoices.filter(i => i.effectiveStatus === 'overdue').length,
      outstandingAmount,
    },
    revenue: { total: totalRevenue, expenses: totalExpenses, profit: totalRevenue - totalExpenses, monthRevenue, monthExpenses, monthProfit: monthRevenue - monthExpenses },
    monthlyRevenue,
    recentActivity,
  });
});

// ===================
// AUDIT LOG API (Phase 1.5)
// ===================
app.get('/api/admin/audit-log', auth, (req, res) => {
  const filters = {};
  if (req.query.startDate) filters.startDate = req.query.startDate;
  if (req.query.endDate) filters.endDate = req.query.endDate;
  if (req.query.action) filters.action = req.query.action;
  if (req.query.recordType) filters.recordType = req.query.recordType;
  if (req.query.actor) filters.actor = req.query.actor;
  if (req.query.q) filters.q = req.query.q;
  if (req.query.limit) filters.limit = Number(req.query.limit);
  if (req.query.offset) filters.offset = Number(req.query.offset);
  res.json(queryAudit(filters));
});

app.get('/api/admin/audit-log/distinct', auth, (req, res) => {
  const field = String(req.query.field || '');
  const allowed = new Set(['action', 'recordType', 'performedBy']);
  if (!allowed.has(field)) {
    return res.status(400).json({ error: `field must be one of ${[...allowed].join(', ')}` });
  }
  res.json({ values: listDistinct(field) });
});

// ===================
// CUSTOMERS API
// ===================

// GET /api/admin/customers — searchable list with inline stats
app.get('/api/admin/customers', auth, (req, res) => {
  const q = req.query.q ? String(req.query.q) : '';
  const sortBy = req.query.sortBy ? String(req.query.sortBy) : 'updatedAt';
  res.json({ customers: customers.listCustomers({ q, sortBy }) });
});

// GET /api/admin/customers/:id — full detail: contacts, locations, all
// leads/jobs/invoices/payments, plus running totals.
app.get('/api/admin/customers/:id', auth, (req, res) => {
  const detail = customers.getCustomerDetail(req.params.id);
  if (!detail) return res.status(404).json({ error: 'Customer not found' });
  res.json({ customer: detail });
});

// POST /api/admin/customers — manually create a customer (bypasses the
// auto-match path; used by the UI's "New Customer" button).
app.post('/api/admin/customers', auth, (req, res) => {
  const actor = actorFromReq(req);
  const { displayName, billingAddress, notes, tags, primaryContact, defaultLocation } = req.body;
  if (!displayName && !primaryContact?.name) {
    return res.status(400).json({ error: 'displayName or primaryContact.name is required' });
  }
  const customer = customers.createCustomer(
    { displayName, billingAddress, notes, tags, primaryContact, defaultLocation },
    { actor }
  );
  res.json({ success: true, customer });
});

// PATCH /api/admin/customers/:id — edit core fields (displayName,
// billingAddress, notes, tags)
app.patch('/api/admin/customers/:id', auth, (req, res) => {
  const actor = actorFromReq(req);
  const updated = customers.updateCustomer(req.params.id, req.body, { actor });
  if (!updated) return res.status(404).json({ error: 'Customer not found' });
  res.json({ success: true, customer: updated });
});

// Contacts (sub-resources)
app.post('/api/admin/customers/:id/contacts', auth, (req, res) => {
  const actor = actorFromReq(req);
  const contact = customers.addContact(req.params.id, req.body, { actor });
  res.json({ success: true, contact });
});

app.patch('/api/admin/customers/:customerId/contacts/:contactId', auth, (req, res) => {
  const actor = actorFromReq(req);
  const updated = customers.updateContact(req.params.contactId, req.body, { actor });
  if (!updated) return res.status(404).json({ error: 'Contact not found' });
  res.json({ success: true, contact: updated });
});

app.delete('/api/admin/customers/:customerId/contacts/:contactId', auth, (req, res) => {
  const actor = actorFromReq(req);
  const ok = customers.deleteContact(req.params.contactId, { actor });
  if (!ok) return res.status(404).json({ error: 'Contact not found' });
  res.json({ success: true });
});

// Service locations (sub-resources)
app.post('/api/admin/customers/:id/locations', auth, (req, res) => {
  const actor = actorFromReq(req);
  const location = customers.addLocation(req.params.id, req.body, { actor });
  res.json({ success: true, location });
});

app.patch('/api/admin/customers/:customerId/locations/:locationId', auth, (req, res) => {
  const actor = actorFromReq(req);
  const updated = customers.updateLocation(req.params.locationId, req.body, { actor });
  if (!updated) return res.status(404).json({ error: 'Location not found' });
  res.json({ success: true, location: updated });
});

app.delete('/api/admin/customers/:customerId/locations/:locationId', auth, (req, res) => {
  const actor = actorFromReq(req);
  const ok = customers.deleteLocation(req.params.locationId, { actor });
  if (!ok) return res.status(404).json({ error: 'Location not found' });
  res.json({ success: true });
});

// ===================
// SERVICES CATALOG API
// ===================
// The list of offerings Jimmy can add to jobs and invoices as line items.
// Stripe auto-sync (Commit 4) will hook into create/update/delete below.

// GET /api/admin/services — full catalog, optionally including inactive.
app.get('/api/admin/services', auth, (req, res) => {
  const includeInactive = req.query.includeInactive === 'true';
  res.json({ services: services.listServices({ includeInactive }) });
});

// POST /api/admin/services — add a service to the catalog.
// Body: { name, description, defaultPrice, category, active }
app.post('/api/admin/services', auth, (req, res) => {
  try {
    const actor = actorFromReq(req);
    const service = services.createService(req.body, { actor });
    // TODO Commit 4: if Stripe is configured, provision a matching
    // Product + Price and stamp stripeProductId/stripePriceId on the service.
    res.json({ success: true, service });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// PATCH /api/admin/services/:id — edit a service. Any change to name,
// description, or defaultPrice re-flags the service for Stripe re-sync
// (actual sync happens in Commit 4 when the Stripe SDK is wired up).
app.patch('/api/admin/services/:id', auth, (req, res) => {
  try {
    const actor = actorFromReq(req);
    const updated = services.updateService(req.params.id, req.body, { actor });
    if (!updated) return res.status(404).json({ error: 'Service not found' });
    res.json({ success: true, service: updated });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// DELETE /api/admin/services/:id — remove a service from the catalog.
// (Existing invoices/jobs that referenced this service keep their copies
// of the description/rate; they're free-standing values, not foreign keys.)
app.delete('/api/admin/services/:id', auth, (req, res) => {
  const actor = actorFromReq(req);
  const ok = services.deleteService(req.params.id, { actor });
  if (!ok) return res.status(404).json({ error: 'Service not found' });
  res.json({ success: true });
});

// POST /api/admin/services/seed — seed the catalog with a starter set of
// common pest control services. No-op if the catalog already has entries.
app.post('/api/admin/services/seed', auth, (req, res) => {
  const actor = actorFromReq(req);
  const result = services.seedStarterCatalog({ actor });
  res.json({ success: true, ...result });
});

// ===================
// BACKUP / RESTORE
// ===================
// Bearer-token auth on every endpoint. Data is served/received as gzipped
// JSON — a self-describing single-file format so a downloaded backup can
// be inspected with `gunzip -c backup.json.gz | jq .` before restoring.

// GET /api/admin/backup/download — streams a gzipped JSON envelope of
// every .json file in the data directory (excluding _backups/) for
// one-click manual export. Served with attachment headers so browsers
// save it instead of rendering it.
app.get('/api/admin/backup/download', auth, (req, res) => {
  try {
    const snapshot = backup.buildBackup();
    const buf = backup.serializeToGzip(snapshot);
    const filename = `frontline-backup-${snapshot.timestamp.slice(0, 10)}.json.gz`;
    res.setHeader('Content-Type', 'application/gzip');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('X-Backup-File-Count', Object.keys(snapshot.files).length);
    recordAudit({
      action: 'download',
      recordType: 'backup',
      actor: actorFromReq(req),
      description: `Downloaded backup — ${Object.keys(snapshot.files).length} files, ${buf.length} bytes`,
      context: { fileCount: Object.keys(snapshot.files).length, sizeBytes: buf.length },
    });
    res.send(buf);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST /api/admin/backup/restore — accepts a gzipped JSON backup in the
// request body (application/gzip) and re-applies every file. Takes a
// pre-restore snapshot first so the restore itself is reversible.
app.post('/api/admin/backup/restore',
  auth,
  express.raw({ type: 'application/gzip', limit: '100mb' }),
  (req, res) => {
    try {
      if (!Buffer.isBuffer(req.body) || req.body.length === 0) {
        return res.status(400).json({ error: 'Empty request body — upload the .json.gz backup file' });
      }
      const envelope = backup.deserializeFromGzip(req.body);
      const result = backup.restoreBackup(envelope, { takeSnapshotFirst: true });
      recordAudit({
        action: 'restore',
        recordType: 'backup',
        actor: actorFromReq(req),
        description: `Restored backup — ${result.restored.length} files overwritten (pre-restore snapshot: ${result.preRestoreSnapshot?.filename || 'none'})`,
        context: {
          fileCount: result.restored.length,
          files: result.restored,
          preRestoreSnapshot: result.preRestoreSnapshot?.filename || null,
          backupTimestamp: envelope.timestamp,
        },
      });
      res.json({ success: true, restored: result.restored, preRestoreSnapshot: result.preRestoreSnapshot });
    } catch (e) {
      res.status(400).json({ error: e.message });
    }
  }
);

// GET /api/admin/backup/snapshots — list the daily auto-snapshots stored
// on the volume for the UI's restore-point picker.
app.get('/api/admin/backup/snapshots', auth, (req, res) => {
  try {
    res.json({ snapshots: backup.listSnapshots() });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// GET /api/admin/backup/snapshots/:filename — stream a specific auto-snapshot
// file as a download so the user can pull one to their machine.
app.get('/api/admin/backup/snapshots/:filename', auth, (req, res) => {
  try {
    const buf = backup.readSnapshot(req.params.filename);
    res.setHeader('Content-Type', 'application/gzip');
    res.setHeader('Content-Disposition', `attachment; filename="${req.params.filename}"`);
    res.send(buf);
  } catch (e) {
    res.status(404).json({ error: e.message });
  }
});

// POST /api/admin/backup/snapshots/:filename/restore — restore from a
// named auto-snapshot without having to download and re-upload it.
app.post('/api/admin/backup/snapshots/:filename/restore', auth, (req, res) => {
  try {
    const buf = backup.readSnapshot(req.params.filename);
    const envelope = backup.deserializeFromGzip(buf);
    const result = backup.restoreBackup(envelope, { takeSnapshotFirst: true });
    recordAudit({
      action: 'restore',
      recordType: 'backup',
      actor: actorFromReq(req),
      description: `Restored from auto-snapshot ${req.params.filename} — ${result.restored.length} files`,
      context: {
        source: req.params.filename,
        fileCount: result.restored.length,
        preRestoreSnapshot: result.preRestoreSnapshot?.filename || null,
      },
    });
    res.json({ success: true, restored: result.restored, source: req.params.filename, preRestoreSnapshot: result.preRestoreSnapshot });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

// POST /api/admin/backup/snapshot — trigger a manual snapshot on demand
// (useful before risky admin actions; user can also just click
// Download Backup, but an in-place snapshot is zero-click and sticks on
// the volume for later rollback).
app.post('/api/admin/backup/snapshot', auth, (req, res) => {
  try {
    const label = (req.body?.label || 'manual').slice(0, 40);
    const snapshot = backup.writeAutoSnapshot(label);
    recordAudit({
      action: 'create',
      recordType: 'backup_snapshot',
      recordId: snapshot.filename,
      actor: actorFromReq(req),
      description: `Created manual snapshot ${snapshot.filename}`,
      context: snapshot,
    });
    res.json({ success: true, snapshot });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ===================
// ACCOUNTING SYSTEM (Double-Entry Ledger)
// ===================
const { createAccountingRoutes } = require('./accounting-routes');
app.use('/api/accounting', createAccountingRoutes(auth));

// Health check
app.get('/api/health', (req, res) => res.json({ status: 'ok' }));

// Serve static files in production
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, '../client/dist')));
  app.get('*', (req, res) => res.sendFile(path.join(__dirname, '../client/dist/index.html')));
}

// Run one-time data migrations on boot (idempotent via a marker file).
// Must run after all routes are registered but before listen, so HTTP
// requests can't interleave with migration writes.
const { runMigrations } = require('./migrations');
try {
  runMigrations();
} catch (e) {
  console.error('[migrations] runMigrations threw:', e);
}

// Only listen when run directly — lets integration tests require this module
// without starting a server on the real port. The backup scheduler is also
// gated here so tests don't leak a 24-hour interval timer.
if (require.main === module) {
  app.listen(PORT, () => console.log(`Frontline API server running on port ${PORT}`));
  backup.startAutoSnapshotScheduler();
}

module.exports = app;
