// Backup / restore for the JSON-file data store.
//
// Backup format: a single gzipped JSON envelope containing every .json
// file in the data directory. Self-describing, inspectable with gunzip,
// and uses 100% Node stdlib (no new dependencies).
//
// Snapshots: stored in a `_backups/` subdirectory inside the data volume
// so they survive container replacements along with the rest of the
// data. Filenames prefixed with an underscore so the file iteration
// skips them (no recursion risk).
//
// Shape of a backup payload:
//   {
//     "version": 1,
//     "timestamp": "2026-04-17T12:34:56.000Z",
//     "appVersion": "1.0.0",
//     "files": {
//       "leads.json":    [...],
//       "jobs.json":     [...],
//       "customers.json": [...],
//       ...
//     }
//   }

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const { DATA_DIR } = require('./data-dir');

const BACKUPS_SUBDIR = '_backups';
const MAX_SNAPSHOTS = 30;
const BACKUP_VERSION = 1;

function backupsDir() {
  const dir = path.join(DATA_DIR, BACKUPS_SUBDIR);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return dir;
}

// Enumerate the data files to include in a backup. Skips anything under
// the backups subdirectory and anything starting with '_' (reserved for
// non-data files like migrations.json markers — actually that one IS data
// we want, so I'm only excluding _backups here).
function listDataFiles() {
  if (!fs.existsSync(DATA_DIR)) return [];
  return fs.readdirSync(DATA_DIR)
    .filter(f => f.endsWith('.json'))
    .filter(f => f !== BACKUPS_SUBDIR)
    .sort();
}

// Build the in-memory backup envelope.
function buildBackup() {
  const files = {};
  for (const name of listDataFiles()) {
    const full = path.join(DATA_DIR, name);
    try {
      const raw = fs.readFileSync(full, 'utf8');
      // Keep as parsed JSON when possible so the envelope is one cohesive
      // JSON object. Fall back to the raw string if the file somehow isn't
      // valid JSON (shouldn't happen, but we don't want a single corrupt
      // file to block a backup of the others).
      try { files[name] = JSON.parse(raw); }
      catch { files[name] = raw; }
    } catch (e) {
      console.error(`[backup] skipping ${name}: ${e.message}`);
    }
  }
  return {
    version: BACKUP_VERSION,
    timestamp: new Date().toISOString(),
    files,
  };
}

function serializeToGzip(backup) {
  return zlib.gzipSync(JSON.stringify(backup));
}

function deserializeFromGzip(buf) {
  const json = zlib.gunzipSync(buf).toString('utf8');
  const parsed = JSON.parse(json);
  if (!parsed || typeof parsed !== 'object' || parsed.version !== BACKUP_VERSION || !parsed.files) {
    throw new Error('Invalid backup file: missing version or files');
  }
  return parsed;
}

// Restore a backup envelope over the current data directory. Every file
// in the payload overwrites the corresponding file in DATA_DIR. Files
// that exist locally but aren't in the backup are left alone (so you can
// safely restore a partial backup without wiping everything).
//
// As a safety net, creates a pre-restore snapshot so the restore itself
// is reversible.
function restoreBackup(backup, { takeSnapshotFirst = true } = {}) {
  if (!backup || backup.version !== BACKUP_VERSION || !backup.files) {
    throw new Error('Invalid backup envelope');
  }

  let preRestoreSnapshot = null;
  if (takeSnapshotFirst) {
    try {
      preRestoreSnapshot = writeAutoSnapshot('pre-restore');
    } catch (e) {
      console.error('[backup] pre-restore snapshot failed:', e.message);
    }
  }

  const restored = [];
  for (const [name, content] of Object.entries(backup.files)) {
    // Reject any filename that tries to escape the data dir.
    if (name.includes('/') || name.includes('\\') || name.includes('..')) {
      console.warn(`[backup] skipping suspicious filename: ${name}`);
      continue;
    }
    const target = path.join(DATA_DIR, name);
    const body = typeof content === 'string' ? content : JSON.stringify(content, null, 2);
    fs.writeFileSync(target, body);
    restored.push(name);
  }

  return { restored, preRestoreSnapshot };
}

