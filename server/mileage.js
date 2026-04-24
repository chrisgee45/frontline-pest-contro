// Business mileage log — for the IRS "standard mileage rate" deduction.
//
// Pest control is a truck-heavy business. The standard mileage rate
// deduction (~$0.70/mile in 2025) is typically the single largest
// deductible for a mobile service business. The IRS requires a
// contemporaneous log (date, miles, purpose, etc.) — "I'll estimate at
// year-end" doesn't fly on audit.
//
// Data model:
//
//   mileage {
//     id,
//     date,              // YYYY-MM-DD — day the driving happened
//     vehicle,           // free-text (e.g., "Service Truck", "Jimmy's F-150")
//     startLocation,     // free-text
//     endLocation,       // free-text
//     miles,             // number
//     purpose,           // business purpose of the trip (required per IRS)
//     category,          // 'customer_visit' | 'supply_pickup' | 'business_errand' | 'training' | 'other'
//     jobId, customerId, // optional back-references
//     notes,
//     createdAt,         // when Jimmy typed it in (proves contemporaneous)
//     updatedAt,
//   }
//
//   mileage_settings {
//     currentYearRate,   // IRS standard mileage rate for the current year (default 0.70)
//     previousYearRate,  // kept so historical entries keep their correct deduction
//     rateYear,          // which year currentYearRate applies to
//   }

const { repo } = require('./repo');
const { readJSON, writeJSON } = require('./data-dir');

// IRS standard mileage rates by year. Update as the IRS publishes new
// rates (usually December of the prior year). Each entry is the per-
// mile deduction rate for that calendar year.
const IRS_RATES = {
  2023: 0.655,
  2024: 0.67,
  2025: 0.70,
  2026: 0.70,  // Placeholder — update when IRS publishes the 2026 rate.
};

const CATEGORIES = ['customer_visit', 'supply_pickup', 'business_errand', 'training', 'other'];

const mileageRepo = repo('mileage', {
  auditRecordType: 'mileage',
  describeCreate: (m) => `Logged ${m.miles} mi on ${m.date}: ${m.purpose || m.endLocation || 'business trip'}`,
  describeUpdate: (m) => `Updated mileage log ${m.id.slice(0, 8)}`,
  describeDelete: (m) => `Deleted mileage entry (${m.miles} mi on ${m.date})`,
});

function getSettings() {
  return readJSON('mileage_settings', {
    currentYearRate: IRS_RATES[new Date().getUTCFullYear()] || 0.70,
    rateYear: new Date().getUTCFullYear(),
  });
}

function saveSettings(patch) {
  const current = getSettings();
  const next = {
    ...current,
    ...patch,
    currentYearRate: patch.currentYearRate !== undefined
      ? Math.max(0, Number(patch.currentYearRate)) || 0
      : current.currentYearRate,
    rateYear: patch.rateYear !== undefined
      ? Number(patch.rateYear) || current.rateYear
      : current.rateYear,
    updatedAt: new Date().toISOString(),
  };
  writeJSON('mileage_settings', next);
  return next;
}

function rateForYear(year) {
  return IRS_RATES[year] || getSettings().currentYearRate || 0.70;
}

function dollars(n) {
  return Math.round((Number(n) || 0) * 100) / 100;
}

function yearOf(iso) {
  if (!iso) return null;
  const d = new Date(iso);
  if (isNaN(d.getTime())) return null;
  return d.getUTCFullYear();
}

function listMileage({ year } = {}) {
  const all = mileageRepo.all();
  const filtered = year ? all.filter((m) => yearOf(m.date) === Number(year)) : all;
  return filtered.slice().sort((a, b) => (b.date || '').localeCompare(a.date || ''));
}

