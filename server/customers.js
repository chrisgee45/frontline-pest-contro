// Customer management — household accounts with multiple contacts and
// multiple service locations.
//
// Data model:
//
//   customers {
//     id, displayName, billingAddress, notes, tags[], createdAt, updatedAt
//   }
//
//   customer_contacts {
//     id, customerId, name, email, phone, role, isPrimary, createdAt
//   }
//     - Matching normalises phone to digits-only and email to lowercase,
//       then scans every contact on every customer. A new lead/job/invoice
//       with phone OR email matching any contact auto-links to that
//       customer (and flags the record so the UI can show a banner).
//
//   customer_locations {
//     id, customerId, label, address, notes, isDefault, createdAt
//   }
//     - Jobs can optionally reference locationId. If null, the default
//       location is assumed. Billing address lives on the customer itself.
//
// Existing records (leads, jobs, invoices) get `customerId` back-references
// stamped either at creation time or via the one-time backfill migration
// in server/migrations.js.

const { repo } = require('./repo');
const { recordAudit } = require('./audit-helpers');

const customersRepo = repo('customers');
const contactsRepo = repo('customer_contacts');
const locationsRepo = repo('customer_locations');

// Normalize a phone to digits-only (so "(405) 555-1212" matches
// "405-555-1212"). Returns empty string for null/undefined.
function normalizePhone(p) {
  return String(p || '').replace(/\D/g, '');
}

function normalizeEmail(e) {
  return String(e || '').trim().toLowerCase();
}

// Build an index of all contacts keyed by phone AND email. Used by
// findCustomerByContact to do O(1) lookups instead of scanning every
// contact for every match attempt.
function buildContactIndex() {
  const byPhone = new Map();
  const byEmail = new Map();
  for (const c of contactsRepo.all()) {
    const p = normalizePhone(c.phone);
    const e = normalizeEmail(c.email);
    if (p) byPhone.set(p, c);
    if (e) byEmail.set(e, c);
  }
  return { byPhone, byEmail };
}

// Try to find an existing customer whose ANY contact has this phone or
// email. Returns { customer, contact, matchedBy: 'phone'|'email' } or null.
function findCustomerByContact({ phone, email }) {
  const p = normalizePhone(phone);
  const e = normalizeEmail(email);
  if (!p && !e) return null;

  const { byPhone, byEmail } = buildContactIndex();
  let contact = null;
  let matchedBy = null;

  if (e && byEmail.has(e)) {
    contact = byEmail.get(e);
    matchedBy = 'email';
  } else if (p && byPhone.has(p)) {
    contact = byPhone.get(p);
    matchedBy = 'phone';
  }
  if (!contact) return null;

  const customer = customersRepo.find(contact.customerId);
  if (!customer) return null; // orphaned contact — should never happen
  return { customer, contact, matchedBy };
}

// Create a new customer household with an initial primary contact and
// optional default service location. Everything goes through the repo
// layer so creation is audited.
function createCustomer({ displayName, billingAddress, notes, tags, primaryContact, defaultLocation }, ctx = {}) {
  const actor = ctx.actor || 'admin';

  const customer = customersRepo.create(
    {
      displayName: displayName || primaryContact?.name || 'Customer',
      billingAddress: billingAddress || defaultLocation?.address || primaryContact?.address || '',
      notes: notes || '',
      tags: Array.isArray(tags) ? tags : [],
      updatedAt: new Date().toISOString(),
    },
    { actor, description: `Created customer: ${displayName || primaryContact?.name || 'Customer'}` }
  );

  if (primaryContact) {
    contactsRepo.create(
      {
        customerId: customer.id,
        name: primaryContact.name || '',
        email: normalizeEmail(primaryContact.email),
        phone: normalizePhone(primaryContact.phone),
        role: primaryContact.role || 'Primary',
        isPrimary: true,
      },
      { actor, description: `Added primary contact ${primaryContact.name || ''} to ${customer.displayName}` }
    );
  }

  if (defaultLocation && defaultLocation.address) {
    locationsRepo.create(
      {
        customerId: customer.id,
        label: defaultLocation.label || 'Primary',
        address: defaultLocation.address,
        notes: defaultLocation.notes || '',
        isDefault: true,
      },
      { actor, description: `Added default service location to ${customer.displayName}` }
    );
  }

  return customer;
}

