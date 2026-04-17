const crypto = require('crypto');
const { readJSON, writeJSON } = require('./data-dir');
const { recordAudit } = require('./audit-helpers');
const { repo } = require('./repo');

// Shared transactions feed for the dashboard — separate from the double-
// entry journal entries. Expense and bill-payment writes post to both
// (Phase 1.4) so the dashboard's Total Expenses reflects actual cash
// movement without the dashboard needing to know about journal entries.
const transactionsRepo = repo('transactions');

// ==========================================
// CHART OF ACCOUNTS (Double-Entry System)
// ==========================================
const DEFAULT_ACCOUNTS = [
  // Assets
  { code: '1000', name: 'Cash', type: 'asset', subtype: 'cash', scheduleCLine: null },
  { code: '1100', name: 'Accounts Receivable', type: 'asset', subtype: 'ar', scheduleCLine: null },
  { code: '1500', name: 'Equipment', type: 'asset', subtype: 'fixed_asset', scheduleCLine: null },
  // Liabilities
  { code: '2000', name: 'Accounts Payable', type: 'liability', subtype: 'ap', scheduleCLine: null },
  { code: '2100', name: 'Credit Card Payable', type: 'liability', subtype: 'credit_card', scheduleCLine: null },
  { code: '2500', name: 'Sales Tax Payable', type: 'liability', subtype: 'tax', scheduleCLine: null },
  // Equity
  { code: '3000', name: "Owner's Equity", type: 'equity', subtype: 'owners_equity', scheduleCLine: null },
  { code: '3100', name: "Owner's Draw", type: 'equity', subtype: 'draw', scheduleCLine: null },
  { code: '3200', name: 'Owner Contribution', type: 'equity', subtype: 'contribution', scheduleCLine: null },
  { code: '3900', name: 'Retained Earnings', type: 'equity', subtype: 'retained_earnings', scheduleCLine: null },
  // Revenue
  { code: '4000', name: 'Service Revenue - Pest Control', type: 'revenue', subtype: 'service', scheduleCLine: '1' },
  { code: '4010', name: 'Service Revenue - Termite', type: 'revenue', subtype: 'service', scheduleCLine: '1' },
  { code: '4020', name: 'Service Revenue - Inspections', type: 'revenue', subtype: 'service', scheduleCLine: '1' },
  { code: '4090', name: 'Other Income', type: 'revenue', subtype: 'other', scheduleCLine: '6' },
  // Expenses
  { code: '5000', name: 'Chemicals & Materials', type: 'expense', subtype: 'cogs', scheduleCLine: '22' },
  { code: '5010', name: 'Equipment & Tools', type: 'expense', subtype: 'equipment', scheduleCLine: '13' },
  { code: '8100', name: 'Advertising & Marketing', type: 'expense', subtype: 'advertising', scheduleCLine: '8' },
  { code: '8200', name: 'Contract Labor', type: 'expense', subtype: 'contract_labor', scheduleCLine: '11' },
  { code: '8300', name: 'Insurance', type: 'expense', subtype: 'insurance', scheduleCLine: '15' },
  { code: '8400', name: 'Legal & Professional', type: 'expense', subtype: 'legal', scheduleCLine: '17' },
  { code: '8500', name: 'Office Expense', type: 'expense', subtype: 'office', scheduleCLine: '18' },
  { code: '8600', name: 'Supplies', type: 'expense', subtype: 'supplies', scheduleCLine: '22' },
  { code: '8700', name: 'Utilities', type: 'expense', subtype: 'utilities', scheduleCLine: '25' },
  { code: '8800', name: 'Software & Subscriptions', type: 'expense', subtype: 'software', scheduleCLine: '27a' },
  { code: '8900', name: 'Travel & Meals', type: 'expense', subtype: 'travel', scheduleCLine: '24a' },
  { code: '9000', name: 'Rent', type: 'expense', subtype: 'rent', scheduleCLine: '20b' },
  { code: '9100', name: 'Depreciation', type: 'expense', subtype: 'depreciation', scheduleCLine: '13' },
  { code: '9200', name: 'Vehicle & Fuel', type: 'expense', subtype: 'vehicle', scheduleCLine: '9' },
  { code: '9300', name: 'Licensing & Training', type: 'expense', subtype: 'licensing', scheduleCLine: '27a' },
  { code: '9400', name: 'Phone & Internet', type: 'expense', subtype: 'phone', scheduleCLine: '25' },
  { code: '9500', name: 'Other Expenses', type: 'expense', subtype: 'other', scheduleCLine: '27a' },
];

