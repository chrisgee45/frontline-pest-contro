// Services catalog — the list of offerings Jimmy can add to jobs and
// invoices as line items.
//
// Data model:
//
//   services {
//     id, name, description, defaultPrice, category, active,
//     stripeProductId, stripePriceId, stripeSyncedAt,
//     createdAt, updatedAt
//   }
//
// The `stripe*` fields are populated in Commit 4 when Jimmy adds his
// Stripe secret key. Until then they stay null; the catalog works
// purely locally. Once Stripe is wired up, creating a service will
// auto-provision a matching Product + Price in Stripe, and editing
// the price will create a new Stripe Price (they're immutable) and
// archive the old one so historical invoices keep resolving.

const { repo } = require('./repo');

const CATEGORIES = ['termite', 'pest', 'rodent', 'inspection', 'other'];

const servicesRepo = repo('services', {
  auditRecordType: 'service',
  describeCreate: (s) => `Created service: ${s.name} ($${Number(s.defaultPrice).toFixed(2)})`,
  describeUpdate: (s) => `Updated service: ${s.name}`,
  describeDelete: (s) => `Deleted service: ${s.name}`,
});

function listServices({ includeInactive = false } = {}) {
  const all = servicesRepo.all();
  const filtered = includeInactive ? all : all.filter((s) => s.active !== false);
  // Sort by category then name for stable, predictable dropdown ordering.
  return filtered.slice().sort((a, b) => {
    const ca = a.category || 'other';
    const cb = b.category || 'other';
    if (ca !== cb) return ca.localeCompare(cb);
    return (a.name || '').localeCompare(b.name || '');
  });
}

function getService(id) {
  return servicesRepo.find(id);
}

function createService(data, ctx = {}) {
  const name = String(data.name || '').trim();
  if (!name) throw new Error('Service name is required');

  const defaultPrice = Number(data.defaultPrice);
  if (!Number.isFinite(defaultPrice) || defaultPrice < 0) {
    throw new Error('defaultPrice must be a non-negative number');
  }

  const category = CATEGORIES.includes(data.category) ? data.category : 'other';

  return servicesRepo.create(
    {
      name,
      description: String(data.description || '').trim(),
      defaultPrice: Math.round(defaultPrice * 100) / 100,
      category,
      active: data.active !== false,
      // Stripe linkage — populated by Commit 4.
      stripeProductId: null,
      stripePriceId: null,
      stripeSyncedAt: null,
      updatedAt: new Date().toISOString(),
    },
    ctx
  );
}

function updateService(id, patch, ctx = {}) {
  const existing = servicesRepo.find(id);
  if (!existing) return null;

  const next = { ...patch, updatedAt: new Date().toISOString() };

  if (patch.name !== undefined) next.name = String(patch.name).trim();
  if (patch.description !== undefined) next.description = String(patch.description).trim();
  if (patch.defaultPrice !== undefined) {
    const p = Number(patch.defaultPrice);
    if (!Number.isFinite(p) || p < 0) throw new Error('defaultPrice must be a non-negative number');
    next.defaultPrice = Math.round(p * 100) / 100;
  }
  if (patch.category !== undefined) {
    next.category = CATEGORIES.includes(patch.category) ? patch.category : 'other';
  }
  if (patch.active !== undefined) next.active = !!patch.active;

  // Any edit to name/description/price should trigger a re-sync to Stripe
  // (Commit 4). We flag this by stamping stripeSyncedAt back to null so
  // the sync helper knows to refresh. Defer the actual Stripe call to the
  // route handler, which has access to the Stripe SDK when available.
  const priceChanged = patch.defaultPrice !== undefined && Number(patch.defaultPrice) !== existing.defaultPrice;
  const metaChanged = (patch.name !== undefined && patch.name !== existing.name)
    || (patch.description !== undefined && patch.description !== existing.description);
  if (priceChanged || metaChanged) {
    next.stripeSyncedAt = null;
  }

  return servicesRepo.update(id, next, ctx);
}

function deleteService(id, ctx = {}) {
  return servicesRepo.delete(id, ctx);
}

// Bulk-seed a starter catalog for a fresh tenant. Called from the setup
// flow / one-time migration when services.json is empty. Non-destructive —
// does nothing if services already exist.
function seedStarterCatalog(ctx = {}) {
  if (servicesRepo.all().length > 0) return { seeded: false, count: 0 };

  const starters = [
    { name: 'Termite Treatment — Full Perimeter', description: 'Liquid termiticide applied to the full perimeter of the structure. Includes 1-year retreatment warranty.', defaultPrice: 850.0, category: 'termite' },
    { name: 'Termite Inspection', description: 'Comprehensive subterranean termite inspection with written report (pre-purchase or renewal).', defaultPrice: 125.0, category: 'inspection' },
    { name: 'General Pest Control — Initial', description: 'First-time interior + exterior treatment for roaches, ants, spiders, and common household pests.', defaultPrice: 175.0, category: 'pest' },
    { name: 'Quarterly Pest Control', description: 'Recurring quarterly service. Interior + exterior preventive treatment.', defaultPrice: 95.0, category: 'pest' },
    { name: 'Rodent Control — Exclusion Package', description: 'Identify and seal rodent entry points, set up monitoring stations. Focus on prevention, not trapping.', defaultPrice: 385.0, category: 'rodent' },
    { name: 'Mosquito Treatment', description: 'Yard treatment targeting mosquito harborage areas. Results last 3–4 weeks.', defaultPrice: 125.0, category: 'pest' },
    { name: 'Wasp / Hornet Nest Removal', description: 'Removal and treatment of paper wasp, mud dauber, or hornet nests.', defaultPrice: 85.0, category: 'pest' },
    { name: 'Real Estate Inspection', description: 'WDI (Wood-Destroying Insect) inspection report for real estate transactions.', defaultPrice: 95.0, category: 'inspection' },
  ];

  let created = 0;
  for (const s of starters) {
    createService(s, ctx);
    created++;
  }
  return { seeded: true, count: created };
}

module.exports = {
  CATEGORIES,
  listServices,
  getService,
  createService,
  updateService,
  deleteService,
  seedStarterCatalog,
  _repo: servicesRepo, // exposed for tests / migrations
};
