// Tests for the backup / restore module and its HTTP endpoints.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { useTempDataDir, request } = require('./helpers');

const tmp = useTempDataDir();
const app = require('../index');
const backup = require('../backup');
const { DATA_DIR } = require('../data-dir');
const { repo } = require('../repo');

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

// --- Unit: envelope shape and roundtrip ---

test('buildBackup returns a version-1 envelope with files keyed by filename', () => {
  // Seed something so there are files to capture.
  repo('leads').create({ name: 'Backup Unit Test Lead', phone: '555-0001', status: 'new' });
  const env = backup.buildBackup();
  assert.equal(env.version, 1);
  assert.ok(env.timestamp);
  assert.ok(env.files && typeof env.files === 'object');
  assert.ok(env.files['leads.json'], 'leads.json must appear in the envelope');
  assert.ok(Array.isArray(env.files['leads.json']));
  assert.ok(env.files['leads.json'].some(l => l.name === 'Backup Unit Test Lead'));
});

test('gzip serialize + deserialize is lossless', () => {
  const env = backup.buildBackup();
  const buf = backup.serializeToGzip(env);
  assert.ok(Buffer.isBuffer(buf));
  assert.ok(buf.length > 0);
  const round = backup.deserializeFromGzip(buf);
  assert.deepEqual(round, env);
});

test('deserializeFromGzip rejects an invalid envelope', () => {
  const bogus = require('zlib').gzipSync(JSON.stringify({ hello: 'world' }));
  assert.throws(() => backup.deserializeFromGzip(bogus), /Invalid backup/);
});

test('restoreBackup overwrites matching files but leaves unrelated ones alone', () => {
  // Seed state
  repo('leads').create({ name: 'Pre-restore lead', status: 'new' });
  repo('jobs').create({ customerName: 'Pre-restore job', status: 'new', serviceType: 'x' });

  // Capture an envelope
  const snap = backup.buildBackup();

  // Mutate current state after snapshot — we'll "restore" to pre-mutate
  repo('leads').create({ name: 'Post-snapshot lead', status: 'new' });

  assert.equal(repo('leads').all().some(l => l.name === 'Post-snapshot lead'), true);

  // Restore: leads.json overwritten back to pre-mutate state. We also have
  // jobs.json in the envelope which should be written but should not grow
  // or shrink (unchanged content).
  const result = backup.restoreBackup(snap);
  assert.ok(result.restored.includes('leads.json'));
  assert.equal(repo('leads').all().some(l => l.name === 'Post-snapshot lead'), false);
  assert.equal(repo('leads').all().some(l => l.name === 'Pre-restore lead'), true);
  assert.equal(repo('jobs').all().some(j => j.customerName === 'Pre-restore job'), true);
});

test('restoreBackup creates a pre-restore safety snapshot by default', () => {
  const before = backup.listSnapshots().length;
  const env = backup.buildBackup();
  backup.restoreBackup(env);
  const after = backup.listSnapshots();
  assert.ok(after.length > before, 'a new snapshot should appear');
  assert.ok(after[0].filename.includes('pre-restore'), 'the newest snapshot is labeled pre-restore');
});

test('restoreBackup rejects filenames that try to escape the data directory', () => {
  const evil = {
    version: 1,
    timestamp: new Date().toISOString(),
    files: {
      '../etc/passwd': 'malicious',
      'subdir/nope.json': [],
      'normal.json': { ok: true },
    },
  };
  const result = backup.restoreBackup(evil, { takeSnapshotFirst: false });
  assert.equal(result.restored.length, 1);
  assert.equal(result.restored[0], 'normal.json');
  // Confirm no file escaped the sandbox
  assert.equal(fs.existsSync(path.join(DATA_DIR, '..', 'etc', 'passwd')), false);
});

test('writeAutoSnapshot produces a gzipped file in _backups/', () => {
  const info = backup.writeAutoSnapshot('unit');
  assert.ok(info.filename.endsWith('.json.gz'));
  assert.ok(info.filename.includes('unit'));
  const full = path.join(DATA_DIR, '_backups', info.filename);
  assert.ok(fs.existsSync(full));
  // Confirm it can be round-tripped back
  const parsed = backup.deserializeFromGzip(fs.readFileSync(full));
  assert.equal(parsed.version, 1);
});

test('pruneSnapshots keeps at most MAX_SNAPSHOTS files', async () => {
  // Write MAX_SNAPSHOTS + 5 snapshots; oldest five should get pruned.
  for (let i = 0; i < backup.MAX_SNAPSHOTS + 5; i++) {
    backup.writeAutoSnapshot(`flood-${i}`);
    // Space them out slightly so mtime ordering works on fast filesystems.
    await new Promise(r => setTimeout(r, 5));
  }
  const remaining = backup.listSnapshots();
  assert.ok(remaining.length <= backup.MAX_SNAPSHOTS,
    `after prune, expected <= ${backup.MAX_SNAPSHOTS}, got ${remaining.length}`);
});

