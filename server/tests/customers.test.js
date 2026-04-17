// Integration tests for the customer management module.

const test = require('node:test');
const assert = require('node:assert/strict');
const { useTempDataDir, request } = require('./helpers');

const tmp = useTempDataDir();
const app = require('../index');
const customers = require('../customers');

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

// --- Matching helpers ---

test('normalizePhone strips formatting and returns digits only', () => {
  assert.equal(customers.normalizePhone('(405) 555-1212'), '4055551212');
  assert.equal(customers.normalizePhone('405.555.1212'), '4055551212');
  assert.equal(customers.normalizePhone('+1 405 555 1212'), '14055551212');
  assert.equal(customers.normalizePhone(null), '');
  assert.equal(customers.normalizePhone(undefined), '');
});

test('normalizeEmail lowercases and trims', () => {
  assert.equal(customers.normalizeEmail('  Sarah@Example.COM '), 'sarah@example.com');
  assert.equal(customers.normalizeEmail(null), '');
});

// --- Auto-matching on new lead ---

test('first lead with a new phone creates a fresh customer', async () => {
  const res = await request(server, 'POST', '/api/contact', {
    body: {
      name: 'Sarah Jones',
      phone: '405-555-1001',
      email: 'sarah@example.com',
      address: '123 Elm St, Edmond, OK',
      service: 'Termite Treatment',
    },
  });
  assert.equal(res.status, 200);
  // Inspect the lead to confirm customerId was stamped and auto-link flag is null
  const leads = (await request(server, 'GET', '/api/admin/leads', { token })).body.leads;
  const lead = leads.find(l => l.name === 'Sarah Jones');
  assert.ok(lead);
  assert.ok(lead.customerId);
  assert.equal(lead.autoLinkedCustomerId, null, 'first contact should not be flagged as auto-link match');
});

test('second lead with same phone auto-links to existing customer and flags it', async () => {
  // A different person at the same household calling in
  const res = await request(server, 'POST', '/api/contact', {
    body: {
      name: 'John Jones',
      phone: '405-555-1001', // same phone as Sarah
      email: 'john@example.com',
      service: 'General Pest Control',
    },
  });
  assert.equal(res.status, 200);

  const leads = (await request(server, 'GET', '/api/admin/leads', { token })).body.leads;
  const lead = leads.find(l => l.name === 'John Jones');
  assert.ok(lead);
  assert.ok(lead.customerId);
  assert.ok(lead.autoLinkedCustomerId, 'auto-linked lead should be flagged');
  assert.equal(lead.autoLinkedCustomerId, lead.customerId);
  assert.equal(lead.matchedBy, 'phone');

  // Both leads should point at the same customer
  const sarah = leads.find(l => l.name === 'Sarah Jones');
  assert.equal(sarah.customerId, lead.customerId,
    'both leads should be linked to the same household');
});

test('lead with matching email but different phone also auto-links', async () => {
  // First lead with a distinctive email
  await request(server, 'POST', '/api/contact', {
    body: {
      name: 'Robert Miller',
      phone: '405-555-2001',
      email: 'bob.miller@example.com',
    },
  });

  // Second lead with same email but different phone
  await request(server, 'POST', '/api/contact', {
    body: {
      name: 'Bob Miller',
      phone: '918-555-9999', // different number
      email: 'BOB.MILLER@example.com', // same email, different case
    },
  });

  const leads = (await request(server, 'GET', '/api/admin/leads', { token })).body.leads;
  const first = leads.find(l => l.name === 'Robert Miller');
  const second = leads.find(l => l.name === 'Bob Miller');
  assert.equal(first.customerId, second.customerId);
  assert.equal(second.matchedBy, 'email');
});

test('phone formatting differences still match (normalized comparison)', async () => {
  await request(server, 'POST', '/api/contact', {
    body: { name: 'Format Test A', phone: '(405) 555-3001' },
  });
  await request(server, 'POST', '/api/contact', {
    body: { name: 'Format Test B', phone: '405.555.3001' },
  });

  const leads = (await request(server, 'GET', '/api/admin/leads', { token })).body.leads;
  const a = leads.find(l => l.name === 'Format Test A');
  const b = leads.find(l => l.name === 'Format Test B');
  assert.equal(a.customerId, b.customerId, 'formatting differences in phone should not prevent matching');
});

