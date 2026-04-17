// Integration tests for Phase 1.4 — Bill/Expense -> Accounting auto-post
// with reversal on void. Exercises:
//   - Expense creation posts to BOTH transactions feed and journal
//   - Expense void adds a reversal transaction + reversing journal entry
//   - Bill payment posts to both feeds
//   - Bill payment void reverses both sides AND adjusts the bill's
//     paidAmount back down

const test = require('node:test');
const assert = require('node:assert/strict');
const { useTempDataDir, request } = require('./helpers');

const tmp = useTempDataDir();
const app = require('../index');

let server;
let token;

test.before(async () => {
  server = app.listen(0);
  await new Promise(r => server.on('listening', r));
  const login = await request(server, 'POST', '/api/admin/login', {
    body: { email: 'jmanharth@gmail.com', password: 'Password26!' },
  });
  token = login.body.token;
});

test.after(() => {
  if (server) server.close();
  tmp.cleanup();
});

async function getDashboard() {
  const r = await request(server, 'GET', '/api/admin/dashboard', { token });
  return r.body;
}

async function getTransactions() {
  const r = await request(server, 'GET', '/api/admin/transactions', { token });
  return r.body.transactions || [];
}

async function getJournalEntries() {
  const r = await request(server, 'GET', '/api/accounting/journal-entries', { token });
  return r.body.data || [];
}

async function getSuppliesAccountId() {
  const r = await request(server, 'GET', '/api/accounting/accounts', { token });
  const accounts = r.body.data || [];
  return accounts.find(a => a.code === '8600')?.id; // Supplies
}

async function createVendor(name = 'Acme Supply Co') {
  const r = await request(server, 'POST', '/api/accounting/vendors', {
    token,
    body: { name },
  });
  return r.body.data;
}

test('creating an expense posts to BOTH the transactions feed AND the journal', async () => {
  const suppliesId = await getSuppliesAccountId();
  const before = await getDashboard();

  const res = await request(server, 'POST', '/api/accounting/expenses', {
    token,
    body: {
      accountId: suppliesId,
      description: 'Ant gel bait bulk',
      amount: 89.50,
      date: new Date().toISOString().slice(0, 10),
      paymentMethod: 'card',
    },
  });
  assert.equal(res.status, 200);
  const exp = res.body.data;
  assert.ok(exp.id);
  assert.ok(exp.transactionId, 'expense should now be linked to a transactions-feed row');
  assert.ok(exp.journalEntryId, 'expense should still be linked to a journal entry');

  const after = await getDashboard();
  const expenseIncrement = Math.round((after.revenue.expenses - before.revenue.expenses) * 100) / 100;
  assert.equal(expenseIncrement, 89.50, 'dashboard Total Expenses should increase by the expense amount');

  const txns = await getTransactions();
  const txn = txns.find(t => t.id === exp.transactionId);
  assert.ok(txn);
  assert.equal(txn.type, 'expense');
  assert.equal(txn.amount, 89.50);
  assert.equal(txn.referenceId, exp.id);
  assert.equal(txn.category, 'Supplies');
});

test('voiding an expense creates a reversal transaction AND a reversing journal entry', async () => {
  const suppliesId = await getSuppliesAccountId();

  const create = await request(server, 'POST', '/api/accounting/expenses', {
    token,
    body: {
      accountId: suppliesId,
      description: 'To be voided',
      amount: 50,
      date: new Date().toISOString().slice(0, 10),
    },
  });
  const exp = create.body.data;
  const expenseTxnId = exp.transactionId;
  const journalEntryId = exp.journalEntryId;

  const before = await getDashboard();
  const beforeJE = await getJournalEntries();
  const originalEntry = beforeJE.find(e => e.id === journalEntryId);
  assert.ok(originalEntry, 'original journal entry should exist');
  assert.equal(originalEntry.isVoid, false);

  // Void it
  const voidRes = await request(server, 'POST', `/api/accounting/expenses/${exp.id}/void`, { token });
  assert.equal(voidRes.status, 200);

  // Journal side: original now marked void, reversing entry exists
  const afterJE = await getJournalEntries();
  const voidedOriginal = afterJE.find(e => e.id === journalEntryId);
  assert.equal(voidedOriginal.isVoid, true);
  const reversingEntry = afterJE.find(e => e.sourceType === 'reversal' && e.sourceId === journalEntryId);
  assert.ok(reversingEntry, 'a reversing journal entry should exist');

  // Transactions side: a negative reversal row should exist
  const txns = await getTransactions();
  const reversalTxn = txns.find(t => t.reversalOf === expenseTxnId);
  assert.ok(reversalTxn, 'expected a reversal transaction for the voided expense');
  assert.equal(reversalTxn.amount, -50);
  assert.equal(reversalTxn.type, 'expense');

  // Dashboard: Total Expenses goes down by 50 (original +50 + reversal -50 = net 0)
  const after = await getDashboard();
  const change = Math.round((after.revenue.expenses - before.revenue.expenses) * 100) / 100;
  assert.equal(change, -50, 'dashboard Total Expenses should drop by the voided amount');
});