// Write an automatic snapshot to _backups/, pruning old ones. Called on
// a timer (daily) and on boot. Also called as part of restoreBackup.
function writeAutoSnapshot(label = 'auto') {
  const backup = buildBackup();
  const buf = serializeToGzip(backup);
  const dir = backupsDir();
  // ISO string through 'Z', minus the colons/dots so the filename is fs-safe.
  // e.g. 2026-04-17T14-30-45-123Z — unique down to the millisecond so snapshots
  // taken in quick succession (like a pre-restore + restore test) don't collide.
  const ts = new Date().toISOString().replace(/[:.]/g, '-').replace(/Z$/, 'Z');
  const safeLabel = String(label).replace(/[^a-z0-9-]/gi, '-');
  const fname = `backup-${safeLabel}-${ts}.json.gz`;
  const fullPath = path.join(dir, fname);
  fs.writeFileSync(fullPath, buf);

  pruneSnapshots();

  return { filename: fname, sizeBytes: buf.length, createdAt: new Date().toISOString() };
}

// Keep the most recent MAX_SNAPSHOTS files; delete the rest.
function pruneSnapshots() {
  const dir = backupsDir();
  const all = fs.readdirSync(dir)
    .filter(f => f.endsWith('.json.gz'))
    .map(f => ({ name: f, full: path.join(dir, f), mtime: fs.statSync(path.join(dir, f)).mtimeMs }))
    .sort((a, b) => b.mtime - a.mtime);

  for (const s of all.slice(MAX_SNAPSHOTS)) {
    try { fs.unlinkSync(s.full); }
    catch (e) { console.error(`[backup] prune failed for ${s.name}: ${e.message}`); }
  }
}

// List snapshots newest first, with size and timestamp for the UI.
function listSnapshots() {
  const dir = backupsDir();
  return fs.readdirSync(dir)
    .filter(f => f.endsWith('.json.gz'))
    .map(f => {
      const full = path.join(dir, f);
      const stat = fs.statSync(full);
      return {
        filename: f,
        sizeBytes: stat.size,
        createdAt: stat.mtime.toISOString(),
      };
    })
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

function readSnapshot(filename) {
  // Defensive: reject path-traversal attempts.
  if (!filename.endsWith('.json.gz') || filename.includes('/') || filename.includes('\\') || filename.includes('..')) {
    throw new Error('Invalid snapshot filename');
  }
  const full = path.join(backupsDir(), filename);
  if (!fs.existsSync(full)) throw new Error('Snapshot not found');
  return fs.readFileSync(full);
}

// Start the automatic daily snapshot timer. Returns a cancel function
// (used by tests to avoid leaking timers). Writes a boot snapshot after
// 30s so the first state of the day captures any migration effects.
function startAutoSnapshotScheduler({ intervalMs = 24 * 60 * 60 * 1000, bootDelayMs = 30 * 1000 } = {}) {
  const bootTimer = setTimeout(() => {
    try { writeAutoSnapshot('boot'); }
    catch (e) { console.error('[backup] boot snapshot failed:', e.message); }
  }, bootDelayMs);

  const interval = setInterval(() => {
    try { writeAutoSnapshot('daily'); }
    catch (e) { console.error('[backup] daily snapshot failed:', e.message); }
  }, intervalMs);

  return () => {
    clearTimeout(bootTimer);
    clearInterval(interval);
  };
}

module.exports = {
  BACKUP_VERSION,
  MAX_SNAPSHOTS,
  buildBackup,
  serializeToGzip,
  deserializeFromGzip,
  restoreBackup,
  writeAutoSnapshot,
  pruneSnapshots,
  listSnapshots,
  readSnapshot,
  startAutoSnapshotScheduler,
  listDataFiles,
};