function seedAccounts() {
  const accounts = readJSON('accounts', []);
  if (accounts.length > 0) return accounts;
  const seeded = DEFAULT_ACCOUNTS.map(a => ({
    id: crypto.randomUUID(),
    ...a,
    isActive: true,
    normalBalance: (a.type === 'asset' || a.type === 'expense') ? 'debit' : 'credit',
    createdAt: new Date().toISOString(),
  }));
  writeJSON('accounts', seeded);
  return seeded;
}

function getAccounts() {
  let accounts = readJSON('accounts', []);
  if (accounts.length === 0) accounts = seedAccounts();
  return accounts.sort((a, b) => a.code.localeCompare(b.code));
}

function getAccountById(id) {
  return getAccounts().find(a => a.id === id);
}

function getAccountByCode(code) {
  return getAccounts().find(a => a.code === code);
}

function createAccount(data) {
  const accounts = getAccounts();
  const account = {
    id: crypto.randomUUID(),
    code: data.code,
    name: data.name,
    type: data.type,
    subtype: data.subtype || '',
    scheduleCLine: data.scheduleCLine || null,
    isActive: true,
    normalBalance: (data.type === 'asset' || data.type === 'expense') ? 'debit' : 'credit',
    createdAt: new Date().toISOString(),
  };
  accounts.push(account);
  writeJSON('accounts', accounts);
  return account;
}

// ==========================================
// JOURNAL ENTRIES (Double-Entry Ledger)
// ==========================================
function postJournalEntry(params) {
  const { date, memo, sourceType, sourceId, lines, createdBy } = params;

  // Validate balanced
  const totalDebits = lines.reduce((s, l) => s + (l.debit || 0), 0);
  const totalCredits = lines.reduce((s, l) => s + (l.credit || 0), 0);
  if (Math.abs(totalDebits - totalCredits) > 0.01) {
    throw new Error(`Journal not balanced: debits=${totalDebits.toFixed(2)} credits=${totalCredits.toFixed(2)}`);
  }
  if (totalDebits <= 0) throw new Error('Journal must have a positive total');

  // Check for duplicate sourceId
  if (sourceId) {
    const entries = readJSON('journal_entries', []);
    const existing = entries.find(e => e.sourceId === sourceId && !e.isVoid);
    if (existing) return existing;
  }

  const entry = {
    id: crypto.randomUUID(),
    date: date || new Date().toISOString(),
    memo: memo || '',
    sourceType: sourceType || 'manual',
    sourceId: sourceId || null,
    isVoid: false,
    createdBy: createdBy || 'admin',
    createdAt: new Date().toISOString(),
    lines: lines.map(l => ({
      id: crypto.randomUUID(),
      accountId: l.accountId,
      debit: Math.round((l.debit || 0) * 100) / 100,
      credit: Math.round((l.credit || 0) * 100) / 100,
      memo: l.memo || '',
    })),
  };

  const entries = readJSON('journal_entries', []);
  entries.unshift(entry);
  writeJSON('journal_entries', entries);

  // Audit log
  addAuditEntry('create', 'journal_entry', entry.id, totalDebits, memo, createdBy || 'admin');

  return entry;
}

function voidJournalEntry(entryId, voidedBy) {
  const entries = readJSON('journal_entries', []);
  const entry = entries.find(e => e.id === entryId);
  if (!entry) throw new Error('Journal entry not found');
  if (entry.isVoid) throw new Error('Already voided');

  entry.isVoid = true;

  // Create reversal
  const reversalLines = entry.lines.map(l => ({
    accountId: l.accountId,
    debit: l.credit,
    credit: l.debit,
    memo: `Reversal of: ${l.memo}`,
  }));

  const reversal = {
    id: crypto.randomUUID(),
    date: new Date().toISOString(),
    memo: `REVERSAL: ${entry.memo}`,
    sourceType: 'reversal',
    sourceId: entryId,
    isVoid: false,
    createdBy: voidedBy || 'admin',
    createdAt: new Date().toISOString(),
    lines: reversalLines.map(l => ({ id: crypto.randomUUID(), ...l })),
  };

  entries.unshift(reversal);
  writeJSON('journal_entries', entries);

  const totalDebits = entry.lines.reduce((s, l) => s + l.debit, 0);
  addAuditEntry('void', 'journal_entry', entryId, totalDebits, `Voided: ${entry.memo}`, voidedBy || 'admin');

  return reversal;
}

