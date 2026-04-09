const crypto = require('crypto');
const { readJSON, writeJSON } = require('./data-dir');

// Compute a minimal shallow diff: { field: { before, after } } for fields
// that differ between two objects. Ignores updatedAt since it always changes.
function diff(before = {}, after = {}) {
  const out = {};
  const keys = new Set([...Object.keys(before || {}), ...Object.keys(after || {})]);
  keys.delete('updatedAt');
  for (const k of keys) {
    const b = before ? before[k] : undefined;
    const a = after ? after[k] : undefined;
    if (JSON.stringify(b) !== JSON.stringify(a)) {
      out[k] = { before: b === undefined ? null : b, after: a === undefined ? null : a };
    }
  }
  return out;
}

// Record a rich audit event into audit_log.json.
// Compatible with the existing schema used by accounting.js
// (action, recordType, recordId, amount, description, performedBy, performedAt)
// and adds new optional fields: diff, before, after, context.
function recordAudit({
  action,
  recordType,
  recordId,
  actor,
  description,
  amount,
  before,
  after,
  diff: explicitDiff,
  context,
}) {
  if (!action) throw new Error('audit: action required');
  if (!recordType) throw new Error('audit: recordType required');

  const logs = readJSON('audit_log', []);
  const event = {
    id: crypto.randomUUID(),
    action,
    recordType,
    recordId: recordId || null,
    amount: amount != null ? Number(amount).toFixed(2) : null,
    description: description || '',
    performedBy: actor || 'admin',
    performedAt: new Date().toISOString(),
    diff: explicitDiff || (before && after ? diff(before, after) : null),
    before: before || null,
    after: after || null,
    context: context || null,
  };
  logs.unshift(event);
  if (logs.length > 2000) logs.length = 2000;
  writeJSON('audit_log', logs);
  return event;
}

// Query audit log with filters and pagination.
// Filters: startDate, endDate, action, recordType, actor, q (full-text search).
function queryAudit(filters = {}) {
  let logs = readJSON('audit_log', []);
  if (filters.startDate) logs = logs.filter(l => l.performedAt >= filters.startDate);
  if (filters.endDate) logs = logs.filter(l => l.performedAt <= filters.endDate + 'T23:59:59');
  if (filters.action) logs = logs.filter(l => l.action === filters.action);
  if (filters.recordType) logs = logs.filter(l => l.recordType === filters.recordType);
  if (filters.actor) logs = logs.filter(l => l.performedBy === filters.actor);
  if (filters.q) {
    const q = String(filters.q).toLowerCase();
    logs = logs.filter(l => {
      if ((l.description || '').toLowerCase().includes(q)) return true;
      if ((l.recordType || '').toLowerCase().includes(q)) return true;
      if ((l.performedBy || '').toLowerCase().includes(q)) return true;
      if ((l.recordId || '').toLowerCase().includes(q)) return true;
      // Full-text into the record snapshot so searching for a customer name
      // or invoice number returns the audit events that reference them.
      if (l.after && JSON.stringify(l.after).toLowerCase().includes(q)) return true;
      if (l.before && JSON.stringify(l.before).toLowerCase().includes(q)) return true;
      return false;
    });
  }
  const total = logs.length;
  const limit = filters.limit || 100;
  const offset = filters.offset || 0;
  return { logs: logs.slice(offset, offset + limit), total };
}

// List distinct values for a field across the audit log,
// for populating filter dropdowns dynamically.
function listDistinct(field) {
  const logs = readJSON('audit_log', []);
  return [...new Set(logs.map(l => l[field]).filter(Boolean))].sort();
}

module.exports = { recordAudit, queryAudit, listDistinct, diff };