// The main entry point used by lead/job/invoice creation: given a set of
// contact details, either match to an existing customer or create a new
// one. Returns { customer, contact, locationId, matched: boolean,
// matchedBy: 'phone'|'email'|null }.
function findOrCreateCustomer({ name, email, phone, address }, ctx = {}) {
  const match = findCustomerByContact({ phone, email });
  if (match) {
    // Existing customer. Don't mutate it — just return the match so the
    // caller can stamp customerId/contactId on whatever they're creating.
    const location = locationsRepo.findWhere(l => l.customerId === match.customer.id && l.isDefault)[0] || null;
    return {
      customer: match.customer,
      contact: match.contact,
      locationId: location?.id || null,
      matched: true,
      matchedBy: match.matchedBy,
    };
  }

  // No match — spin up a new customer household with this person as the
  // primary contact and their address as the default service location.
  const customer = createCustomer(
    {
      displayName: name || 'New Customer',
      billingAddress: address || '',
      primaryContact: { name, email, phone, role: 'Primary' },
      defaultLocation: address ? { label: 'Primary', address } : null,
    },
    ctx
  );
  const contact = contactsRepo.findWhere(c => c.customerId === customer.id && c.isPrimary)[0] || null;
  const location = locationsRepo.findWhere(l => l.customerId === customer.id && l.isDefault)[0] || null;

  return {
    customer,
    contact,
    locationId: location?.id || null,
    matched: false,
    matchedBy: null,
  };
}

// Enrich a customer record with its contacts, locations, linked history,
// and running totals. Used by the detail endpoint.
function getCustomerDetail(customerId) {
  const customer = customersRepo.find(customerId);
  if (!customer) return null;

  const contacts = contactsRepo.findWhere(c => c.customerId === customerId)
    .sort((a, b) => (b.isPrimary ? 1 : 0) - (a.isPrimary ? 1 : 0));
  const locations = locationsRepo.findWhere(l => l.customerId === customerId)
    .sort((a, b) => (b.isDefault ? 1 : 0) - (a.isDefault ? 1 : 0));

  const leads = repo('leads').findWhere(l => l.customerId === customerId)
    .sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
  const jobs = repo('jobs').findWhere(j => j.customerId === customerId)
    .sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
  const invoices = repo('invoices').findWhere(i => i.customerId === customerId);

  // Roll payments + running totals across all invoices for this customer.
  const payments = repo('payments').all().filter(p => invoices.some(i => i.id === p.invoiceId));
  const totalBilled = invoices.reduce((s, i) => s + Number(i.total || 0), 0);
  const totalPaid = payments.reduce((s, p) => s + Number(p.amount || 0), 0);
  const balance = Math.round((totalBilled - totalPaid) * 100) / 100;

  const lastCompletedJob = jobs
    .filter(j => j.status === 'completed')
    .sort((a, b) => (b.updatedAt || b.createdAt || '').localeCompare(a.updatedAt || a.createdAt || ''))[0] || null;
  const nextScheduledJob = jobs
    .filter(j => ['new', 'scheduled', 'in_progress'].includes(j.status) && j.scheduledDate)
    .sort((a, b) => (a.scheduledDate || '').localeCompare(b.scheduledDate || ''))[0] || null;

  return {
    ...customer,
    contacts,
    locations,
    leads,
    jobs,
    invoices: invoices.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || '')),
    payments: payments.sort((a, b) => (b.paymentDate || '').localeCompare(a.paymentDate || '')),
    stats: {
      totalBilled: Math.round(totalBilled * 100) / 100,
      totalPaid: Math.round(totalPaid * 100) / 100,
      balance,
      leadCount: leads.length,
      jobCount: jobs.length,
      invoiceCount: invoices.length,
      lastServiceDate: lastCompletedJob?.updatedAt || lastCompletedJob?.createdAt || null,
      nextServiceDate: nextScheduledJob?.scheduledDate || null,
    },
  };
}