function getJournalEntries(startDate, endDate) {
  let entries = readJSON('journal_entries', []);
  if (startDate) entries = entries.filter(e => e.date >= startDate);
  if (endDate) entries = entries.filter(e => e.date <= endDate + 'T23:59:59');
  return entries.sort((a, b) => b.date.localeCompare(a.date));
}

// ==========================================
// FINANCIAL REPORTS
// ==========================================
function getAccountActivity(startDate, endDate) {
  const entries = getJournalEntries(startDate, endDate).filter(e => !e.isVoid);
  const accounts = getAccounts();
  const activityMap = {};

  for (const entry of entries) {
    for (const line of entry.lines) {
      if (!activityMap[line.accountId]) {
        const acct = accounts.find(a => a.id === line.accountId);
        if (!acct) continue;
        activityMap[line.accountId] = { ...acct, totalDebit: 0, totalCredit: 0 };
      }
      activityMap[line.accountId].totalDebit += line.debit;
      activityMap[line.accountId].totalCredit += line.credit;
    }
  }

  return Object.values(activityMap).map(a => {
    const isNormalDebit = a.type === 'asset' || a.type === 'expense';
    const balance = isNormalDebit ? (a.totalDebit - a.totalCredit) : (a.totalCredit - a.totalDebit);
    return { ...a, balance: Math.round(balance * 100) / 100 };
  }).sort((a, b) => a.code.localeCompare(b.code));
}

function getIncomeStatement(startDate, endDate) {
  const activity = getAccountActivity(startDate, endDate);
  const revenue = activity.filter(a => a.type === 'revenue' && a.balance !== 0);
  const expenses = activity.filter(a => a.type === 'expense' && a.balance !== 0);
  const totalRevenue = revenue.reduce((s, a) => s + a.balance, 0);
  const totalExpenses = expenses.reduce((s, a) => s + a.balance, 0);
  return {
    revenue, expenses,
    totalRevenue: Math.round(totalRevenue * 100) / 100,
    totalExpenses: Math.round(totalExpenses * 100) / 100,
    netIncome: Math.round((totalRevenue - totalExpenses) * 100) / 100,
  };
}

function getBalanceSheet(asOfDate) {
  const activity = getAccountActivity('2000-01-01', asOfDate);
  const assets = activity.filter(a => a.type === 'asset' && a.balance !== 0);
  const liabilities = activity.filter(a => a.type === 'liability' && a.balance !== 0);
  const equity = activity.filter(a => a.type === 'equity' && a.balance !== 0);

  // Add retained earnings (net income from revenue - expenses)
  const revenueExpense = activity.filter(a => a.type === 'revenue' || a.type === 'expense');
  const totalRevenue = activity.filter(a => a.type === 'revenue').reduce((s, a) => s + a.balance, 0);
  const totalExpenses = activity.filter(a => a.type === 'expense').reduce((s, a) => s + a.balance, 0);
  const retainedEarnings = Math.round((totalRevenue - totalExpenses) * 100) / 100;
  if (retainedEarnings !== 0) {
    equity.push({ code: '3900', name: 'Retained Earnings (Current Year)', type: 'equity', balance: retainedEarnings });
  }

  return {
    assets, liabilities, equity,
    totalAssets: Math.round(assets.reduce((s, a) => s + a.balance, 0) * 100) / 100,
    totalLiabilities: Math.round(liabilities.reduce((s, a) => s + a.balance, 0) * 100) / 100,
    totalEquity: Math.round(equity.reduce((s, a) => s + a.balance, 0) * 100) / 100,
  };
}

function getCashFlow(startDate, endDate) {
  const cashAcct = getAccountByCode('1000');
  if (!cashAcct) return { inflows: [], outflows: [], netCashFlow: 0 };

  const entries = getJournalEntries(startDate, endDate).filter(e => !e.isVoid);
  const inflows = [];
  const outflows = [];

  for (const entry of entries) {
    for (const line of entry.lines) {
      if (line.accountId === cashAcct.id) {
        if (line.debit > 0) inflows.push({ description: entry.memo, amount: line.debit, date: entry.date });
        if (line.credit > 0) outflows.push({ description: entry.memo, amount: line.credit, date: entry.date });
      }
    }
  }

  const totalIn = inflows.reduce((s, i) => s + i.amount, 0);
  const totalOut = outflows.reduce((s, i) => s + i.amount, 0);
  return { inflows, outflows, netCashFlow: Math.round((totalIn - totalOut) * 100) / 100 };
}

