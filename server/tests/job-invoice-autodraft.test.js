// Integration tests for Phase 1.1 — Job -> Invoice auto-draft on Completed.

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

  const res = await request(server, 'POST', '/api/admin/login', {
    body: { email: 'jmanharth@gmail.com', password: 'Password26!' },
  });
  token = res.body.token;
});

test.after(() => {
  if (server) server.close();
  tmp.cleanup();
});

async function createJob(fields = {}) {
  const res = await request(server, 'POST', '/api/admin/jobs', {
    token,
    body: {
      customerName: 'Auto Draft Tester',
      serviceType: 'Termite Treatment',
      phone: '405-555-1100',
      email: 'draft@example.com',
      address: '123 Main St, Edmond, OK',
      ...fields,
    },
  });
  assert.equal(res.status, 200, 'job creation should succeed');
  return res.body.job;
}

async function getInvoices() {
  const res = await request(server, 'GET', '/api/admin/invoices', { token });
  return res.body.invoices || [];
}

test('patching a job to completed auto-drafts a linked invoice', async () => {
  const job = await createJob();

  const before = (await getInvoices()).filter(i => i.jobId === job.id);
  assert.equal(before.length, 0, 'no invoice should exist before completion');

  const patchRes = await request(server, 'PATCH', `/api/admin/jobs/${job.id}`, {
    token,
    body: { status: 'completed' },
  });
  assert.equal(patchRes.status, 200);
  assert.ok(patchRes.body.autoInvoice, 'response should include the auto-drafted invoice');

  const after = (await getInvoices()).filter(i => i.jobId === job.id);
  assert.equal(after.length, 1, 'exactly one invoice should exist after completion');

  const inv = after[0];
  assert.equal(inv.status, 'draft');
  assert.equal(inv.jobId, job.id);
  assert.equal(inv.customerName, 'Auto Draft Tester');
  assert.equal(inv.customerEmail, 'draft@example.com');
  assert.equal(inv.customerAddress, '123 Main St, Edmond, OK');
  assert.ok(inv.invoiceNumber.startsWith('FL-'), 'invoice number format');
  assert.ok(Array.isArray(inv.items) && inv.items.length === 1);
  assert.equal(inv.items[0].description, 'Termite Treatment');
  assert.equal(inv.items[0].quantity, 1);
  assert.equal(inv.items[0].rate, 0);
  assert.equal(inv.subtotal, 0);
  assert.equal(inv.tax, 0);
  assert.equal(inv.total, 0);
  assert.ok(inv.dueDate, 'due date should be populated');

  // Due date should be ~30 days from now
  const due = new Date(inv.dueDate);
  const now = new Date();
  const diffDays = Math.round((due - now) / 86400000);
  assert.ok(diffDays >= 29 && diffDays <= 31, `due date should be ~30 days out, got ${diffDays}`);
});

test('auto-draft is idempotent — patching status=completed twice creates only one invoice', async () => {
  const job = await createJob({ customerName: 'Idempotency Test' });

  const first = await request(server, 'PATCH', `/api/admin/jobs/${job.id}`, {
    token,
    body: { status: 'completed' },
  });
  assert.equal(first.status, 200);
  const firstInvoice = first.body.autoInvoice;
  assert.ok(firstInvoice);

  // Second PATCH with the same status should NOT create a new invoice
  const second = await request(server, 'PATCH', `/api/admin/jobs/${job.id}`, {
    token,
    body: { status: 'completed' },
  });
  assert.equal(second.status, 200);
  assert.equal(second.body.autoInvoice, null, 'second completion should not create another invoice');

  const invoicesForJob = (await getInvoices()).filter(i => i.jobId === job.id);
  assert.equal(invoicesForJob.length, 1, 'only one invoice for this job');
});

