// Period close / prior-year lock.
//
// Once a fiscal year's taxes have been filed, those journal entries
// should be frozen — no accidental void, no new backdated entry.
// Reopening a closed period is possible but takes an explicit action
// (with a reason stored in the audit log).
//
// Data model (stored in `closed_periods.json`):
//
//   [
//     {
//       id,
//       year,           // e.g. 2024
//       closeDate,      // ISO end-of-period boundary — e.g. 2024-12-31
//       closedAt,       // when the close was performed
//       closedBy,       // actor
//       reason,         // e.g. "Year-end close — 2024 Schedule C filed"
//       reopenedAt,     // null if still closed; ISO if reopened
//       reopenedBy,
//       reopenReason,
//     }
//   ]
//
// Lookup rule: a date D is "in a closed period" if there exists any
// entry where reopenedAt is null AND D <= entry.closeDate.

const crypto = require('crypto');
const { readJSON, writeJSON } = require('./data-dir');
const { recordAudit } = require('./audit-helpers');

function all() {
  return readJSON('closed_periods', []);
}

// Is a given ISO date inside a currently-closed period? Used by the
// journal-entry post/void guards to reject changes to closed periods.
function isClosedDate(isoDate) {
  if (!isoDate) return false;
  const periods = all().filter((p) => !p.reopenedAt);
  const d = new Date(isoDate);
  if (isNaN(d.getTime())) return false;
  const stamp = d.toISOString().slice(0, 10);
  return periods.some((p) => {
    if (!p.closeDate) return false;
    return stamp <= p.closeDate;
  });
}

// Close a period — everything on or before `closeDate` becomes
// read-only to postJournalEntry / voidJournalEntry. Typical usage is
// "close 2024" with closeDate "2024-12-31" after the return is filed.
function closePeriod({ closeDate, reason }, ctx = {}) {
  if (!closeDate) throw new Error('closeDate is required (YYYY-MM-DD)');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(closeDate)) {
    throw new Error('closeDate must be in YYYY-MM-DD format');
  }
  const cleanReason = String(reason || '').trim();
  if (!cleanReason) throw new Error('A reason is required for audit-trail clarity');

  const year = Number(closeDate.slice(0, 4));

  const periods = all();
  // If an active close already covers this date, don't create a second.
  const alreadyClosed = periods.find((p) => !p.reopenedAt && p.closeDate >= closeDate);
  if (alreadyClosed) {
    throw new Error(`A close already exists through ${alreadyClosed.closeDate}. Reopen first if you need to replace it.`);
  }

  const entry = {
    id: crypto.randomUUID(),
    year,
    closeDate,
    closedAt: new Date().toISOString(),
    closedBy: ctx.actor || 'admin',
    reason: cleanReason,
    reopenedAt: null,
    reopenedBy: null,
    reopenReason: null,
  };

  periods.unshift(entry);
  writeJSON('closed_periods', periods);

  recordAudit({
    action: 'close',
    recordType: 'period',
    recordId: entry.id,
    actor: ctx.actor || 'admin',
    description: `Closed period through ${closeDate}: ${cleanReason}`,
    after: entry,
  });

  return entry;
}

// Reopen a closed period. Leaves the original close record in place
// (reopenedAt / reopenedBy / reopenReason get stamped in) so the
// audit trail shows both the close and the reopen.
function reopenPeriod(periodId, { reason }, ctx = {}) {
  const cleanReason = String(reason || '').trim();
  if (!cleanReason) throw new Error('A reason is required to reopen a closed period');

  const periods = all();
  const idx = periods.findIndex((p) => p.id === periodId);
  if (idx < 0) return null;
  if (periods[idx].reopenedAt) {
    throw new Error('This period is already reopened');
  }

  const before = { ...periods[idx] };
  periods[idx] = {
    ...periods[idx],
    reopenedAt: new Date().toISOString(),
    reopenedBy: ctx.actor || 'admin',
    reopenReason: cleanReason,
  };
  writeJSON('closed_periods', periods);

  recordAudit({
    action: 'reopen',
    recordType: 'period',
    recordId: periodId,
    actor: ctx.actor || 'admin',
    description: `Reopened period through ${periods[idx].closeDate}: ${cleanReason}`,
    before,
    after: periods[idx],
  });

  return periods[idx];
}

module.exports = {
  all,
  isClosedDate,
  closePeriod,
  reopenPeriod,
};