// --- Convert-to-Job propagation ---

test('Convert to Job carries customerId from the lead onto the job', async () => {
  await request(server, 'POST', '/api/contact', {
    body: { name: 'Convert Tester', phone: '405-555-4001', email: 'convert@example.com' },
  });
  const lead = (await request(server, 'GET', '/api/admin/leads', { token })).body.leads
    .find(l => l.name === 'Convert Tester');
  assert.ok(lead.customerId);

  const conv = await request(server, 'POST', `/api/admin/leads/${lead.id}/convert`, {
    token,
    body: {},
  });
  assert.equal(conv.status, 200);
  assert.equal(conv.body.job.customerId, lead.customerId);
  assert.equal(conv.body.job.leadId, lead.id);
});

// --- Auto-drafted invoice carries customerId ---

test('Job -> Completed auto-draft invoice inherits customerId from the job', async () => {
  await request(server, 'POST', '/api/contact', {
    body: { name: 'Invoice Chain Tester', phone: '405-555-5001', email: 'chain@example.com' },
  });
  const lead = (await request(server, 'GET', '/api/admin/leads', { token })).body.leads
    .find(l => l.name === 'Invoice Chain Tester');

  const conv = await request(server, 'POST', `/api/admin/leads/${lead.id}/convert`, { token, body: {} });
  const job = conv.body.job;

  const complete = await request(server, 'PATCH', `/api/admin/jobs/${job.id}`, {
    token,
    body: { status: 'completed' },
  });
  const inv = complete.body.autoInvoice;
  assert.ok(inv);
  assert.equal(inv.customerId, lead.customerId,
    'auto-drafted invoice should carry customerId all the way from the lead');
});

// --- Customer detail endpoint ---

test('GET /api/admin/customers/:id returns full history with running totals', async () => {
  // Use the customer from the Sarah + John Jones household
  const listRes = await request(server, 'GET', '/api/admin/customers', { token });
  const household = listRes.body.customers.find(c =>
    c.primaryPhone === '4055551001'
  );
  assert.ok(household, 'expected to find the Jones household');

  const detail = await request(server, 'GET', `/api/admin/customers/${household.id}`, { token });
  assert.equal(detail.status, 200);
  const c = detail.body.customer;
  assert.ok(Array.isArray(c.contacts));
  assert.ok(Array.isArray(c.locations));
  assert.ok(Array.isArray(c.leads));
  assert.ok(Array.isArray(c.jobs));
  assert.ok(Array.isArray(c.invoices));
  assert.ok(Array.isArray(c.payments));
  assert.ok(c.stats);
  assert.ok(typeof c.stats.totalBilled === 'number');
  assert.ok(typeof c.stats.totalPaid === 'number');
  assert.ok(typeof c.stats.balance === 'number');

  // Both Sarah and John's leads should appear on the household
  assert.ok(c.leads.some(l => l.name === 'Sarah Jones'));
  assert.ok(c.leads.some(l => l.name === 'John Jones'));
});

// --- Customer CRUD ---

test('POST /api/admin/customers creates a manually-specified customer', async () => {
  const res = await request(server, 'POST', '/api/admin/customers', {
    token,
    body: {
      displayName: 'Acme Pest Solutions LLC',
      billingAddress: '100 Commerce Way, OKC',
      notes: 'Commercial account, prefers invoices via email',
      tags: ['commercial'],
      primaryContact: {
        name: 'Jane Accountant',
        email: 'accounting@acme.example.com',
        phone: '4055559999',
        role: 'Accounts Payable',
      },
      defaultLocation: {
        label: 'Main Office',
        address: '100 Commerce Way, OKC',
      },
    },
  });
  assert.equal(res.status, 200);
  const id = res.body.customer.id;
  assert.ok(id);

  const detail = (await request(server, 'GET', `/api/admin/customers/${id}`, { token })).body.customer;
  assert.equal(detail.displayName, 'Acme Pest Solutions LLC');
  assert.equal(detail.contacts.length, 1);
  assert.equal(detail.contacts[0].isPrimary, true);
  assert.equal(detail.contacts[0].email, 'accounting@acme.example.com');
  assert.equal(detail.locations.length, 1);
  assert.equal(detail.locations[0].isDefault, true);
});