test('auto-draft does not duplicate when a manual invoice already exists for the job', async () => {
  const job = await createJob({ customerName: 'Manual First Tester' });

  // Manually create an invoice from the job BEFORE marking it completed.
  const manual = await request(server, 'POST', `/api/admin/jobs/${job.id}/invoice`, {
    token,
    body: { items: [{ description: 'Special inspection', quantity: 1, rate: 250 }] },
  });
  assert.equal(manual.status, 200);
  const manualInvoiceId = manual.body.invoice.id;

  // Now complete the job — should NOT create a second invoice
  const patch = await request(server, 'PATCH', `/api/admin/jobs/${job.id}`, {
    token,
    body: { status: 'completed' },
  });
  assert.equal(patch.status, 200);
  assert.equal(patch.body.autoInvoice, null);

  const invoicesForJob = (await getInvoices()).filter(i => i.jobId === job.id);
  assert.equal(invoicesForJob.length, 1, 'should still only have the manual invoice');
  assert.equal(invoicesForJob[0].id, manualInvoiceId);
  // The manual invoice retains its custom rate, not the zero draft
  assert.equal(invoicesForJob[0].items[0].rate, 250);
});

test('auto-draft fires on POST when a job is created directly as completed', async () => {
  const res = await request(server, 'POST', '/api/admin/jobs', {
    token,
    body: {
      customerName: 'Born Complete',
      serviceType: 'General Pest Control',
      status: 'completed',
    },
  });
  assert.equal(res.status, 200);
  assert.ok(res.body.autoInvoice, 'auto-draft should fire for a job born in completed state');
  assert.equal(res.body.autoInvoice.jobId, res.body.job.id);
  assert.equal(res.body.autoInvoice.items[0].description, 'General Pest Control');
});

test('auto-draft does NOT fire for non-completed statuses', async () => {
  const job = await createJob({ customerName: 'In Progress Tester' });

  for (const status of ['scheduled', 'in_progress']) {
    const res = await request(server, 'PATCH', `/api/admin/jobs/${job.id}`, {
      token,
      body: { status },
    });
    assert.equal(res.status, 200);
    assert.equal(res.body.autoInvoice, null, `status=${status} should not auto-draft`);
  }

  const invoicesForJob = (await getInvoices()).filter(i => i.jobId === job.id);
  assert.equal(invoicesForJob.length, 0);
});

test('auto-draft audit event is recorded and attributed to the user who completed the job', async () => {
  const job = await createJob({ customerName: 'Audit Trail Tester' });

  await request(server, 'PATCH', `/api/admin/jobs/${job.id}`, {
    token,
    body: { status: 'completed' },
  });

  const audit = await request(server, 'GET', '/api/admin/audit-log?recordType=invoices&action=create', { token });
  assert.equal(audit.status, 200);
  // Auto-drafts are attributed to the user who triggered the status change,
  // not to a faceless 'system' actor. That way the audit trail reads:
  // "Jimmy marked job X complete" followed immediately by "Jimmy auto-drafted
  // invoice Y" — a clean causal chain.
  const event = audit.body.logs.find(l =>
    l.after && l.after.jobId === job.id && /Auto-drafted invoice/.test(l.description || '')
  );
  assert.ok(event, 'expected an auto-drafted invoice audit event');
  assert.equal(event.performedBy, 'jmanharth@gmail.com', 'auto-draft should be attributed to the user who completed the job');
});

test('end-to-end flow: Lead -> Convert -> Complete job -> auto-drafted invoice linked to job', async () => {
  // Create a lead via the public form
  await request(server, 'POST', '/api/contact', {
    body: {
      name: 'End To End Customer',
      phone: '405-555-5555',
      email: 'e2e@example.com',
      service: 'Inspection',
      message: 'Flow test',
    },
  });

  // Find it via admin
  const leads = (await request(server, 'GET', '/api/admin/leads', { token })).body.leads;
  const lead = leads.find(l => l.name === 'End To End Customer');
  assert.ok(lead);

  // Convert to Job
  const conv = await request(server, 'POST', `/api/admin/leads/${lead.id}/convert`, { token, body: {} });
  assert.equal(conv.status, 200);
  const job = conv.body.job;
  assert.equal(job.leadId, lead.id);

  // Complete the job -> should auto-draft
  const done = await request(server, 'PATCH', `/api/admin/jobs/${job.id}`, {
    token,
    body: { status: 'completed' },
  });
  assert.equal(done.status, 200);
  assert.ok(done.body.autoInvoice);

  const inv = done.body.autoInvoice;
  assert.equal(inv.jobId, job.id);
  assert.equal(inv.customerName, 'End To End Customer');
  assert.equal(inv.items[0].description, 'Inspection');
  assert.equal(inv.status, 'draft');
});
