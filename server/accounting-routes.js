const express = require('express');
const acct = require('./accounting');
const { readJSON } = require('./data-dir');

// Extract the actor email from the bearer token's session — mirrors the
// same helper in server/index.js. Accounting writes are attributed to the
// user who made the change so audit events don't all read "admin".
function actorFromReq(req) {
  const h = req.headers.authorization;
  if (!h || !h.startsWith('Bearer ')) return 'anonymous';
  const token = h.split(' ')[1];
  const sessions = readJSON('sessions', []);
  const session = sessions.find(s => s.token === token);
  return session?.actor || 'admin';
}

function createAccountingRoutes(authMiddleware) {
  const router = express.Router();
  router.use(authMiddleware);

  // === Chart of Accounts ===
  router.get('/accounts', (req, res) => {
    res.json({ ok: true, data: acct.getAccounts() });
  });

  router.post('/accounts', (req, res) => {
    try {
      const account = acct.createAccount(req.body);
      res.json({ ok: true, data: account });
    } catch (e) { res.status(400).json({ ok: false, error: e.message }); }
  });

  // === Revenue / Expense / Draw ===
  router.post('/revenue', (req, res) => {
    try {
      const tx = acct.recordRevenue({
        amount: Number(req.body.amount),
        revenueAccountId: req.body.revenueAccountId,
        paymentMethod: req.body.paymentMethod || 'cash',
        memo: req.body.memo,
        date: req.body.date || req.body.occurredAt,
      });
      res.json({ ok: true, transaction: tx });
    } catch (e) { res.status(400).json({ ok: false, error: e.message }); }
  });

  router.post('/expense', (req, res) => {
    try {
      const tx = acct.recordExpenseEntry({
        amount: Number(req.body.amount),
        expenseAccountId: req.body.expenseAccountId,
        paymentMethod: req.body.paymentMethod || 'cash',
        memo: req.body.memo,
        date: req.body.date || req.body.occurredAt,
      });
      res.json({ ok: true, transaction: tx });
    } catch (e) { res.status(400).json({ ok: false, error: e.message }); }
  });

  router.post('/owner-draw', (req, res) => {
    try {
      const tx = acct.recordOwnerDraw({
        amount: Number(req.body.amount),
        memo: req.body.memo,
        date: req.body.date || req.body.occurredAt,
      });
      res.json({ ok: true, transaction: tx });
    } catch (e) { res.status(400).json({ ok: false, error: e.message }); }
  });

  // === Financial Reports ===
  router.get('/income-statement', (req, res) => {
    try {
      const y = new Date().getFullYear();
      const start = req.query.start || req.query.startDate || `${y}-01-01`;
      const end = req.query.end || req.query.endDate || `${y}-12-31`;
      res.json({ ok: true, data: acct.getIncomeStatement(start, end) });
    } catch (e) { res.status(400).json({ ok: false, error: e.message }); }
  });

  router.get('/balance-sheet', (req, res) => {
    try {
      const asOf = req.query.asOf || req.query.asOfDate || new Date().toISOString().slice(0, 10);
      res.json({ ok: true, data: acct.getBalanceSheet(asOf) });
    } catch (e) { res.status(400).json({ ok: false, error: e.message }); }
  });

  router.get('/cash-flow', (req, res) => {
    try {
      const y = new Date().getFullYear();
      const start = req.query.start || req.query.startDate || `${y}-01-01`;
      const end = req.query.end || req.query.endDate || `${y}-12-31`;
      res.json({ ok: true, data: acct.getCashFlow(start, end) });
    } catch (e) { res.status(400).json({ ok: false, error: e.message }); }
  });

  router.get('/activity', (req, res) => {
    try {
      const y = new Date().getFullYear();
      const start = req.query.start || `${y}-01-01`;
      const end = req.query.end || `${y}-12-31`;
      res.json({ ok: true, data: acct.getAccountActivity(start, end) });
    } catch (e) { res.status(400).json({ ok: false, error: e.message }); }
  });

  // === Journal Entries (General Ledger) ===
  router.get('/journal-entries', (req, res) => {
    const start = req.query.start || req.query.startDate;
    const end = req.query.end || req.query.endDate;
    const entries = acct.getJournalEntries(start, end);
    res.json({ ok: true, data: entries });
  });

  router.post('/journal-entries', (req, res) => {
    try {
      const { date, memo, lines } = req.body;
      if (!lines || lines.length < 2) return res.status(400).json({ ok: false, error: 'At least 2 lines required' });
      const entry = acct.postJournalEntry({ date, memo, sourceType: 'manual', lines });
      res.json({ ok: true, data: entry });
    } catch (e) { res.status(400).json({ ok: false, error: e.message }); }
  });

  router.post('/journal-entries/:id/void', (req, res) => {
    try {
      const reversal = acct.voidJournalEntry(req.params.id, 'admin');
      res.json({ ok: true, data: reversal });
    } catch (e) { res.status(400).json({ ok: false, error: e.message }); }
  });

  // === Vendors ===
  router.get('/vendors', (req, res) => { res.json({ ok: true, data: acct.getVendors() }); });
  router.post('/vendors', (req, res) => {
    try { res.json({ ok: true, data: acct.createVendor(req.body) }); }
    catch (e) { res.status(400).json({ ok: false, error: e.message }); }
  });
  router.patch('/vendors/:id', (req, res) => {
    const v = acct.updateVendor(req.params.id, req.body);
    if (!v) return res.status(404).json({ ok: false, error: 'Not found' });
    res.json({ ok: true, data: v });
  });

  // === Expenses ===
  router.get('/expenses', (req, res) => {
    const filters = {};
    if (req.query.startDate) filters.startDate = req.query.startDate;
    if (req.query.endDate) filters.endDate = req.query.endDate;
    if (req.query.accountId) filters.accountId = req.query.accountId;
    if (req.query.vendorId) filters.vendorId = req.query.vendorId;
    res.json({ ok: true, data: acct.getExpenses(filters) });
  });

  router.post('/expenses', (req, res) => {
    try {
      const expense = acct.createExpense(req.body, { actor: actorFromReq(req) });
      res.json({ ok: true, data: expense });
    } catch (e) { res.status(400).json({ ok: false, error: e.message }); }
  });

  router.patch('/expenses/:id', (req, res) => {
    const exp = acct.updateExpense(req.params.id, req.body);
    if (!exp) return res.status(404).json({ ok: false, error: 'Not found' });
    res.json({ ok: true, data: exp });
  });

  router.post('/expenses/:id/void', (req, res) => {
    try { acct.voidExpense(req.params.id, actorFromReq(req)); res.json({ ok: true }); }
    catch (e) { res.status(400).json({ ok: false, error: e.message }); }
  });

  // === Bills (AP) ===
  router.get('/bills', (req, res) => {
    const filters = {};
    if (req.query.status) filters.status = req.query.status;
    if (req.query.vendorId) filters.vendorId = req.query.vendorId;
    res.json({ ok: true, data: acct.getBills(filters) });
  });

  router.post('/bills', (req, res) => {
    try { res.json({ ok: true, data: acct.createBill(req.body) }); }
    catch (e) { res.status(400).json({ ok: false, error: e.message }); }
  });

  router.post('/bills/:id/pay', (req, res) => {
    try {
      const result = acct.recordBillPayment(
        req.params.id,
        Number(req.body.amount),
        req.body.paymentMethod,
        req.body.memo,
        { actor: actorFromReq(req) }
      );
      res.json({ ok: true, data: result });
    } catch (e) { res.status(400).json({ ok: false, error: e.message }); }
  });

  // Phase 1.4 — List payments for a bill so the UI can show a history
  // panel. Voided payments are hidden by default.
  router.get('/bills/:id/payments', (req, res) => {
    const includeVoided = req.query.includeVoided === '1';
    res.json({ ok: true, data: acct.getBillPayments(req.params.id, { includeVoided }) });
  });

  // Phase 1.4 — Void a bill payment. Creates a reversing entry in the
  // journal, adds a negative-amount reversal transaction, and lowers the
  // bill's paidAmount. Returns the updated bill + payment so the caller
  // can refresh the UI.
  router.post('/bill-payments/:id/void', (req, res) => {
    try {
      const result = acct.voidBillPayment(req.params.id, { actor: actorFromReq(req) });
      res.json({ ok: true, data: result });
    } catch (e) { res.status(400).json({ ok: false, error: e.message }); }
  });

  // === Budgets ===
  router.get('/budgets', (req, res) => {
    const year = Number(req.query.year) || new Date().getFullYear();
    res.json({ ok: true, data: acct.getBudgets(year) });
  });

  router.post('/budgets/bulk', (req, res) => {
    try {
      const { budgets, year } = req.body;
      const saved = acct.saveBudgets(budgets, Number(year));
      res.json({ ok: true, saved: saved.length });
    } catch (e) { res.status(400).json({ ok: false, error: e.message }); }
  });

  router.get('/budget-vs-actual', (req, res) => {
    try {
      const year = Number(req.query.year) || new Date().getFullYear();
      const period = req.query.period || 'year';
      const month = req.query.month ? Number(req.query.month) : null;
      const quarter = req.query.quarter ? Number(req.query.quarter) : null;
      res.json({ ok: true, data: acct.getBudgetVsActual(year, period, month, quarter) });
    } catch (e) { res.status(400).json({ ok: false, error: e.message }); }
  });

  // === Tax ===
  router.get('/tax-settings', (req, res) => { res.json({ ok: true, data: acct.getTaxSettings() }); });
  router.put('/tax-settings', (req, res) => { res.json({ ok: true, data: acct.saveTaxSettings(req.body) }); });
  router.get('/quarterly-payments/:year', (req, res) => { res.json({ ok: true, data: acct.getQuarterlyPayments(Number(req.params.year)) }); });
  router.put('/quarterly-payments', (req, res) => { res.json({ ok: true, data: acct.saveQuarterlyPayment(req.body) }); });

  // === 1099 Vendor Report ===
  // Legally required by Jan 31 of each year for any 1099-flagged vendor
  // who received $600+ in reportable-method payments during the year.
  const taxReports = require('./tax-reports');
  router.get('/1099-report', (req, res) => {
    try {
      const year = Number(req.query.year) || new Date().getUTCFullYear();
      const report = taxReports.build1099Report(year);
      res.json({ ok: true, data: report });
    } catch (e) { res.status(400).json({ ok: false, error: e.message }); }
  });

  router.get('/1099-report/csv', (req, res) => {
    try {
      const year = Number(req.query.year) || new Date().getUTCFullYear();
      const report = taxReports.build1099Report(year);
      const csv = taxReports.render1099CSV(report);
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="frontline-1099-report-${year}.csv"`);
      res.send(csv);
    } catch (e) { res.status(400).json({ ok: false, error: e.message }); }
  });

  // === Audit Trail ===
  router.get('/audit-logs', (req, res) => {
    const filters = {};
    if (req.query.startDate) filters.startDate = req.query.startDate;
    if (req.query.endDate) filters.endDate = req.query.endDate;
    if (req.query.action) filters.action = req.query.action;
    if (req.query.recordType) filters.recordType = req.query.recordType;
    if (req.query.limit) filters.limit = Number(req.query.limit);
    if (req.query.offset) filters.offset = Number(req.query.offset);
    res.json({ ok: true, ...acct.getAuditLogs(filters) });
  });

  return router;
}

module.exports = { createAccountingRoutes };
