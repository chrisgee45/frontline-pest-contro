const express = require('express');
const cors = require('cors');
const path = require('path');
const crypto = require('crypto');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// --- Simple file-based storage ---
const DATA_DIR = path.join(__dirname, 'data');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR);

function dataFile(name) { return path.join(DATA_DIR, `${name}.json`); }

function readJSON(name, fallback) {
  try {
    const f = dataFile(name);
    if (fs.existsSync(f)) return JSON.parse(fs.readFileSync(f, 'utf8'));
  } catch { /* ignore */ }
  return fallback;
}

function writeJSON(name, data) {
  fs.writeFileSync(dataFile(name), JSON.stringify(data, null, 2));
}

// Admin credentials (stored in JSON, supports password changes)
function getAdminCreds() {
  return readJSON('admin_creds', {
    email: 'jmanharth@gmail.com',
    password: 'Password26!',
    name: 'Jimmy Manharth',
  });
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
    sessions.push({ token, createdAt: new Date().toISOString() });
    writeJSON('sessions', sessions);
    return res.json({ success: true, token, name: creds.name, email: creds.email });
  }
  res.status(401).json({ error: 'Invalid email or password' });
});

// Change password
app.post('/api/admin/change-password', (req, res) => {
  const h = req.headers.authorization;
  if (!h || !h.startsWith('Bearer ')) return res.status(401).json({ error: 'Unauthorized' });
  const token = h.split(' ')[1];
  const sessions = readJSON('sessions', []);
  if (!sessions.some(s => s.token === token)) return res.status(401).json({ error: 'Unauthorized' });

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

  const lead = {
    id: crypto.randomUUID(),
    name, email: email || '', phone, address: address || '',
    service: service || 'General', urgency: urgency || '',
    message: message || '', status: 'new', notes: '',
    createdAt: new Date().toISOString(),
  };

  const leads = readJSON('leads', []);
  leads.unshift(lead);
  writeJSON('leads', leads);

  // Log activity
  addActivity('lead', `New lead from ${name} (${service || 'General'})`);

  // Send email notification (async — don't block response)
  const { sendLeadNotification } = require('./email');
  sendLeadNotification(lead).catch(err => console.error('Lead email error:', err));

  res.json({ success: true, message: 'Thank you! We will contact you shortly.' });
});

app.get('/api/admin/leads', auth, (req, res) => {
  res.json({ leads: readJSON('leads', []) });
});

app.patch('/api/admin/leads/:id', auth, (req, res) => {
  const leads = readJSON('leads', []);
  const lead = leads.find(l => l.id === req.params.id);
  if (!lead) return res.status(404).json({ error: 'Lead not found' });
  if (req.body.status) lead.status = req.body.status;
  if (req.body.notes !== undefined) lead.notes = req.body.notes;
  writeJSON('leads', leads);
  res.json({ success: true, lead });
});

app.delete('/api/admin/leads/:id', auth, (req, res) => {
  let leads = readJSON('leads', []);
  const before = leads.length;
  leads = leads.filter(l => l.id !== req.params.id);
  if (leads.length === before) return res.status(404).json({ error: 'Lead not found' });
  writeJSON('leads', leads);
  res.json({ success: true });
});

// ===================
// JOBS API
// ===================
app.get('/api/admin/jobs', auth, (req, res) => {
  res.json({ jobs: readJSON('jobs', []) });
});

app.post('/api/admin/jobs', auth, (req, res) => {
  const { customerName, address, phone, email, serviceType, scheduledDate, assignedTech, notes, status } = req.body;
  if (!customerName || !serviceType) return res.status(400).json({ error: 'Customer name and service type required' });

  const job = {
    id: crypto.randomUUID(),
    customerName, address: address || '', phone: phone || '', email: email || '',
    serviceType, scheduledDate: scheduledDate || '',
    assignedTech: assignedTech || 'Jimmy Manharth',
    notes: notes || '', status: status || 'new',
    createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
  };

  const jobs = readJSON('jobs', []);
  jobs.unshift(job);
  writeJSON('jobs', jobs);
  addActivity('job', `New job: ${serviceType} for ${customerName}`);
  res.json({ success: true, job });
});

app.patch('/api/admin/jobs/:id', auth, (req, res) => {
  const jobs = readJSON('jobs', []);
  const job = jobs.find(j => j.id === req.params.id);
  if (!job) return res.status(404).json({ error: 'Job not found' });

  const fields = ['customerName', 'address', 'phone', 'email', 'serviceType', 'scheduledDate', 'assignedTech', 'notes', 'status'];
  fields.forEach(f => { if (req.body[f] !== undefined) job[f] = req.body[f]; });
  job.updatedAt = new Date().toISOString();

  if (req.body.status) addActivity('job', `Job "${job.serviceType}" for ${job.customerName} moved to ${req.body.status}`);

  writeJSON('jobs', jobs);
  res.json({ success: true, job });
});

app.delete('/api/admin/jobs/:id', auth, (req, res) => {
  let jobs = readJSON('jobs', []);
  const before = jobs.length;
  jobs = jobs.filter(j => j.id !== req.params.id);
  if (jobs.length === before) return res.status(404).json({ error: 'Job not found' });
  writeJSON('jobs', jobs);
  res.json({ success: true });
});

