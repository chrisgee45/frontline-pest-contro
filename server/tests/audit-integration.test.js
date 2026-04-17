// Integration tests for Task 1.5 — real audit trail via centralized repo.
// Mounts the actual Express app on a temp port with an isolated data dir
// and exercises the full HTTP surface.

const test = require('node:test');
const assert = require('node:assert/strict');
const { useTempDataDir, request } = require('./helpers');

const tmp = useTempDataDir();
const app = require('../index');

let server;
let token;

test.before(async () => {
  server = app.listen(0); // ephemeral port
  // Wait for the listener to actually bind
  await new Promise(resolve => server.on('listening', resolve));
});

test.after(() => {
  if (server) server.close();
  tmp.cleanup();
});

async function login() {
  const res = await request(server, 'POST', '/api/admin/login', {
    body: { email: 'jmanharth@gmail.com', password: 'Password26!' },
  });
  assert.equal(res.status, 200);
  assert.ok(res.body.token);
  return res.body.token;
}

test('health check responds', async () => {
  const res = await request(server, 'GET', '/api/health');
  assert.equal(res.status, 200);
  assert.deepEqual(res.body, { status: 'ok' });
});

test('login succeeds and audits the session', async () => {
  token = await login();
  const audit = await request(server, 'GET', '/api/admin/audit-log?action=login', { token });
  assert.equal(audit.status, 200);
  assert.ok(audit.body.logs.length >= 1, 'login should appear in audit log');
  const last = audit.body.logs[0];
  assert.equal(last.action, 'login');
  assert.equal(last.recordType, 'session');
  assert.equal(last.performedBy, 'jmanharth@gmail.com');
});

test('failed login audits a login_failed event without leaking password', async () => {
  const res = await request(server, 'POST', '/api/admin/login', {
    body: { email: 'jmanharth@gmail.com', password: 'wrong' },
  });
  assert.equal(res.status, 401);

  const audit = await request(server, 'GET', '/api/admin/audit-log?action=login_failed', { token });
  assert.equal(audit.status, 200);
  assert.ok(audit.body.logs.length >= 1);
  assert.ok(!JSON.stringify(audit.body.logs[0]).includes('wrong'), 'password should never appear in audit log');
});

test('public contact form creates a lead and audits it', async () => {
  const res = await request(server, 'POST', '/api/contact', {
    body: {
      name: 'Integration Test Contact',
      phone: '405-555-1212',
      email: 'test@example.com',
      service: 'Termite',
      message: 'Need inspection',
    },
  });
  assert.equal(res.status, 200);
  assert.equal(res.body.success, true);

  const audit = await request(server, 'GET', '/api/admin/audit-log?recordType=leads&action=create', { token });
  const event = audit.body.logs.find(l => l.after && l.after.name === 'Integration Test Contact');
  assert.ok(event, 'expected create audit event for the new lead');
  assert.equal(event.performedBy, 'public_form');
  assert.equal(event.after.service, 'Termite');
});

test('admin can create a lead, update notes, change status, each event audited', async () => {
  const createRes = await request(server, 'POST', '/api/contact', {
    body: { name: 'Admin Test Lead', phone: '405-555-0000', service: 'Pest Control' },
  });
  assert.equal(createRes.status, 200);

  // Grab the lead id
  const leadsList = await request(server, 'GET', '/api/admin/leads', { token });
  const lead = leadsList.body.leads.find(l => l.name === 'Admin Test Lead');
  assert.ok(lead, 'expected to find created lead');

  // Update notes (plain field change → update action)
  const updateRes = await request(server, 'PATCH', `/api/admin/leads/${lead.id}`, {
    token,
    body: { notes: 'Called, left voicemail' },
  });
  assert.equal(updateRes.status, 200);

  // Change status (status_change action)
  const statusRes = await request(server, 'PATCH', `/api/admin/leads/${lead.id}`, {
    token,
    body: { status: 'contacted' },
  });
  assert.equal(statusRes.status, 200);

  // Search audit for this lead's id
  const audit = await request(server, 'GET', `/api/admin/audit-log?q=${lead.id}`, { token });
  assert.ok(audit.body.logs.length >= 3, 'expected at least create/update/status_change events');

  const actions = audit.body.logs.map(l => l.action);
  assert.ok(actions.includes('create'));
  assert.ok(actions.includes('update'));
  assert.ok(actions.includes('status_change'));

  const statusEvent = audit.body.logs.find(l => l.action === 'status_change');
  assert.ok(statusEvent.diff);
  assert.equal(statusEvent.diff.status.before, 'new');
  assert.equal(statusEvent.diff.status.after, 'contacted');
});