test('listSnapshots returns newest first', () => {
  const snaps = backup.listSnapshots();
  for (let i = 1; i < snaps.length; i++) {
    assert.ok(snaps[i - 1].createdAt >= snaps[i].createdAt, 'ordered newest first');
  }
});

// --- Integration: HTTP endpoints ---

test('GET /api/admin/backup/download requires auth', async () => {
  const res = await request(server, 'GET', '/api/admin/backup/download');
  assert.equal(res.status, 401);
});

test('GET /api/admin/backup/download streams a valid gzipped envelope', async () => {
  const url = `http://127.0.0.1:${server.address().port}/api/admin/backup/download`;
  const http = require('http');
  const body = await new Promise((resolve, reject) => {
    const req = http.request(url, { method: 'GET', headers: { Authorization: `Bearer ${token}` } }, (res) => {
      assert.equal(res.statusCode, 200);
      assert.equal(res.headers['content-type'], 'application/gzip');
      assert.ok(/attachment; filename="frontline-backup-/.test(res.headers['content-disposition']));
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => resolve(Buffer.concat(chunks)));
    });
    req.on('error', reject);
    req.end();
  });
  const env = backup.deserializeFromGzip(body);
  assert.equal(env.version, 1);
  assert.ok(env.files['leads.json']);
});

test('POST /api/admin/backup/restore accepts a gzipped body and restores', async () => {
  // Capture current state
  const env = backup.buildBackup();
  const buf = backup.serializeToGzip(env);

  // Mutate: add a lead we don't want in the restored data
  repo('leads').create({ name: 'Should be wiped', status: 'new' });
  assert.equal(repo('leads').all().some(l => l.name === 'Should be wiped'), true);

  // POST the captured envelope back
  const http = require('http');
  const result = await new Promise((resolve, reject) => {
    const req = http.request(
      `http://127.0.0.1:${server.address().port}/api/admin/backup/restore`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/gzip',
          'Content-Length': buf.length,
          Authorization: `Bearer ${token}`,
        },
      },
      (res) => {
        const chunks = [];
        res.on('data', c => chunks.push(c));
        res.on('end', () => resolve({ status: res.statusCode, body: JSON.parse(Buffer.concat(chunks).toString('utf8')) }));
      }
    );
    req.on('error', reject);
    req.write(buf);
    req.end();
  });
  assert.equal(result.status, 200);
  assert.equal(result.body.success, true);
  assert.ok(result.body.restored.includes('leads.json'));
  assert.equal(repo('leads').all().some(l => l.name === 'Should be wiped'), false);
});

test('POST /api/admin/backup/snapshot creates a named manual snapshot', async () => {
  const res = await request(server, 'POST', '/api/admin/backup/snapshot', {
    token,
    body: { label: 'integration-test' },
  });
  assert.equal(res.status, 200);
  assert.ok(res.body.snapshot?.filename.includes('integration-test'));

  const listRes = await request(server, 'GET', '/api/admin/backup/snapshots', { token });
  assert.ok(listRes.body.snapshots.some(s => s.filename === res.body.snapshot.filename));
});

test('GET /api/admin/backup/snapshots/:filename rejects path-traversal', async () => {
  const bad = await request(server, 'GET', '/api/admin/backup/snapshots/..%2Fetc%2Fpasswd', { token });
  assert.equal(bad.status, 404);
});

test('download + restore emit audit events attributed to the logged-in user', async () => {
  await request(server, 'GET', '/api/admin/backup/download', { token });
  const env = backup.buildBackup();
  const buf = backup.serializeToGzip(env);

  const http = require('http');
  await new Promise((resolve, reject) => {
    const req = http.request(
      `http://127.0.0.1:${server.address().port}/api/admin/backup/restore`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/gzip',
          'Content-Length': buf.length,
          Authorization: `Bearer ${token}`,
        },
      },
      (res) => { res.on('data', () => {}); res.on('end', resolve) }
    );
    req.on('error', reject);
    req.write(buf);
    req.end();
  });

  const downloadEvents = await request(server, 'GET', '/api/admin/audit-log?action=download&recordType=backup', { token });
  assert.ok(downloadEvents.body.logs.length >= 1);
  assert.equal(downloadEvents.body.logs[0].performedBy, 'jmanharth@gmail.com');

  const restoreEvents = await request(server, 'GET', '/api/admin/audit-log?action=restore&recordType=backup', { token });
  assert.ok(restoreEvents.body.logs.length >= 1);
  assert.equal(restoreEvents.body.logs[0].performedBy, 'jmanharth@gmail.com');
});