// Convert lead to job
app.post('/api/admin/leads/:id/convert', auth, (req, res) => {
  const leads = readJSON('leads', []);
  const lead = leads.find(l => l.id === req.params.id);
  if (!lead) return res.status(404).json({ error: 'Lead not found' });

  lead.status = 'converted';
  writeJSON('leads', leads);

  const job = {
    id: crypto.randomUUID(),
    customerName: lead.name, address: lead.address, phone: lead.phone, email: lead.email,
    serviceType: lead.service || 'General', scheduledDate: req.body.scheduledDate || '',
    assignedTech: req.body.assignedTech || 'Jimmy Manharth',
    notes: lead.message || '', status: 'new',
    createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
  };

  const jobs = readJSON('jobs', []);
  jobs.unshift(job);
  writeJSON('jobs', jobs);
  addActivity('job', `Lead converted: ${lead.name} → ${job.serviceType} job`);
  res.json({ success: true, job });
});

// ===================
// INVOICES API
// ===================
app.get('/api/admin/invoices', auth, (req, res) => {
  res.json({ invoices: readJSON('invoices', []) });
});

app.post('/api/admin/invoices', auth, (req, res) => {
  const { jobId, customerName, customerEmail, customerAddress, items, notes, dueDate } = req.body;
  if (!customerName || !items || !items.length) return res.status(400).json({ error: 'Customer name and at least one line item required' });

  const subtotal = items.reduce((sum, item) => sum + (item.quantity * item.rate), 0);
  const tax = Math.round(subtotal * 0.085 * 100) / 100; // 8.5% OK sales tax
  const total = Math.round((subtotal + tax) * 100) / 100;

  const invoices = readJSON('invoices', []);
  const invoiceNumber = `FL-${String(invoices.length + 1001).padStart(4, '0')}`;

  const invoice = {
    id: crypto.randomUUID(),
    invoiceNumber, jobId: jobId || '',
    customerName, customerEmail: customerEmail || '', customerAddress: customerAddress || '',
    items, notes: notes || '',
    subtotal, tax, total,
    status: 'draft', // draft, sent, paid, overdue
    dueDate: dueDate || '',
    createdAt: new Date().toISOString(), paidAt: '',
  };

  invoices.unshift(invoice);
  writeJSON('invoices', invoices);
  addActivity('invoice', `Invoice ${invoiceNumber} created for ${customerName} — $${total.toFixed(2)}`);
  res.json({ success: true, invoice });
});

app.patch('/api/admin/invoices/:id', auth, (req, res) => {
  const invoices = readJSON('invoices', []);
  const inv = invoices.find(i => i.id === req.params.id);
  if (!inv) return res.status(404).json({ error: 'Invoice not found' });

  if (req.body.status) {
    inv.status = req.body.status;
    if (req.body.status === 'paid') {
      inv.paidAt = new Date().toISOString();
      // Auto-add income transaction (simple system)
      addTransaction('income', inv.total, `Invoice ${inv.invoiceNumber} — ${inv.customerName}`, 'Service Revenue', inv.id);
      addActivity('invoice', `Invoice ${inv.invoiceNumber} marked as paid — $${inv.total.toFixed(2)}`);

      // Auto-post to double-entry accounting ledger
      try {
        const acct = require('./accounting');
        // Determine revenue account based on service type
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
            date: inv.paidAt,
          });
        }
      } catch (e) {
        console.error('Failed to post invoice to accounting ledger:', e.message);
      }
    } else {
      addActivity('invoice', `Invoice ${inv.invoiceNumber} status → ${req.body.status}`);
    }
  }
  if (req.body.notes !== undefined) inv.notes = req.body.notes;

  writeJSON('invoices', invoices);
  res.json({ success: true, invoice: inv });
});

app.delete('/api/admin/invoices/:id', auth, (req, res) => {
  let invoices = readJSON('invoices', []);
  const before = invoices.length;
  invoices = invoices.filter(i => i.id !== req.params.id);
  if (invoices.length === before) return res.status(404).json({ error: 'Invoice not found' });
  writeJSON('invoices', invoices);
  res.json({ success: true });
});

// Create invoice from job
app.post('/api/admin/jobs/:id/invoice', auth, (req, res) => {
  const jobs = readJSON('jobs', []);
  const job = jobs.find(j => j.id === req.params.id);
  if (!job) return res.status(404).json({ error: 'Job not found' });

  const { items, notes, dueDate } = req.body;
  if (!items || !items.length) return res.status(400).json({ error: 'At least one line item required' });

  const subtotal = items.reduce((sum, item) => sum + (item.quantity * item.rate), 0);
  const tax = Math.round(subtotal * 0.085 * 100) / 100;
  const total = Math.round((subtotal + tax) * 100) / 100;

  const invoices = readJSON('invoices', []);
  const invoiceNumber = `FL-${String(invoices.length + 1001).padStart(4, '0')}`;

  const invoice = {
    id: crypto.randomUUID(),
    invoiceNumber, jobId: job.id,
    customerName: job.customerName, customerEmail: job.email, customerAddress: job.address,
    items, notes: notes || '',
    subtotal, tax, total,
    status: 'draft', dueDate: dueDate || '',
    createdAt: new Date().toISOString(), paidAt: '',
  };

  invoices.unshift(invoice);
  writeJSON('invoices', invoices);
  addActivity('invoice', `Invoice ${invoiceNumber} created from job for ${job.customerName}`);
  res.json({ success: true, invoice });
});