// ==========================================
// HELPER: Record Revenue / Expense / Draw
// ==========================================
function recordRevenue(input) {
  const { amount, revenueAccountId, paymentMethod, memo, date } = input;
  if (amount <= 0) throw new Error('Amount must be positive');

  const cashAcct = getAccountByCode('1000');
  if (!cashAcct) throw new Error('Cash account not found');

  return postJournalEntry({
    date: date || new Date().toISOString(),
    memo: memo || 'Revenue',
    sourceType: 'revenue',
    lines: [
      { accountId: cashAcct.id, debit: amount, credit: 0, memo: `Payment received (${paymentMethod || 'cash'})` },
      { accountId: revenueAccountId, debit: 0, credit: amount, memo: 'Revenue' },
    ],
  });
}

function recordExpenseEntry(input) {
  const { amount, expenseAccountId, paymentMethod, memo, date, fundingSource } = input;
  if (amount <= 0) throw new Error('Amount must be positive');

  let creditAccountCode = '1000'; // Cash
  if (fundingSource === 'personal') creditAccountCode = '3200'; // Owner Contribution
  else if (fundingSource === 'business_credit_card') creditAccountCode = '2100'; // CC Payable
  else if (paymentMethod === 'credit_card') creditAccountCode = '2100';

  const creditAcct = getAccountByCode(creditAccountCode);
  if (!creditAcct) throw new Error(`Account ${creditAccountCode} not found`);

  return postJournalEntry({
    date: date || new Date().toISOString(),
    memo: memo || 'Expense',
    sourceType: 'expense',
    lines: [
      { accountId: expenseAccountId, debit: amount, credit: 0, memo: memo || 'Expense' },
      { accountId: creditAcct.id, debit: 0, credit: amount, memo: `Paid via ${paymentMethod || 'cash'}` },
    ],
  });
}

function recordOwnerDraw(input) {
  const { amount, memo, date } = input;
  if (amount <= 0) throw new Error('Amount must be positive');

  const cashAcct = getAccountByCode('1000');
  const drawAcct = getAccountByCode('3100');
  if (!cashAcct || !drawAcct) throw new Error('Required accounts not found');

  return postJournalEntry({
    date: date || new Date().toISOString(),
    memo: memo || "Owner's draw",
    sourceType: 'owner_draw',
    lines: [
      { accountId: drawAcct.id, debit: amount, credit: 0, memo: "Owner's draw" },
      { accountId: cashAcct.id, debit: 0, credit: amount, memo: 'Cash out' },
    ],
  });
}

// ==========================================
// VENDORS
// ==========================================
function getVendors() { return readJSON('vendors', []).sort((a, b) => a.name.localeCompare(b.name)); }
function createVendor(data) {
  const vendors = getVendors();
  const vendor = { id: crypto.randomUUID(), name: data.name, email: data.email || '', phone: data.phone || '', address: data.address || '', taxId: data.taxId || '', is1099: data.is1099 || false, isActive: true, createdAt: new Date().toISOString() };
  vendors.push(vendor);
  writeJSON('vendors', vendors);
  return vendor;
}
function updateVendor(id, data) {
  const vendors = getVendors();
  const v = vendors.find(v => v.id === id);
  if (!v) return null;
  Object.assign(v, data);
  writeJSON('vendors', vendors);
  return v;
}

// ==========================================
// EXPENSES (with journal posting)
// ==========================================
function getExpenses(filters) {
  let expenses = readJSON('expenses_ledger', []);
  if (!filters?.includeVoided) expenses = expenses.filter(e => !e.isVoid);
  if (filters?.startDate) expenses = expenses.filter(e => e.date >= filters.startDate);
  if (filters?.endDate) expenses = expenses.filter(e => e.date <= filters.endDate + 'T23:59:59');
  if (filters?.accountId) expenses = expenses.filter(e => e.accountId === filters.accountId);
  if (filters?.vendorId) expenses = expenses.filter(e => e.vendorId === filters.vendorId);
  return expenses.sort((a, b) => b.date.localeCompare(a.date));
}