function createMileageEntry(data, ctx = {}) {
  const date = String(data.date || '').trim();
  if (!date) throw new Error('Date is required');
  const miles = Number(data.miles);
  if (!Number.isFinite(miles) || miles <= 0) {
    throw new Error('Miles must be a positive number');
  }
  const purpose = String(data.purpose || '').trim();
  if (!purpose) throw new Error('Business purpose is required (IRS documentation rule)');

  const category = CATEGORIES.includes(data.category) ? data.category : 'customer_visit';

  return mileageRepo.create(
    {
      date,
      vehicle: String(data.vehicle || '').trim(),
      startLocation: String(data.startLocation || '').trim(),
      endLocation: String(data.endLocation || '').trim(),
      miles: Math.round(miles * 10) / 10,   // round to 0.1 mi precision
      purpose,
      category,
      jobId: data.jobId || null,
      customerId: data.customerId || null,
      notes: String(data.notes || '').trim(),
      updatedAt: new Date().toISOString(),
    },
    ctx
  );
}

function updateMileageEntry(id, patch, ctx = {}) {
  const existing = mileageRepo.find(id);
  if (!existing) return null;

  const next = { ...patch, updatedAt: new Date().toISOString() };
  if (patch.miles !== undefined) {
    const m = Number(patch.miles);
    if (!Number.isFinite(m) || m <= 0) throw new Error('Miles must be a positive number');
    next.miles = Math.round(m * 10) / 10;
  }
  if (patch.category !== undefined) {
    next.category = CATEGORIES.includes(patch.category) ? patch.category : existing.category;
  }
  if (patch.purpose !== undefined) {
    const p = String(patch.purpose).trim();
    if (!p) throw new Error('Business purpose is required');
    next.purpose = p;
  }

  return mileageRepo.update(id, next, ctx);
}

function deleteMileageEntry(id, ctx = {}) {
  return mileageRepo.delete(id, ctx);
}

// Aggregate totals for a year — used by the UI's summary tiles and the
// Tax Center's Schedule C line 9 pre-fill.
function getMileageSummary(year) {
  const target = Number(year) || new Date().getUTCFullYear();
  const entries = mileageRepo.all().filter((m) => yearOf(m.date) === target);
  const rate = rateForYear(target);
  const totalMiles = entries.reduce((s, m) => s + (Number(m.miles) || 0), 0);
  const deductibleAmount = dollars(totalMiles * rate);

  // Group by month and category.
  const byMonth = {};
  const byCategory = {};
  for (const m of entries) {
    const month = (m.date || '').slice(0, 7); // YYYY-MM
    byMonth[month] = dollars((byMonth[month] || 0) + (Number(m.miles) || 0));
    byCategory[m.category || 'other'] = dollars((byCategory[m.category || 'other'] || 0) + (Number(m.miles) || 0));
  }

  return {
    year: target,
    rate,
    totalMiles: Math.round(totalMiles * 10) / 10,
    deductibleAmount,
    entryCount: entries.length,
    byMonth,
    byCategory,
  };
}

function renderMileageCSV(year) {
  const entries = listMileage({ year });
  const rate = rateForYear(year);
  const header = [
    'Date',
    'Vehicle',
    'Start Location',
    'End Location',
    'Miles',
    'Business Purpose',
    'Category',
    'Deduction ($)',
    'Notes',
    'Logged At',
  ];
  const esc = (v) => {
    const s = v == null ? '' : String(v);
    if (/["\n,]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
    return s;
  };
  const lines = [header.map(esc).join(',')];
  for (const e of entries) {
    lines.push([
      e.date,
      e.vehicle,
      e.startLocation,
      e.endLocation,
      e.miles,
      e.purpose,
      e.category,
      (Number(e.miles) * rate).toFixed(2),
      e.notes,
      e.createdAt,
    ].map(esc).join(','));
  }
  return lines.join('\n');
}

module.exports = {
  CATEGORIES,
  IRS_RATES,
  getSettings,
  saveSettings,
  rateForYear,
  listMileage,
  createMileageEntry,
  updateMileageEntry,
  deleteMileageEntry,
  getMileageSummary,
  renderMileageCSV,
  _repo: mileageRepo,
};