// ===================
// ACCOUNTING / TRANSACTIONS API
// ===================
function addTransaction(type, amount, description, category, referenceId) {
  const txns = readJSON('transactions', []);
  txns.unshift({
    id: crypto.randomUUID(),
    type, // income or expense
    amount, description, category: category || 'Uncategorized',
    referenceId: referenceId || '',
    date: new Date().toISOString(),
  });
  writeJSON('transactions', txns);
}

app.get('/api/admin/transactions', auth, (req, res) => {
  res.json({ transactions: readJSON('transactions', []) });
});

app.post('/api/admin/transactions', auth, (req, res) => {
  const { type, amount, description, category, date } = req.body;
  if (!type || !amount || !description) return res.status(400).json({ error: 'Type, amount, and description required' });

  const txn = {
    id: crypto.randomUUID(),
    type, amount: parseFloat(amount), description,
    category: category || 'Uncategorized', referenceId: '',
    date: date || new Date().toISOString(),
  };

  const txns = readJSON('transactions', []);
  txns.unshift(txn);
  writeJSON('transactions', txns);
  addActivity('accounting', `${type === 'income' ? 'Income' : 'Expense'}: $${parseFloat(amount).toFixed(2)} — ${description}`);
  res.json({ success: true, transaction: txn });
});

app.delete('/api/admin/transactions/:id', auth, (req, res) => {
  let txns = readJSON('transactions', []);
  const before = txns.length;
  txns = txns.filter(t => t.id !== req.params.id);
  if (txns.length === before) return res.status(404).json({ error: 'Transaction not found' });
  writeJSON('transactions', txns);
  res.json({ success: true });
});

// ===================
// DASHBOARD STATS
// ===================
app.get('/api/admin/dashboard', auth, (req, res) => {
  const leads = readJSON('leads', []);
  const jobs = readJSON('jobs', []);
  const invoices = readJSON('invoices', []);
  const txns = readJSON('transactions', []);

  const today = new Date().toISOString().split('T')[0];
  const thisMonth = today.substring(0, 7);

  const totalRevenue = txns.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
  const totalExpenses = txns.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
  const monthRevenue = txns.filter(t => t.type === 'income' && t.date.startsWith(thisMonth)).reduce((s, t) => s + t.amount, 0);
  const monthExpenses = txns.filter(t => t.type === 'expense' && t.date.startsWith(thisMonth)).reduce((s, t) => s + t.amount, 0);

  const unpaidInvoices = invoices.filter(i => i.status !== 'paid' && i.status !== 'draft');
  const outstandingAmount = unpaidInvoices.reduce((s, i) => s + i.total, 0);

  // Monthly revenue for chart (last 6 months)
  const monthlyRevenue = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date();
    d.setMonth(d.getMonth() - i);
    const key = d.toISOString().substring(0, 7);
    const label = d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
    const income = txns.filter(t => t.type === 'income' && t.date.startsWith(key)).reduce((s, t) => s + t.amount, 0);
    const expense = txns.filter(t => t.type === 'expense' && t.date.startsWith(key)).reduce((s, t) => s + t.amount, 0);
    monthlyRevenue.push({ month: label, income: Math.round(income * 100) / 100, expense: Math.round(expense * 100) / 100 });
  }

  res.json({
    leads: { total: leads.length, new: leads.filter(l => l.status === 'new').length, today: leads.filter(l => l.createdAt.startsWith(today)).length },
    jobs: { total: jobs.length, new: jobs.filter(j => j.status === 'new').length, scheduled: jobs.filter(j => j.status === 'scheduled').length, inProgress: jobs.filter(j => j.status === 'in_progress').length, completed: jobs.filter(j => j.status === 'completed').length },
    invoices: { total: invoices.length, draft: invoices.filter(i => i.status === 'draft').length, sent: invoices.filter(i => i.status === 'sent').length, paid: invoices.filter(i => i.status === 'paid').length, outstandingAmount },
    revenue: { total: totalRevenue, expenses: totalExpenses, profit: totalRevenue - totalExpenses, monthRevenue, monthExpenses, monthProfit: monthRevenue - monthExpenses },
    monthlyRevenue,
    recentActivity: readJSON('activity', []).slice(0, 20),
  });
});

// ===================
// ACTIVITY LOG
// ===================
function addActivity(type, message) {
  const activity = readJSON('activity', []);
  activity.unshift({ id: crypto.randomUUID(), type, message, timestamp: new Date().toISOString() });
  if (activity.length > 100) activity.length = 100;
  writeJSON('activity', activity);
}

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

app.listen(PORT, () => console.log(`Frontline API server running on port ${PORT}`));
