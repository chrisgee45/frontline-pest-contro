const express = require('express');
const cors = require('cors');
const path = require('path');
const crypto = require('crypto');

const { readJSON, writeJSON } = require('./data-dir');
const { repo } = require('./repo');
const { recordAudit, queryAudit, listDistinct } = require('./audit-helpers');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// --- Collections routed through the audited repo layer ---
const leadsRepo = repo('leads');
const jobsRepo = repo('jobs');
const invoicesRepo = repo('invoices');
const transactionsRepo = repo('transactions');

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
    },
    {
      actor: 'public_form',
      description: `New lead from ${name} (${service || 'General'})`,
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
  const { customerName, address, phone, email, serviceType, scheduledDate, assignedTech, notes, status } = req.body;
  if (!customerName || !serviceType) return res.status(400).json({ error: 'Customer name and service type required' });

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
    },
    {
      actor: actorFromReq(req),
      description: `New job: ${serviceType} for ${customerName}`,
    }
  );

  res.json({ success: true, job });
});

app.patch('/api/admin/jobs/:id', auth, (req, res) => {
  const job = jobsRepo.find(req.params.id);
  if (!job) return res.status(404).json({ error: 'Job not found' });

  const fields = ['customerName', 'address', 'phone', 'email', 'serviceType', 'scheduledDate', 'assignedTech', 'notes', 'status'];
  const patch = {};
  fields.forEach(f => { if (req.body[f] !== undefined) patch[f] = req.body[f]; });

  const updated = jobsRepo.update(req.params.id, patch, { actor: actorFromReq(req) });
  res.json({ success: true, job: updated });
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
app.get('/api/admin/invoices', auth, (req, res) => {
  res.json({ invoices: invoicesRepo.all() });
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

app.post('/api/admin/invoices', auth, (req, res) => {
  const { jobId, customerName, customerEmail, customerAddress, items, notes, dueDate } = req.body;
  if (!customerName || !items || !items.length) return res.status(400).json({ error: 'Customer name and at least one line item required' });

  const { subtotal, tax, total } = computeInvoiceTotals(items);
  const invoiceNumber = nextInvoiceNumber();

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
    },
    {
      actor: actorFromReq(req),
      description: `Invoice ${invoiceNumber} created for ${customerName} — $${total.toFixed(2)}`,
    }
  );

  res.json({ success: true, invoice });
});

app.patch('/api/admin/invoices/:id', auth, (req, res) => {
  const inv = invoicesRepo.find(req.params.id);
  if (!inv) return res.status(404).json({ error: 'Invoice not found' });

  const patch = {};
  if (req.body.notes !== undefined) patch.notes = req.body.notes;

  let justPaid = false;
  if (req.body.status && req.body.status !== inv.status) {
    patch.status = req.body.status;
    if (req.body.status === 'paid') {
      patch.paidAt = new Date().toISOString();
      justPaid = true;
    }
  }

  const updated = invoicesRepo.update(req.params.id, patch, {
    actor: actorFromReq(req),
    description: req.body.status && req.body.status !== inv.status
      ? `Invoice ${inv.invoiceNumber} → ${req.body.status}`
      : undefined,
  });

  // Legacy behavior: when an invoice is marked paid through this endpoint,
  // post to the simple transactions log AND the double-entry ledger.
  // Task 1.3 will replace this with the Payments table path, at which point
  // this block will be removed.
  if (justPaid) {
    transactionsRepo.create(
      {
        type: 'income',
        amount: inv.total,
        description: `Invoice ${inv.invoiceNumber} — ${inv.customerName}`,
        category: 'Service Revenue',
        referenceId: inv.id,
        date: new Date().toISOString(),
      },
      { actor: actorFromReq(req) }
    );

    try {
      const acct = require('./accounting');
      let revenueCode = '4000'; // Default: Pest Control
      const serviceType = (inv.items?.[0]?.description || '').toLowerCase();
      if (serviceType.includes('termite')) revenueCode = '4010';
      else if (serviceType.includes('inspect')) revenueCode = '4020';
      const revenueAcct = acct.getAccountByCode(revenueCode);
      if (revenueAcct) {
        acct.recordRevenue({
          amount: inv.total,
          revenueAccountId: revenueAcct.id,
          paymentMethod: 'cash',
          memo: `Invoice ${inv.invoiceNumber} — ${inv.customerName}`,
          date: updated.paidAt,
        });
      }
    } catch (e) {
      console.error('Failed to post invoice to accounting ledger:', e.message);
    }
  }

  res.json({ success: true, invoice: updated });
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
  const invoices = invoicesRepo.all();
  const txns = transactionsRepo.all();

  const today = new Date().toISOString().split('T')[0];
  const thisMonth = today.substring(0, 7);

  const totalRevenue = txns.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
  const totalExpenses = txns.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
  const monthRevenue = txns.filter(t => t.type === 'income' && (t.date || '').startsWith(thisMonth)).reduce((s, t) => s + t.amount, 0);
  const monthExpenses = txns.filter(t => t.type === 'expense' && (t.date || '').startsWith(thisMonth)).reduce((s, t) => s + t.amount, 0);

  const unpaidInvoices = invoices.filter(i => i.status !== 'paid' && i.status !== 'draft');
  const outstandingAmount = unpaidInvoices.reduce((s, i) => s + i.total, 0);

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
    invoices: { total: invoices.length, draft: invoices.filter(i => i.status === 'draft').length, sent: invoices.filter(i => i.status === 'sent').length, paid: invoices.filter(i => i.status === 'paid').length, outstandingAmount },
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
// without starting a server on the real port.
if (require.main === module) {
  app.listen(PORT, () => console.log(`Frontline API server running on port ${PORT}`));
}

module.exports = app;