test('PATCH /api/admin/customers/:id updates allowed fields', async () => {
  const created = (await request(server, 'POST', '/api/admin/customers', {
    token,
    body: { displayName: 'Patch Test', primaryContact: { name: 'Patch Test', phone: '4055556001' } },
  })).body.customer;

  const res = await request(server, 'PATCH', `/api/admin/customers/${created.id}`, {
    token,
    body: { notes: 'Likes appointments in the morning', tags: ['vip', 'residential'] },
  });
  assert.equal(res.status, 200);
  assert.equal(res.body.customer.notes, 'Likes appointments in the morning');
  assert.deepEqual(res.body.customer.tags, ['vip', 'residential']);
});

test('contacts: add, update, delete, enforce single primary', async () => {
  const created = (await request(server, 'POST', '/api/admin/customers', {
    token,
    body: { displayName: 'Contacts Test', primaryContact: { name: 'First Primary', phone: '4055557001' } },
  })).body.customer;

  // Add a second contact as primary — should flip the original primary off
  const newContact = (await request(server, 'POST', `/api/admin/customers/${created.id}/contacts`, {
    token,
    body: { name: 'Second Primary', phone: '4055557002', isPrimary: true },
  })).body.contact;

  const after = (await request(server, 'GET', `/api/admin/customers/${created.id}`, { token })).body.customer;
  const primaries = after.contacts.filter(c => c.isPrimary);
  assert.equal(primaries.length, 1, 'only one primary contact allowed at a time');
  assert.equal(primaries[0].id, newContact.id);

  // Update: change the name
  await request(server, 'PATCH', `/api/admin/customers/${created.id}/contacts/${newContact.id}`, {
    token,
    body: { name: 'Second Primary Renamed' },
  });
  const afterUpdate = (await request(server, 'GET', `/api/admin/customers/${created.id}`, { token })).body.customer;
  assert.ok(afterUpdate.contacts.some(c => c.name === 'Second Primary Renamed'));

  // Delete
  const del = await request(server, 'DELETE', `/api/admin/customers/${created.id}/contacts/${newContact.id}`, { token });
  assert.equal(del.status, 200);
  const afterDelete = (await request(server, 'GET', `/api/admin/customers/${created.id}`, { token })).body.customer;
  assert.ok(!afterDelete.contacts.some(c => c.id === newContact.id));
});

test('locations: add, update default invariant, delete', async () => {
  const created = (await request(server, 'POST', '/api/admin/customers', {
    token,
    body: {
      displayName: 'Locations Test',
      primaryContact: { name: 'Loc Test', phone: '4055558001' },
      defaultLocation: { label: 'Home', address: '1 Default St' },
    },
  })).body.customer;

  // Add a second location as default — should flip the first to isDefault:false
  const second = (await request(server, 'POST', `/api/admin/customers/${created.id}/locations`, {
    token,
    body: { label: 'Rental', address: '2 Other St', isDefault: true },
  })).body.location;

  const after = (await request(server, 'GET', `/api/admin/customers/${created.id}`, { token })).body.customer;
  const defaults = after.locations.filter(l => l.isDefault);
  assert.equal(defaults.length, 1);
  assert.equal(defaults[0].id, second.id);
});

test('GET /api/admin/customers with ?q searches name/email/phone/address', async () => {
  const byName = (await request(server, 'GET', '/api/admin/customers?q=Acme', { token })).body.customers;
  assert.ok(byName.some(c => c.displayName === 'Acme Pest Solutions LLC'));

  const byPhone = (await request(server, 'GET', '/api/admin/customers?q=4055559999', { token })).body.customers;
  assert.ok(byPhone.some(c => c.displayName === 'Acme Pest Solutions LLC'));

  const byEmail = (await request(server, 'GET', '/api/admin/customers?q=accounting@acme', { token })).body.customers;
  assert.ok(byEmail.some(c => c.displayName === 'Acme Pest Solutions LLC'));
});
