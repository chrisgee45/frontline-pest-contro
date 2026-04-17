// Integration tests for the Send Invoice feature.
// SMTP isn't configured in test env, so sends return { sent: false,
// reason: 'SMTP not configured...' } — but the status transition and
// audit event should fire regardless, and the endpoint should never
// leave the user without a clear outcome.

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

async function createInvoice(customerEmail = 'cust@example.com', amount = 150) {
  const res = await request(server, 'POST', '/api/admin/invoices', {
    token,
    body: {
      customerName: 'Send Test Customer',
      customerEmail,
      items: [{ description: 'Termite Treatment', quantity: 1, rate: amount }],
    },
  });
  return res.body.invoice;
}

test('POST /invoices/:id/send flips draft -> sent and records a send audit event', async () => {
  const inv = await createInvoice('happy@example.com', 200);
  assert.equal(inv.status, 'draft');

  const res = await request(server, 'POST', `/api/admin/invoices/${inv.id}/send`, { token, body: {} });
  assert.equal(res.status, 200);
  assert.equal(res.body.success, true);
  assert.equal(res.body.recipient, 'happy@example.com');
  // SMTP isn't configured in tests -> emailed is false with a clear reason
  assert.equal(res.body.emailed, false);
  assert.ok(/SMTP not configured/i.test(res.body.reason), 'reason should explain SMTP is not configured');
  // Status should still have flipped
  assert.equal(res.body.invoice.baseStatus, 'sent');
  assert.equal(res.body.invoice.effectiveStatus, 'sent');

  // Audit trail has a 'send' event
  const audit = await request(server, 'GET', `/api/admin/audit-log?action=send&recordType=invoices`, { token });
  const event = audit.body.logs.find(l => l.recordId === inv.id);
  assert.ok(event, 'expected a send audit event');
  assert.equal(event.performedBy, 'jmanharth@gmail.com');
  assert.equal(event.context.recipient, 'happy@example.com');
});

test('sending an invoice that has no customer email still marks sent (fallback path)', async () => {
  const inv = await createInvoice('', 120); // no email
  assert.equal(inv.customerEmail, '');

  const res = await request(server, 'POST', `/api/admin/invoices/${inv.id}/send`, { token, body: {} });
  assert.equal(res.status, 200);
  assert.equal(res.body.emailed, false);
  assert.equal(res.body.reason, 'no customer email');
  assert.equal(res.body.invoice.baseStatus, 'sent', 'status should still transition');

  const audit = await request(server, 'GET', `/api/admin/audit-log?action=send&recordType=invoices`, { token });
  const event = audit.body.logs.find(l => l.recordId === inv.id);
  assert.ok(event);
  assert.equal(event.context.emailed, false);
  assert.equal(event.context.reason, 'no customer email');
});

test('Send endpoint accepts an override recipient in the body', async () => {
  const inv = await createInvoice('original@example.com', 80);

  const res = await request(server, 'POST', `/api/admin/invoices/${inv.id}/send`, {
    token,
    body: { to: 'override@example.com' },
  });
  assert.equal(res.status, 200);
  assert.equal(res.body.recipient, 'override@example.com');
});

test('Send on an already-sent invoice is idempotent on status but still audits each send attempt', async () => {
  const inv = await createInvoice('repeat@example.com', 300);

  // Send once -> status -> sent
  await request(server, 'POST', `/api/admin/invoices/${inv.id}/send`, { token, body: {} });
  // Send again — status stays sent, audit gets a second event
  const res2 = await request(server, 'POST', `/api/admin/invoices/${inv.id}/send`, { token, body: {} });
  assert.equal(res2.body.invoice.baseStatus, 'sent');

  const audit = await request(server, 'GET', `/api/admin/audit-log?action=send&recordType=invoices&q=${inv.id}`, { token });
  const events = audit.body.logs.filter(l => l.recordId === inv.id);
  assert.ok(events.length >= 2, 'expected at least two send events for the re-send');
});

test('404 on a missing invoice id', async () => {
  const res = await request(server, 'POST', '/api/admin/invoices/nope/send', { token, body: {} });
  assert.equal(res.status, 404);
});