function createExpense(data, ctx = {}) {
  const actor = ctx.actor || 'admin';
  const expense = {
    id: crypto.randomUUID(),
    vendorId: data.vendorId || null,
    accountId: data.accountId,
    description: data.description,
    amount: parseFloat(data.amount),
    date: data.date,
    paymentMethod: data.paymentMethod || 'card',
    fundingSource: data.fundingSource || 'business_checking',
    checkNumber: data.checkNumber || null,
    projectId: data.projectId || null,
    receiptNotes: data.receiptNotes || null,
    isBillable: data.isBillable || false,
    taxDeductible: data.taxDeductible !== false,
    scheduleCLine: null,
    isRecurring: data.isRecurring || false,
    recurringFrequency: data.recurringFrequency || null,
    isVoid: false,
    journalEntryId: null,
    transactionId: null,
    createdAt: new Date().toISOString(),
  };

  // Get schedule C line from account
  const acct = getAccountById(data.accountId);
  if (acct) expense.scheduleCLine = acct.scheduleCLine;

  // 1) Post to the double-entry journal (Dr Expense / Cr Cash or CC Payable).
  try {
    const entry = recordExpenseEntry({
      amount: expense.amount,
      expenseAccountId: expense.accountId,
      paymentMethod: expense.paymentMethod,
      fundingSource: expense.fundingSource,
      memo: expense.description,
      date: expense.date,
    });
    expense.journalEntryId = entry.id;
  } catch (e) {
    console.error('Failed to post expense to journal:', e.message);
  }

  // 2) Phase 1.4 — Also post to the simple transactions feed so the
  //    dashboard's Total Expenses tile and monthly chart pick it up.
  //    Categorized by the expense account's name (e.g. "Chemicals &
  //    Materials") so the dashboard's breakdown can differentiate.
  try {
    const txn = transactionsRepo.create(
      {
        type: 'expense',
        amount: expense.amount,
        description: expense.description,
        category: acct?.name || 'Uncategorized',
        referenceId: expense.id,
        date: expense.date || new Date().toISOString(),
      },
      {
        actor,
        description: `Expense $${expense.amount.toFixed(2)} — ${expense.description}`,
      }
    );
    expense.transactionId = txn.id;
  } catch (e) {
    console.error('Failed to post expense to transactions feed:', e.message);
  }

  const expenses = readJSON('expenses_ledger', []);
  expenses.unshift(expense);
  writeJSON('expenses_ledger', expenses);
  return expense;
}

function updateExpense(id, data) {
  const expenses = readJSON('expenses_ledger', []);
  const exp = expenses.find(e => e.id === id);
  if (!exp) return null;
  Object.assign(exp, data);
  writeJSON('expenses_ledger', expenses);
  return exp;
}

function voidExpense(id, voidedBy) {
  const expenses = readJSON('expenses_ledger', []);
  const exp = expenses.find(e => e.id === id);
  if (!exp) throw new Error('Expense not found');
  if (exp.isVoid) throw new Error('Already voided');

  exp.isVoid = true;
  writeJSON('expenses_ledger', expenses);

  // 1) Void the journal entry (accounting.voidJournalEntry creates a
  //    reversing entry — never deletes history).
  if (exp.journalEntryId) {
    try { voidJournalEntry(exp.journalEntryId, voidedBy); } catch {}
  }

  // 2) Phase 1.4 — Also post a negative-amount reversal transaction to the
  //    simple transactions feed so the dashboard's Total Expenses tile
  //    updates correctly. Original transaction stays put (audit integrity);
  //    the negative row makes the net sum correct.
  if (exp.transactionId) {
    const original = transactionsRepo.find(exp.transactionId);
    if (original) {
      try {
        transactionsRepo.create(
          {
            type: original.type,
            amount: -Number(exp.amount),
            description: `REVERSAL: ${original.description}`,
            category: original.category,
            referenceId: exp.transactionId,
            reversalOf: exp.transactionId,
            date: new Date().toISOString(),
          },
          {
            actor: voidedBy || 'admin',
            description: `Reversal transaction for voided expense ${exp.id.slice(0, 8)}`,
          }
        );
      } catch (e) {
        console.error('Failed to post expense reversal transaction:', e.message);
      }
    }
  }

  addAuditEntry('void', 'expense', id, exp.amount, `Voided expense: ${exp.description}`, voidedBy);
  return exp;
}

