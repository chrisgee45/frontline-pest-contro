const crypto = require('crypto');
const { readJSON, writeJSON } = require('./data-dir');
const { recordAudit, diff } = require('./audit-helpers');

// Centralized repository wrapper for JSON-file collections.
//
// Every mutation goes through here so it's automatically audited — no need
// to sprinkle audit calls throughout route handlers. When you add a new
// model, just use repo('newmodel') and it gets audited for free.
//
// Usage:
//   const leads = repo('leads');
//   const created = leads.create({ name: 'Foo' }, { actor: 'jimmy' });
//   const updated = leads.update(id, { status: 'contacted' }, { actor: 'jimmy' });
//   leads.delete(id, { actor: 'jimmy' });

function repo(collection, options = {}) {
  const { auditRecordType = collection, describeCreate, describeUpdate, describeDelete } = options;

  return {
    all() {
      return readJSON(collection, []);
    },

    find(id) {
      return readJSON(collection, []).find(x => x.id === id) || null;
    },

    findWhere(predicate) {
      return readJSON(collection, []).filter(predicate);
    },

    create(data, ctx = {}) {
      const items = readJSON(collection, []);
      const item = {
        id: data.id || crypto.randomUUID(),
        ...data,
        createdAt: data.createdAt || new Date().toISOString(),
      };
      items.unshift(item);
      writeJSON(collection, items);

      recordAudit({
        action: 'create',
        recordType: auditRecordType,
        recordId: item.id,
        actor: ctx.actor || 'admin',
        description: ctx.description || (describeCreate ? describeCreate(item) : `Created ${auditRecordType}`),
        after: item,
        context: ctx.context || null,
      });

      return item;
    },

    update(id, patch, ctx = {}) {
      const items = readJSON(collection, []);
      const idx = items.findIndex(x => x.id === id);
      if (idx < 0) return null;

      const before = { ...items[idx] };
      const next = { ...items[idx], ...patch, updatedAt: new Date().toISOString() };
      items[idx] = next;
      writeJSON(collection, items);

      const changeDiff = diff(before, next);
      if (Object.keys(changeDiff).length === 0) {
        // Nothing actually changed (only updatedAt bumped). Skip audit noise.
        return next;
      }

      // If status changed, classify as status_change so the filter dropdown
      // separates it from ordinary field edits.
      const action = changeDiff.status ? 'status_change' : 'update';
      const defaultDesc = action === 'status_change'
        ? `Status: ${changeDiff.status.before} → ${changeDiff.status.after}`
        : `Updated ${auditRecordType}`;

      recordAudit({
        action,
        recordType: auditRecordType,
        recordId: id,
        actor: ctx.actor || 'admin',
        description: ctx.description || (describeUpdate ? describeUpdate(before, next, changeDiff) : defaultDesc),
        before,
        after: next,
        diff: changeDiff,
        context: ctx.context || null,
      });

      return next;
    },

    delete(id, ctx = {}) {
      const items = readJSON(collection, []);
      const idx = items.findIndex(x => x.id === id);
      if (idx < 0) return false;

      const before = { ...items[idx] };
      items.splice(idx, 1);
      writeJSON(collection, items);

      recordAudit({
        action: 'delete',
        recordType: auditRecordType,
        recordId: id,
        actor: ctx.actor || 'admin',
        description: ctx.description || (describeDelete ? describeDelete(before) : `Deleted ${auditRecordType}`),
        before,
        context: ctx.context || null,
      });

      return true;
    },

    // Upsert without auditing — for internal migrations/cleanup that shouldn't
    // appear in the user-facing audit log. Use sparingly.
    _unsafeWrite(items) {
      writeJSON(collection, items);
    },
  };
}

module.exports = { repo };
