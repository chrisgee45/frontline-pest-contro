// Unit tests for server/migrations.js.
// Exercises the Phase 1.7 orphan cleanup + Phase 1.8 test-job deletion.

const test = require('node:test');
const assert = require('node:assert/strict');
const { useTempDataDir } = require('./helpers');

const tmp = useTempDataDir();
const { repo } = require('../repo');
const { queryAudit } = require('../audit-helpers');
const { runMigrations } = require('../migrations');

test.after(() => tmp.cleanup());

test('migration deletes test Chris Gee job in Completed without leadId', () => {
  const jobs = repo('jobs');

  // Seed: the exact Chris Gee test artifact
  const testJob = jobs.create({
    customerName: 'Chris Gee',
    status: 'completed',
    serviceType: 'General Pest Control',
    phone: '',
    address: '',
    email: '',
    leadId: null,
  });

  // Seed: a legitimate Chris Gee job that SHOULD NOT be deleted (has leadId)
  const realJob = jobs.create({
    customerName: 'Chris Gee',
    status: 'completed',
    serviceType: 'Termite Treatment',
    phone: '405-555-1111',
    leadId: 'some-real-lead-id',
  });

  // Seed: another Chris Gee job that's NOT in Completed column — untouched
  const newJob = jobs.create({
    customerName: 'Chris Gee',
    status: 'new',
    serviceType: 'Inspection',
    leadId: null,
  });

  runMigrations();

  assert.equal(jobs.find(testJob.id), null, 'the test Chris Gee completed job should be deleted');
  assert.ok(jobs.find(realJob.id), 'the real Chris Gee job with a leadId should NOT be touched');
  assert.ok(jobs.find(newJob.id), 'the New-column Chris Gee job should NOT be touched');
});

test('migration links orphaned converted lead to its matching job when one exists', () => {
  const leads = repo('leads');
  const jobs = repo('jobs');

  const job = jobs.create({
    customerName: 'Acme Co',
    phone: '405-555-2222',
    email: 'acme@example.com',
    serviceType: 'General Pest Control',
    status: 'scheduled',
    leadId: null,
  });

  const orphan = leads.create({
    name: 'Acme Co',
    phone: '(405) 555-2222', // same phone, different format
    email: 'acme@example.com',
    status: 'converted',
    jobId: null,
  });

  // Reset the migrations marker so this test's migration actually runs.
  // (tests share the same temp data dir, but migrations only run once
  //  per process — we need a fresh start per logical case.)
  // Strategy: inline-run the migration logic by clearing the marker.
  const { readJSON, writeJSON } = require('../data-dir');
  writeJSON('migrations', { applied: [] });

  runMigrations();

  const linkedLead = leads.find(orphan.id);
  const linkedJob = jobs.find(job.id);

  assert.equal(linkedLead.status, 'converted', 'lead should stay converted since we linked it');
  assert.equal(linkedLead.jobId, job.id, 'lead.jobId should now point at the matching job');
  assert.equal(linkedJob.leadId, orphan.id, 'job.leadId should now point at the originating lead');
});

test('migration reverts orphaned converted lead to contacted when no matching job exists', () => {
  const leads = repo('leads');
  const { writeJSON } = require('../data-dir');

  const lonelyOrphan = leads.create({
    name: 'No Job For Me',
    phone: '405-555-9999',
    email: 'nojob@example.com',
    status: 'converted',
    jobId: null,
  });

  writeJSON('migrations', { applied: [] });
  runMigrations();

  const after = leads.find(lonelyOrphan.id);
  assert.equal(after.status, 'contacted', 'orphan with no matching job should revert to contacted');
  assert.equal(after.jobId, null);
});

test('migration is idempotent — second run is a no-op', () => {
  // Record the current audit count for 'migration' actor events
  const before = queryAudit({ actor: 'migration' }).total;

  // Second run, marker file already has the id
  runMigrations();

  const after = queryAudit({ actor: 'migration' }).total;
  // No new migration events should have been recorded
  assert.equal(after, before, 'second run should not add any new migration audit events');
});

test('migration audits its own work via action=migration', () => {
  // Re-run once more against a fresh marker to verify the audit trail gets
  // a 'migration' event from runMigrations itself
  const { writeJSON } = require('../data-dir');
  writeJSON('migrations', { applied: [] });

  runMigrations();

  const events = queryAudit({ action: 'migration' });
  assert.ok(events.logs.length >= 1, 'at least one migration audit event should exist');
  const phase1Event = events.logs.find(l => l.recordId === 'phase-1-orphan-chris-gee-cleanup');
  assert.ok(phase1Event, 'phase-1 migration should be recorded');
  assert.equal(phase1Event.recordType, 'system');
  assert.equal(phase1Event.performedBy, 'migration');
});