// ==========================================
// BILLS (Accounts Payable)
// ==========================================
function getBills(filters) {
  let bills = readJSON('bills_ledger', []);
  if (filters?.status) bills = bills.filter(b => b.status === filters.status);
  if (filters?.vendorId) bills = bills.filter(b => b.vendorId === filters.vendorId);
  return bills.sort((a, b) => b.dueDate.localeCompare(a.dueDate));
}

function createBill(data) {
  const bill = {
    id: crypto.randomUUID(),
    vendorId: data.vendorId,
    accountId: data.accountId || null,
    amount: parseFloat(data.amount),
    paidAmount: 0,
    dueDate: data.dueDate,
    paidDate: null,
    status: 'pending',
    description: data.description || '',
    reference: data.reference || '',
    journalEntryId: null,
    createdAt: new Date().toISOString(),
  };

  // Post AP journal entry
  const apAcct = getAccountByCode('2000');
  const expAcct = data.accountId ? getAccountById(data.accountId) : getAccountByCode('9500');
  if (apAcct && expAcct) {
    try {
      const entry = postJournalEntry({
        date: data.dueDate, memo: data.description || 'Bill', sourceType: 'bill',
        lines: [
          { accountId: expAcct.id, debit: bill.amount, credit: 0, memo: 'Bill expense' },
          { accountId: apAcct.id, debit: 0, credit: bill.amount, memo: 'AP liability' },
        ],
      });
      bill.journalEntryId = entry.id;
    } catch {}
  }

  const bills = readJSON('bills_ledger', []);
  bills.unshift(bill);
  writeJSON('bills_ledger', bills);
  return bill;
}

function recordBillPayment(billId, amount, paymentMethod, memo, ctx = {}) {
  const actor = ctx.actor || 'admin';
  const bills = readJSON('bills_ledger', []);
  const bill = bills.find(b => b.id === billId);
  if (!bill) throw new Error('Bill not found');

  const remaining = bill.amount - bill.paidAmount;
  if (amount > remaining + 0.01) throw new Error(`Payment exceeds remaining balance ($${remaining.toFixed(2)})`);

  // 1) Post payment journal (Dr AP / Cr Cash) — reduces the liability
  //    and moves cash out.
  let journalEntryId = null;
  const cashAcct = getAccountByCode('1000');
  const apAcct = getAccountByCode('2000');
  if (cashAcct && apAcct) {
    const entry = postJournalEntry({
      date: new Date().toISOString(),
      memo: memo || `Bill payment: ${bill.description}`,
      sourceType: 'bill_payment',
      lines: [
        { accountId: apAcct.id, debit: amount, credit: 0, memo: 'AP payment' },
        { accountId: cashAcct.id, debit: 0, credit: amount, memo: 'Cash out' },
      ],
    });
    journalEntryId = entry.id;
  }

  // 2) Phase 1.4 — Post an expense row to the simple transactions feed.
  //    This is cash-basis reporting: the expense tile only moves when cash
  //    actually leaves. The original expense was accrued via Dr Expense /
  //    Cr AP on createBill, but the dashboard doesn't count accrued
  //    expenses until payment.
  const expenseAcct = bill.accountId ? getAccountById(bill.accountId) : null;
  let transactionId = null;
  try {
    const txn = transactionsRepo.create(
      {
        type: 'expense',
        amount,
        description: `Bill payment: ${bill.description || bill.reference || 'Bill'}`,
        category: expenseAcct?.name || 'Accounts Payable',
        referenceId: bill.id,
        date: new Date().toISOString(),
      },
      {
        actor,
        description: `Expense $${amount.toFixed(2)} — Bill payment ${bill.id.slice(0, 8)}`,
      }
    );
    transactionId = txn.id;
  } catch (e) {
    console.error('Failed to post bill payment to transactions feed:', e.message);
  }

  const payment = {
    id: crypto.randomUUID(),
    billId,
    amount,
    paymentMethod,
    memo: memo || '',
    journalEntryId,
    transactionId,
    paidAt: new Date().toISOString(),
  };
  const payments = readJSON('bill_payments', []);
  payments.unshift(payment);
  writeJSON('bill_payments', payments);

  bill.paidAmount += amount;
  if (bill.paidAmount >= bill.amount - 0.01) {
    bill.status = 'paid';
    bill.paidDate = new Date().toISOString();
  } else {
    bill.status = 'partially_paid';
  }
  writeJSON('bills_ledger', bills);

  return { bill, payment };
}

