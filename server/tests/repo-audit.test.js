// Unit tests for the repo layer and audit-helpers.
// These validate that mutations via repo() flow through to audit_log.json
// with correct action classification and diffs.

const test = require('node:test');
const assert = require('node:assert/strict');
const { useTempDataDir } = require('./helpers');

// Redirect data dir to a temp folder BEFORE requiring the modules under test.
const tmp = useTempDataDir();
const { repo } = require('../repo');
const { recordAudit, queryAudit, diff, listDistinct } = require('../audit-helpers');

test.after(() => tmp.cleanup());

test('diff: ignores updatedAt and captures only changed fields', () => {
  const before = { name: 'A', status: 'new', updatedAt: '2026-01-01' };
  const after = { name: 'A', status: 'contacted', updatedAt: '2026-01-02' };
  const d = diff(before, after);
  assert.deepEqual(Object.keys(d), ['status']);
  assert.equal(d.status.before, 'new');
  assert.equal(d.status.after, 'contacted');
});

test('diff: captures added and removed fields', () => {
  const before = { a: 1 };
  const after = { a: 1, b: 2 };
  const d = diff(before, after);
  assert.deepEqual(d, { b: { before: null, after: 2 } });
});

test('recordAudit: requires action and recordType', () => {
  assert.throws(() => recordAudit({}), /action required/);
  assert.throws(() => recordAudit({ action: 'create' }), /recordType required/);
});

test('recordAudit: writes event with correct shape', () => {
  const event = recordAudit({
    action: 'create',
    recordType: 'test_model',
    recordId: 'test-1',
    actor: 'tester',
    description: 'Hello',
    after: { foo: 'bar' },
  });
  assert.ok(event.id);
  assert.equal(event.action, 'create');
  assert.equal(event.recordType, 'test_model');
  assert.equal(event.recordId, 'test-1');
  assert.equal(event.performedBy, 'tester');
  assert.equal(event.description, 'Hello');
  assert.deepEqual(event.after, { foo: 'bar' });
  assert.ok(event.performedAt);
});

test('repo.create: writes item and audits it', () => {
  const leads = repo('leads');
  const item = leads.create({ name: 'Test Lead', status: 'new' }, { actor: 'jimmy' });
  assert.ok(item.id);
  assert.equal(item.name, 'Test Lead');
  assert.ok(item.createdAt);

  const all = leads.all();
  assert.ok(all.some(l => l.id === item.id));

  const audit = queryAudit({ recordType: 'leads', action: 'create' });
  const event = audit.logs.find(l => l.recordId === item.id);
  assert.ok(event, 'expected create audit event for lead');
  assert.equal(event.performedBy, 'jimmy');
  assert.equal(event.after.name, 'Test Lead');
});

test('repo.update: plain field change logs update action with diff', () => {
  const leads = repo('leads');
  const item = leads.create({ name: 'Update Test', status: 'new', notes: '' });
  const updated = leads.update(item.id, { notes: 'Called' });
  assert.equal(updated.notes, 'Called');

  const audit = queryAudit({ action: 'update', recordType: 'leads' });
  const event = audit.logs.find(l => l.recordId === item.id);
  assert.ok(event, 'expected update audit event');
  assert.ok(event.diff, 'expected diff on update event');
  assert.equal(event.diff.notes.before, '');
  assert.equal(event.diff.notes.after, 'Called');
});

test('repo.update: status change is classified as status_change action', () => {
  const leads = repo('leads');
  const item = leads.create({ name: 'Status Test', status: 'new' });
  leads.update(item.id, { status: 'contacted' });

  const audit = queryAudit({ action: 'status_change' });
  const event = audit.logs.find(l => l.recordId === item.id);
  assert.ok(event, 'expected status_change audit event');
  assert.equal(event.diff.status.before, 'new');
  assert.equal(event.diff.status.after, 'contacted');
});

test('repo.update: no-op update does not create audit event', () => {
  const leads = repo('leads');
  const item = leads.create({ name: 'Noop', status: 'new' });
  const beforeCount = queryAudit({ recordType: 'leads' }).total;
  leads.update(item.id, { name: 'Noop' }); // same value
  const afterCount = queryAudit({ recordType: 'leads' }).total;
  assert.equal(afterCount, beforeCount, 'no-op update should not audit');
});

test('repo.delete: records before snapshot', () => {
  const jobs = repo('jobs');
  const item = jobs.create({ customerName: 'Delete Me', status: 'new' });
  const ok = jobs.delete(item.id);
  assert.equal(ok, true);
  assert.equal(jobs.find(item.id), null);

  const audit = queryAudit({ action: 'delete', recordType: 'jobs' });
  const event = audit.logs.find(l => l.recordId === item.id);
  assert.ok(event);
  assert.equal(event.before.customerName, 'Delete Me');
});

test('queryAudit: filters by recordType, action, and search text', () => {
  const leads = repo('leads');
  const jobs = repo('jobs');
  leads.create({ name: 'Alpha Lead', status: 'new' });
  jobs.create({ customerName: 'Bravo Customer', status: 'new' });

  const leadOnly = queryAudit({ recordType: 'leads' });
  assert.ok(leadOnly.logs.length > 0);
  assert.ok(leadOnly.logs.every(l => l.recordType === 'leads'));

  const searchAlpha = queryAudit({ q: 'alpha' });
  assert.ok(searchAlpha.logs.length >= 1);
  assert.ok(searchAlpha.logs.some(l => (l.description || '').toLowerCase().includes('alpha') || (l.after && JSON.stringify(l.after).toLowerCase().includes('alpha'))));
});

test('listDistinct: returns unique values for a field', () => {
  // At this point we've generated many audit events across multiple recordTypes
  const actions = listDistinct('action');
  assert.ok(actions.includes('create'));
  assert.ok(actions.includes('update') || actions.includes('status_change'));

  const types = listDistinct('recordType');
  assert.ok(types.includes('leads'));
  assert.ok(types.includes('jobs'));
});