test('marking a bill paid posts the payment to the transactions feed and dashboard picks it up', async () => {
  const vendor = await createVendor('Bill Pay Tester Vendor');

  const billRes = await request(server, 'POST', '/api/accounting/bills', {
    token,
    body: {
      vendorId: vendor.id,
      amount: 200,
      dueDate: new Date().toISOString().slice(0, 10),
      description: 'Monthly chemical supply',
    },
  });
  const bill = billRes.body.data;

  // Creating the bill alone doesn't move the expense tile — it accrues as AP.
  // Only the payment moves cash (and therefore the dashboard tile).
  const before = await getDashboard();
  const payRes = await request(server, 'POST', `/api/accounting/bills/${bill.id}/pay`, {
    token,
    body: { amount: 200, paymentMethod: 'cash', memo: 'Full payment' },
  });
  assert.equal(payRes.status, 200);
  const payment = payRes.body.data.payment;
  assert.ok(payment.transactionId, 'bill payment should link to the transactions feed');
  assert.ok(payment.journalEntryId, 'bill payment should link to a journal entry');

  const after = await getDashboard();
  const delta = Math.round((after.revenue.expenses - before.revenue.expenses) * 100) / 100;
  assert.equal(delta, 200, 'dashboard Total Expenses should increase by the payment amount');

  // Updated bill should show paid
  assert.equal(payRes.body.data.bill.status, 'paid');
  assert.ok(payRes.body.data.bill.paidDate);
});

test('voiding a bill payment reverses both feeds AND drops paidAmount back to zero', async () => {
  const vendor = await createVendor('Void Bill Pay Vendor');
  const billRes = await request(server, 'POST', '/api/accounting/bills', {
    token,
    body: {
      vendorId: vendor.id,
      amount: 400,
      dueDate: new Date().toISOString().slice(0, 10),
      description: 'Quarterly license',
    },
  });
  const bill = billRes.body.data;

  // Partial payment of $150, then full payment of $250
  const pay1 = await request(server, 'POST', `/api/accounting/bills/${bill.id}/pay`, {
    token,
    body: { amount: 150, paymentMethod: 'card' },
  });
  const pay2 = await request(server, 'POST', `/api/accounting/bills/${bill.id}/pay`, {
    token,
    body: { amount: 250, paymentMethod: 'check' },
  });
  assert.equal(pay2.body.data.bill.status, 'paid');

  const beforeVoid = await getDashboard();

  // Void the $150 payment
  const voidRes = await request(server, 'POST', `/api/accounting/bill-payments/${pay1.body.data.payment.id}/void`, { token });
  assert.equal(voidRes.status, 200);
  const updatedBill = voidRes.body.data.bill;

  // Bill should be back to partially_paid with $250 remaining paid
  assert.equal(updatedBill.paidAmount, 250);
  assert.equal(updatedBill.status, 'partially_paid');

  // Dashboard Total Expenses should drop by 150 (the reversed portion)
  const afterVoid = await getDashboard();
  const delta = Math.round((afterVoid.revenue.expenses - beforeVoid.revenue.expenses) * 100) / 100;
  assert.equal(delta, -150);

  // Verify the journal entry reversal exists
  const entries = await getJournalEntries();
  const originalEntry = entries.find(e => e.id === pay1.body.data.payment.journalEntryId);
  assert.equal(originalEntry.isVoid, true);
  const reversing = entries.find(e => e.sourceType === 'reversal' && e.sourceId === originalEntry.id);
  assert.ok(reversing);

  // Trying to void the same payment again returns an error
  const again = await request(server, 'POST', `/api/accounting/bill-payments/${pay1.body.data.payment.id}/void`, { token });
  assert.equal(again.status, 400);
  assert.ok(/already voided/i.test(again.body.error));
});

test('voiding the ONLY payment on a bill puts it back to pending', async () => {
  const vendor = await createVendor('Single Payment Vendor');
  const billRes = await request(server, 'POST', '/api/accounting/bills', {
    token,
    body: {
      vendorId: vendor.id,
      amount: 100,
      dueDate: new Date().toISOString().slice(0, 10),
      description: 'One-time bill',
    },
  });
  const bill = billRes.body.data;

  const payRes = await request(server, 'POST', `/api/accounting/bills/${bill.id}/pay`, {
    token,
    body: { amount: 100, paymentMethod: 'cash' },
  });
  assert.equal(payRes.body.data.bill.status, 'paid');

  const voidRes = await request(server, 'POST', `/api/accounting/bill-payments/${payRes.body.data.payment.id}/void`, { token });
  const b = voidRes.body.data.bill;
  assert.equal(b.paidAmount, 0);
  assert.equal(b.status, 'pending');
  assert.equal(b.paidDate, null);
});

test('expense reversal attribution: actor is preserved on the reversal transaction', async () => {
  const suppliesId = await getSuppliesAccountId();
  const create = await request(server, 'POST', '/api/accounting/expenses', {
    token,
    body: {
      accountId: suppliesId,
      description: 'Actor attribution test',
      amount: 25,
      date: new Date().toISOString().slice(0, 10),
    },
  });
  const exp = create.body.data;

  await request(server, 'POST', `/api/accounting/expenses/${exp.id}/void`, { token });

  // Search audit log for the reversal transaction's create event
  const auditRes = await request(server, 'GET', '/api/admin/audit-log?recordType=transactions&q=REVERSAL', { token });
  const reversalEvent = auditRes.body.logs.find(l =>
    l.after && l.after.reversalOf === exp.transactionId
  );
  assert.ok(reversalEvent, 'expected a create audit event for the reversal transaction');
  assert.equal(reversalEvent.performedBy, 'jmanharth@gmail.com',
    'reversal should be attributed to the logged-in user who voided it');
});