// Phase 1.4 — List payments for a bill, newest first. Excludes voided
// payments by default so the UI's "active history" doesn't grow forever;
// pass { includeVoided: true } to see the full audit trail.
function getBillPayments(billId, { includeVoided = false } = {}) {
  const all = readJSON('bill_payments', []).filter(p => p.billId === billId);
  const filtered = includeVoided ? all : all.filter(p => !p.isVoid);
  return filtered.sort((a, b) => (b.paidAt || '').localeCompare(a.paidAt || ''));
}

// Phase 1.4 — Reverse a bill payment. Voids the linked journal entry
// (creates a mirror reversing entry via accounting.voidJournalEntry),
// adds a negative-amount reversal transaction to the dashboard feed,
// and adjusts the bill's paidAmount and derived status. The original
// bill_payments row is marked isVoid=true — never deleted, so the
// audit trail is preserved.
function voidBillPayment(paymentId, ctx = {}) {
  const actor = ctx.actor || 'admin';
  const payments = readJSON('bill_payments', []);
  const payment = payments.find(p => p.id === paymentId);
  if (!payment) throw new Error('Payment not found');
  if (payment.isVoid) throw new Error('Already voided');

  // 1) Void journal entry — creates the mirror reversing entry.
  if (payment.journalEntryId) {
    try { voidJournalEntry(payment.journalEntryId, actor); } catch (e) {
      console.error('Failed to void bill payment journal entry:', e.message);
    }
  }

  // 2) Add reversal transaction so dashboard totals update.
  if (payment.transactionId) {
    const original = transactionsRepo.find(payment.transactionId);
    if (original) {
      try {
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
            actor,
            description: `Reversal transaction for voided bill payment ${payment.id.slice(0, 8)}`,
          }
        );
      } catch (e) {
        console.error('Failed to post bill payment reversal transaction:', e.message);
      }
    }
  }

  // 3) Mark the payment row voided (don't delete — audit integrity).
  payment.isVoid = true;
  payment.voidedAt = new Date().toISOString();
  payment.voidedBy = actor;
  writeJSON('bill_payments', payments);

  // 4) Adjust the bill's paidAmount and re-derive status.
  const bills = readJSON('bills_ledger', []);
  const bill = bills.find(b => b.id === payment.billId);
  if (bill) {
    bill.paidAmount = Math.max(0, (Number(bill.paidAmount) || 0) - Number(payment.amount));
    if (bill.paidAmount <= 0.005) {
      bill.status = 'pending';
      bill.paidDate = null;
    } else if (bill.paidAmount < bill.amount - 0.005) {
      bill.status = 'partially_paid';
      bill.paidDate = null;
    }
    writeJSON('bills_ledger', bills);
  }

  addAuditEntry('void', 'bill_payment', paymentId, payment.amount, `Voided bill payment: ${payment.memo || payment.billId.slice(0, 8)}`, actor);
  return { payment, bill };
}

// ==========================================
// BUDGETS
// ==========================================
function getBudgets(year) {
  return readJSON('budgets', []).filter(b => b.year === year);
}

function saveBudgets(items, year) {
  let budgets = readJSON('budgets', []);
  // Remove existing for this year
  budgets = budgets.filter(b => b.year !== year);
  for (const item of items) {
    if (!item.accountId || !item.amount) continue;
    budgets.push({
      id: crypto.randomUUID(),
      accountId: item.accountId,
      year,
      amount: parseFloat(item.amount),
      createdAt: new Date().toISOString(),
    });
  }
  writeJSON('budgets', budgets);
  return budgets.filter(b => b.year === year);
}