// List customers with optional search. Each customer gets a small
// stats object computed inline so the list can sort by e.g. balance
// or last service without a second round-trip.
function listCustomers({ q, sortBy = 'updatedAt' } = {}) {
  const query = (q || '').trim().toLowerCase();
  const all = customersRepo.all();

  // Precompute small stats per customer — keep this cheap.
  const contacts = contactsRepo.all();
  const jobs = repo('jobs').all();
  const invoices = repo('invoices').all();
  const payments = repo('payments').all();

  const contactsByCustomer = new Map();
  for (const c of contacts) {
    if (!contactsByCustomer.has(c.customerId)) contactsByCustomer.set(c.customerId, []);
    contactsByCustomer.get(c.customerId).push(c);
  }

  const enriched = all.map(cust => {
    const custContacts = contactsByCustomer.get(cust.id) || [];
    const primary = custContacts.find(c => c.isPrimary) || custContacts[0] || null;
    const custInvoices = invoices.filter(i => i.customerId === cust.id);
    const custPayments = payments.filter(p => custInvoices.some(i => i.id === p.invoiceId));
    const custJobs = jobs.filter(j => j.customerId === cust.id);
    const totalBilled = custInvoices.reduce((s, i) => s + Number(i.total || 0), 0);
    const totalPaid = custPayments.reduce((s, p) => s + Number(p.amount || 0), 0);
    const lastJob = custJobs
      .filter(j => j.status === 'completed')
      .sort((a, b) => (b.updatedAt || b.createdAt || '').localeCompare(a.updatedAt || a.createdAt || ''))[0];
    return {
      ...cust,
      primaryContactName: primary?.name || '',
      primaryEmail: primary?.email || '',
      primaryPhone: primary?.phone || '',
      totalBilled: Math.round(totalBilled * 100) / 100,
      totalPaid: Math.round(totalPaid * 100) / 100,
      balance: Math.round((totalBilled - totalPaid) * 100) / 100,
      jobCount: custJobs.length,
      lastServiceDate: lastJob?.updatedAt || lastJob?.createdAt || null,
    };
  });

  let filtered = enriched;
  if (query) {
    filtered = enriched.filter(c => {
      return (
        (c.displayName || '').toLowerCase().includes(query) ||
        (c.primaryContactName || '').toLowerCase().includes(query) ||
        (c.primaryEmail || '').toLowerCase().includes(query) ||
        (c.primaryPhone || '').includes(query) ||
        (c.billingAddress || '').toLowerCase().includes(query)
      );
    });
  }

  const sorters = {
    displayName: (a, b) => (a.displayName || '').localeCompare(b.displayName || ''),
    updatedAt: (a, b) => (b.updatedAt || b.createdAt || '').localeCompare(a.updatedAt || a.createdAt || ''),
    balance: (a, b) => (b.balance || 0) - (a.balance || 0),
    totalBilled: (a, b) => (b.totalBilled || 0) - (a.totalBilled || 0),
    lastServiceDate: (a, b) => (b.lastServiceDate || '').localeCompare(a.lastServiceDate || ''),
  };
  filtered.sort(sorters[sortBy] || sorters.updatedAt);

  return filtered;
}

// Update core customer fields (and bump updatedAt).
function updateCustomer(id, patch, ctx = {}) {
  const actor = ctx.actor || 'admin';
  const allowed = ['displayName', 'billingAddress', 'notes', 'tags'];
  const safePatch = {};
  for (const k of allowed) {
    if (patch[k] !== undefined) safePatch[k] = patch[k];
  }
  safePatch.updatedAt = new Date().toISOString();
  return customersRepo.update(id, safePatch, { actor, description: `Updated customer ${id.slice(0, 8)}` });
}

