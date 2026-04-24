// Tax-specific reports that sit on top of the ledger + vendor + expense
// data. Separated from accounting.js so the core ledger code stays
// focused on posting + balance enforcement.
//
// Currently implements:
//   - 1099-NEC YTD report: per-vendor total paid in a calendar year,
//     flagged if >= $600 (IRS reporting threshold), with a reportable
//     vs non-reportable breakdown (credit card / Stripe payments to a
//     vendor are generally NOT on 1099-NEC because the processor files
//     a 1099-K instead).

const { readJSON } = require('./data-dir');

// IRS 1099-NEC reporting threshold — payments to any one non-corporate
// contractor of $600+ in a calendar year trigger the filing requirement.
const THRESHOLD_1099 = 600;

// Payment methods that are generally reportable on 1099-NEC. Cash,
// checks, ACH, and plain bank transfers pass through without a third
// party reporting to the IRS. Card and "other" payment networks get
// reported by the processor on 1099-K and should be excluded here.
const REPORTABLE_METHODS = new Set(['cash', 'check', 'ach', 'transfer']);

function yearOf(iso) {
  if (!iso) return null;
  const d = new Date(iso);
  if (isNaN(d.getTime())) return null;
  return d.getUTCFullYear();
}

function dollars(n) {
  return Math.round((Number(n) || 0) * 100) / 100;
}

// Compute per-vendor totals paid in a given calendar year by walking
// both the expenses feed (direct-pay) and the bill_payments feed
// (pay-against-bill). Only non-voided rows count.
function build1099Report(year) {
  const targetYear = Number(year) || new Date().getUTCFullYear();
  const vendors = readJSON('vendors', []);
  const expenses = readJSON('expenses_ledger', []);
  const bills = readJSON('bills_ledger', []);
  const billPayments = readJSON('bill_payments', []);

  // Seed a totals bucket for every vendor — even 1099-flagged vendors
  // with $0 paid show up as "no 1099 needed yet" rather than vanishing.
  const byVendor = new Map();
  for (const v of vendors) {
    byVendor.set(v.id, {
      id: v.id,
      name: v.name || '(unnamed vendor)',
      taxId: v.taxId || '',
      email: v.email || '',
      phone: v.phone || '',
      address: v.address || '',
      is1099: !!v.is1099,
      totals: {
        reportable: 0,
        nonReportable: 0,
        total: 0,
      },
      byMethod: {},
      expenseCount: 0,
      billPaymentCount: 0,
    });
  }

  const add = (vendorId, amount, method) => {
    if (!byVendor.has(vendorId)) return;
    const row = byVendor.get(vendorId);
    const m = String(method || 'unknown').toLowerCase();
    row.byMethod[m] = dollars((row.byMethod[m] || 0) + amount);
    if (REPORTABLE_METHODS.has(m)) {
      row.totals.reportable = dollars(row.totals.reportable + amount);
    } else {
      row.totals.nonReportable = dollars(row.totals.nonReportable + amount);
    }
    row.totals.total = dollars(row.totals.total + amount);
  };

  // 1) Direct-pay expenses
  for (const e of expenses) {
    if (e.isVoid) continue;
    if (!e.vendorId) continue;
    if (yearOf(e.date) !== targetYear) continue;
    add(e.vendorId, Number(e.amount) || 0, e.paymentMethod);
    const row = byVendor.get(e.vendorId);
    if (row) row.expenseCount++;
  }

  // 2) Payments made against bills (AP) — the bill carries the vendorId,
  // the payment carries the cash movement.
  const billById = new Map(bills.map(b => [b.id, b]));
  for (const p of billPayments) {
    if (p.isVoid) continue;
    const bill = billById.get(p.billId);
    if (!bill || !bill.vendorId) continue;
    if (yearOf(p.paidAt) !== targetYear) continue;
    add(bill.vendorId, Number(p.amount) || 0, p.paymentMethod);
    const row = byVendor.get(bill.vendorId);
    if (row) row.billPaymentCount++;
  }

  // Produce a sorted list, vendor with highest total first.
  const rows = [...byVendor.values()]
    .filter(r => r.is1099 || r.totals.total > 0)  // hide non-1099 vendors who got nothing
    .sort((a, b) => b.totals.total - a.totals.total);

  // Flag who actually needs a 1099-NEC filed. Only reportable-method
  // payments count toward the threshold.
  for (const r of rows) {
    r.needs1099 = r.is1099 && r.totals.reportable >= THRESHOLD_1099;
    r.missingTaxId = r.needs1099 && !r.taxId;
    r.missingAddress = r.needs1099 && !r.address;
  }

  const summary = {
    year: targetYear,
    threshold: THRESHOLD_1099,
    totalVendors: rows.length,
    vendors1099: rows.filter(r => r.is1099).length,
    needing1099: rows.filter(r => r.needs1099).length,
    missingInfo: rows.filter(r => r.needs1099 && (r.missingTaxId || r.missingAddress)).length,
    totalReportable: dollars(rows.reduce((s, r) => s + r.totals.reportable, 0)),
    totalNonReportable: dollars(rows.reduce((s, r) => s + r.totals.nonReportable, 0)),
    totalPaid: dollars(rows.reduce((s, r) => s + r.totals.total, 0)),
  };

  return { summary, vendors: rows };
}

// Render the report as CSV in the order Jimmy's CPA will want it.
// Reportable-method total is the number that goes on Form 1099-NEC.
function render1099CSV(report) {
  const header = [
    'Vendor Name',
    'Tax ID (SSN/EIN)',
    'Address',
    'Email',
    'Phone',
    'Reportable Paid ($)',
    'Non-Reportable Paid ($)',
    'Total Paid ($)',
    'Needs 1099-NEC?',
    'Missing Info?',
    'Expenses Count',
    'Bill Payments Count',
  ];
  const esc = (v) => {
    const s = v == null ? '' : String(v);
    if (/["\n,]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
    return s;
  };
  const lines = [header.map(esc).join(',')];
  for (const r of report.vendors) {
    lines.push([
      r.name,
      r.taxId,
      r.address,
      r.email,
      r.phone,
      r.totals.reportable.toFixed(2),
      r.totals.nonReportable.toFixed(2),
      r.totals.total.toFixed(2),
      r.needs1099 ? 'YES' : 'no',
      r.needs1099 && (r.missingTaxId || r.missingAddress)
        ? `yes (${[r.missingTaxId ? 'taxId' : null, r.missingAddress ? 'address' : null].filter(Boolean).join(', ')})`
        : '',
      r.expenseCount,
      r.billPaymentCount,
    ].map(esc).join(','));
  }
  return lines.join('\n');
}

module.exports = {
  THRESHOLD_1099,
  REPORTABLE_METHODS,
  build1099Report,
  render1099CSV,
};