function getBudgetVsActual(year, period, month, quarter) {
  const accounts = getAccounts().filter(a => a.type === 'expense' && a.isActive);
  const budgets = getBudgets(year);

  let dateStart, dateEnd;
  if (period === 'month' && month) {
    dateStart = `${year}-${String(month).padStart(2, '0')}-01`;
    dateEnd = `${year}-${String(month).padStart(2, '0')}-31`;
  } else if (period === 'quarter' && quarter) {
    const qStart = (quarter - 1) * 3 + 1;
    dateStart = `${year}-${String(qStart).padStart(2, '0')}-01`;
    dateEnd = `${year}-${String(qStart + 2).padStart(2, '0')}-31`;
  } else {
    dateStart = `${year}-01-01`;
    dateEnd = `${year}-12-31`;
  }

  const activity = getAccountActivity(dateStart, dateEnd);
  const activityMap = {};
  for (const a of activity) activityMap[a.id] = a.balance;

  const budgetMap = {};
  for (const b of budgets) {
    let amt = b.amount;
    if (period === 'month') amt = b.amount / 12;
    else if (period === 'quarter') amt = b.amount / 4;
    budgetMap[b.accountId] = (budgetMap[b.accountId] || 0) + amt;
  }

  const report = accounts
    .filter(a => budgetMap[a.id] || activityMap[a.id])
    .map(a => {
      const budgeted = Math.round((budgetMap[a.id] || 0) * 100) / 100;
      const actual = Math.round((activityMap[a.id] || 0) * 100) / 100;
      const variance = Math.round((budgeted - actual) * 100) / 100;
      const percentUsed = budgeted > 0 ? Math.round((actual / budgeted) * 10000) / 100 : (actual > 0 ? 999 : 0);
      return { accountId: a.id, accountNumber: a.code, accountName: a.name, budgeted, actual, variance, percentUsed, status: actual > budgeted ? 'over' : 'under' };
    })
    .sort((a, b) => a.accountNumber.localeCompare(b.accountNumber));

  const totals = report.reduce((acc, r) => ({
    budgeted: acc.budgeted + r.budgeted, actual: acc.actual + r.actual,
  }), { budgeted: 0, actual: 0 });

  return {
    report, totals: {
      ...totals,
      variance: Math.round((totals.budgeted - totals.actual) * 100) / 100,
      percentUsed: totals.budgeted > 0 ? Math.round((totals.actual / totals.budgeted) * 10000) / 100 : 0,
    },
    period, year, month, quarter,
  };
}

// ==========================================
// TAX
// ==========================================
function getTaxSettings() { return readJSON('tax_settings', { federalRate: '22', stateRate: '5', stateName: 'Oklahoma', filingType: 'sole_prop', selfEmploymentRate: '15.3', qbiDeduction: true, taxpayerName: 'Jimmy Manharth', taxpayerSSN: '', spouseName: '', spouseSSN: '', address: '', city: 'Edmond', taxState: 'OK', zip: '' }); }
function saveTaxSettings(data) { writeJSON('tax_settings', data); return data; }

function getQuarterlyPayments(year) { return readJSON('quarterly_payments', []).filter(p => p.year === year).sort((a, b) => a.quarter - b.quarter); }
function saveQuarterlyPayment(data) {
  const payments = readJSON('quarterly_payments', []);
  const idx = payments.findIndex(p => p.year === data.year && p.quarter === data.quarter);
  if (idx >= 0) { Object.assign(payments[idx], data); } else { payments.push({ id: crypto.randomUUID(), ...data }); }
  writeJSON('quarterly_payments', payments);
  return payments.find(p => p.year === data.year && p.quarter === data.quarter);
}

// ==========================================
// AUDIT LOG (delegates to audit-helpers for a single source of truth)
// ==========================================
function addAuditEntry(action, recordType, recordId, amount, description, performedBy) {
  recordAudit({
    action,
    recordType,
    recordId,
    amount,
    description,
    actor: performedBy,
  });
}

function getAuditLogs(filters) {
  const { queryAudit } = require('./audit-helpers');
  return queryAudit(filters || {});
}

// Initialize accounts on load
seedAccounts();

module.exports = {
  getAccounts, getAccountById, getAccountByCode, createAccount,
  postJournalEntry, voidJournalEntry, getJournalEntries,
  getIncomeStatement, getBalanceSheet, getCashFlow, getAccountActivity,
  recordRevenue, recordExpenseEntry, recordOwnerDraw,
  getVendors, createVendor, updateVendor,
  getExpenses, createExpense, updateExpense, voidExpense,
  getBills, createBill, recordBillPayment, voidBillPayment, getBillPayments,
  getBudgets, saveBudgets, getBudgetVsActual,
  getTaxSettings, saveTaxSettings, getQuarterlyPayments, saveQuarterlyPayment,
  addAuditEntry, getAuditLogs,
};