test('Converted status cannot be set directly — 409 loophole guard (Phase 1.7)', async () => {
  const createRes = await request(server, 'POST', '/api/contact', {
    body: { name: 'Loophole Test Lead', phone: '405-555-9999' },
  });
  assert.equal(createRes.status, 200);
  const leadsList = await request(server, 'GET', '/api/admin/leads', { token });
  const lead = leadsList.body.leads.find(l => l.name === 'Loophole Test Lead');

  const badStatus = await request(server, 'PATCH', `/api/admin/leads/${lead.id}`, {
    token,
    body: { status: 'converted' },
  });
  assert.equal(badStatus.status, 409);
  assert.ok(/Convert to Job/i.test(badStatus.body.error || ''));
});

test('Convert to Job stamps jobId and leadId on both sides (Phase 1.6)', async () => {
  const createRes = await request(server, 'POST', '/api/contact', {
    body: { name: 'Convert Test Lead', phone: '405-555-8888', service: 'General Pest Control' },
  });
  assert.equal(createRes.status, 200);
  const leadsList = await request(server, 'GET', '/api/admin/leads', { token });
  const lead = leadsList.body.leads.find(l => l.name === 'Convert Test Lead');

  const conv = await request(server, 'POST', `/api/admin/leads/${lead.id}/convert`, { token, body: {} });
  assert.equal(conv.status, 200);
  const job = conv.body.job;
  assert.ok(job.id);
  assert.equal(job.leadId, lead.id, 'job must reference the originating lead');

  // Now verify the lead has jobId stamped
  const leadsAfter = await request(server, 'GET', '/api/admin/leads', { token });
  const leadAfter = leadsAfter.body.leads.find(l => l.id === lead.id);
  assert.equal(leadAfter.jobId, job.id, 'lead must reference the created job');
  assert.equal(leadAfter.status, 'converted');

  // Double-convert is rejected
  const again = await request(server, 'POST', `/api/admin/leads/${lead.id}/convert`, { token, body: {} });
  assert.equal(again.status, 409);
});

test('audit-log endpoint supports action filter, recordType filter, and search', async () => {
  const loginFilter = await request(server, 'GET', '/api/admin/audit-log?action=login', { token });
  assert.ok(loginFilter.body.logs.every(l => l.action === 'login'));

  const leadsFilter = await request(server, 'GET', '/api/admin/audit-log?recordType=leads', { token });
  assert.ok(leadsFilter.body.logs.every(l => l.recordType === 'leads'));

  const searchFilter = await request(server, 'GET', '/api/admin/audit-log?q=Convert%20Test', { token });
  assert.ok(searchFilter.body.logs.length >= 1);
});

test('audit-log distinct endpoint returns populated dropdowns', async () => {
  const actionsRes = await request(server, 'GET', '/api/admin/audit-log/distinct?field=action', { token });
  assert.equal(actionsRes.status, 200);
  assert.ok(Array.isArray(actionsRes.body.values));
  assert.ok(actionsRes.body.values.includes('create'));
  assert.ok(actionsRes.body.values.includes('login'));

  const typesRes = await request(server, 'GET', '/api/admin/audit-log/distinct?field=recordType', { token });
  assert.ok(typesRes.body.values.includes('leads'));
  assert.ok(typesRes.body.values.includes('session'));

  const bad = await request(server, 'GET', '/api/admin/audit-log/distinct?field=nope', { token });
  assert.equal(bad.status, 400);
});

test('dashboard recentActivity is populated from the audit log', async () => {
  const res = await request(server, 'GET', '/api/admin/dashboard', { token });
  assert.equal(res.status, 200);
  assert.ok(Array.isArray(res.body.recentActivity));
  assert.ok(res.body.recentActivity.length > 0, 'dashboard should show recent audit events');
});

test('logout clears the session and audits the event', async () => {
  const logoutToken = await login();
  const logoutRes = await request(server, 'POST', '/api/admin/logout', { token: logoutToken });
  assert.equal(logoutRes.status, 200);

  // Old token should not work anymore
  const profileRes = await request(server, 'GET', '/api/admin/profile', { token: logoutToken });
  assert.equal(profileRes.status, 401);

  // Logout audit event exists (using the original test token which is still valid)
  const audit = await request(server, 'GET', '/api/admin/audit-log?action=logout', { token });
  assert.ok(audit.body.logs.length >= 1);
});