// Add a contact to a customer. Normalizes email/phone.
function addContact(customerId, { name, email, phone, role, isPrimary }, ctx = {}) {
  const actor = ctx.actor || 'admin';

  // If setting this one primary, clear any existing primary flag so there's
  // always exactly one.
  if (isPrimary) {
    const existing = contactsRepo.findWhere(c => c.customerId === customerId && c.isPrimary);
    for (const c of existing) {
      contactsRepo.update(c.id, { isPrimary: false }, { actor });
    }
  }

  return contactsRepo.create(
    {
      customerId,
      name: name || '',
      email: normalizeEmail(email),
      phone: normalizePhone(phone),
      role: role || '',
      isPrimary: !!isPrimary,
    },
    { actor, description: `Added contact ${name || ''} to customer ${customerId.slice(0, 8)}` }
  );
}

function updateContact(contactId, patch, ctx = {}) {
  const actor = ctx.actor || 'admin';
  const existing = contactsRepo.find(contactId);
  if (!existing) return null;
  const safePatch = {};
  if (patch.name !== undefined) safePatch.name = patch.name;
  if (patch.email !== undefined) safePatch.email = normalizeEmail(patch.email);
  if (patch.phone !== undefined) safePatch.phone = normalizePhone(patch.phone);
  if (patch.role !== undefined) safePatch.role = patch.role;
  if (patch.isPrimary !== undefined) {
    if (patch.isPrimary) {
      // Clear other primaries on the same customer
      const others = contactsRepo.findWhere(c => c.customerId === existing.customerId && c.id !== contactId && c.isPrimary);
      for (const o of others) {
        contactsRepo.update(o.id, { isPrimary: false }, { actor });
      }
    }
    safePatch.isPrimary = !!patch.isPrimary;
  }
  return contactsRepo.update(contactId, safePatch, { actor });
}

function deleteContact(contactId, ctx = {}) {
  const actor = ctx.actor || 'admin';
  return contactsRepo.delete(contactId, { actor });
}

// Service locations follow the same single-default invariant pattern.
function addLocation(customerId, { label, address, notes, isDefault }, ctx = {}) {
  const actor = ctx.actor || 'admin';
  if (isDefault) {
    const existing = locationsRepo.findWhere(l => l.customerId === customerId && l.isDefault);
    for (const l of existing) {
      locationsRepo.update(l.id, { isDefault: false }, { actor });
    }
  }
  return locationsRepo.create(
    {
      customerId,
      label: label || 'Location',
      address: address || '',
      notes: notes || '',
      isDefault: !!isDefault,
    },
    { actor, description: `Added service location to customer ${customerId.slice(0, 8)}` }
  );
}

function updateLocation(locationId, patch, ctx = {}) {
  const actor = ctx.actor || 'admin';
  const existing = locationsRepo.find(locationId);
  if (!existing) return null;
  const safePatch = {};
  if (patch.label !== undefined) safePatch.label = patch.label;
  if (patch.address !== undefined) safePatch.address = patch.address;
  if (patch.notes !== undefined) safePatch.notes = patch.notes;
  if (patch.isDefault !== undefined) {
    if (patch.isDefault) {
      const others = locationsRepo.findWhere(l => l.customerId === existing.customerId && l.id !== locationId && l.isDefault);
      for (const o of others) {
        locationsRepo.update(o.id, { isDefault: false }, { actor });
      }
    }
    safePatch.isDefault = !!patch.isDefault;
  }
  return locationsRepo.update(locationId, safePatch, { actor });
}

function deleteLocation(locationId, ctx = {}) {
  const actor = ctx.actor || 'admin';
  return locationsRepo.delete(locationId, { actor });
}

module.exports = {
  // Matching / creation
  findOrCreateCustomer,
  findCustomerByContact,
  createCustomer,
  // Queries
  getCustomerDetail,
  listCustomers,
  // Mutations
  updateCustomer,
  addContact,
  updateContact,
  deleteContact,
  addLocation,
  updateLocation,
  deleteLocation,
  // Utils (exported for tests + migration use)
  normalizePhone,
  normalizeEmail,
};
