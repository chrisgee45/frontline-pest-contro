// Technicians — the list of people who can be assigned to jobs.
// Jimmy, Jarrett, any future helpers or 1099 contractors.
//
// Data model:
//
//   technicians {
//     id,
//     name,             // display name used throughout the UI
//     phone,
//     email,
//     role,             // 'owner' | 'technician' | 'contractor' | 'helper'
//     active,           // inactive techs don't appear in the job picker
//     hireDate,         // optional, for record-keeping
//     hourlyRate,       // optional, for future payroll features
//     notes,            // free-text
//     createdAt, updatedAt
//   }
//
// Jobs still store `assignedTech` as a plain string name — the
// dropdown just writes the selected technician's name into that field.
// That way old jobs with hand-typed tech names stay legible, and the
// technicians module can be deleted without breaking job history.

const { repo } = require('./repo');

const ROLES = ['owner', 'technician', 'contractor', 'helper'];

const techniciansRepo = repo('technicians', {
  auditRecordType: 'technician',
  describeCreate: (t) => `Added technician: ${t.name}${t.role ? ` (${t.role})` : ''}`,
  describeUpdate: (t) => `Updated technician: ${t.name}`,
  describeDelete: (t) => `Removed technician: ${t.name}`,
});

function listTechnicians({ includeInactive = false } = {}) {
  const all = techniciansRepo.all();
  const filtered = includeInactive ? all : all.filter((t) => t.active !== false);
  return filtered.slice().sort((a, b) => {
    // Owner first, then active techs, then inactive; alphabetical within groups.
    const rank = (t) => (t.role === 'owner' ? 0 : t.active === false ? 2 : 1);
    const ra = rank(a); const rb = rank(b);
    if (ra !== rb) return ra - rb;
    return (a.name || '').localeCompare(b.name || '');
  });
}

function getTechnician(id) {
  return techniciansRepo.find(id);
}

function createTechnician(data, ctx = {}) {
  const name = String(data.name || '').trim();
  if (!name) throw new Error('Technician name is required');

  const role = ROLES.includes(data.role) ? data.role : 'technician';
  const hourlyRate = data.hourlyRate != null && data.hourlyRate !== ''
    ? Math.max(0, Number(data.hourlyRate)) || 0
    : null;

  return techniciansRepo.create(
    {
      name,
      phone: String(data.phone || '').trim(),
      email: String(data.email || '').trim(),
      role,
      active: data.active !== false,
      hireDate: data.hireDate || '',
      hourlyRate,
      notes: String(data.notes || '').trim(),
      updatedAt: new Date().toISOString(),
    },
    ctx
  );
}

function updateTechnician(id, patch, ctx = {}) {
  const existing = techniciansRepo.find(id);
  if (!existing) return null;

  const next = { ...patch, updatedAt: new Date().toISOString() };
  if (patch.name !== undefined) next.name = String(patch.name).trim();
  if (patch.role !== undefined) {
    next.role = ROLES.includes(patch.role) ? patch.role : existing.role;
  }
  if (patch.active !== undefined) next.active = !!patch.active;
  if (patch.hourlyRate !== undefined) {
    if (patch.hourlyRate === '' || patch.hourlyRate == null) {
      next.hourlyRate = null;
    } else {
      next.hourlyRate = Math.max(0, Number(patch.hourlyRate)) || 0;
    }
  }
  return techniciansRepo.update(id, next, ctx);
}

function deleteTechnician(id, ctx = {}) {
  return techniciansRepo.delete(id, ctx);
}

// Seed Jimmy as the owner-technician on first boot, so the dropdown
// isn't empty and existing jobs (which assumed "Jimmy Manharth") still
// line up with a real technician record.
function seedOwnerIfEmpty(ctx = {}) {
  if (techniciansRepo.all().length > 0) return { seeded: false };
  createTechnician(
    {
      name: 'Jimmy Manharth',
      role: 'owner',
      phone: '405-531-1034',
      email: 'jmanharth@gmail.com',
      active: true,
      notes: 'Owner and primary technician.',
    },
    { ...ctx, actor: ctx.actor || 'system', description: 'Seeded owner technician on first boot' }
  );
  return { seeded: true };
}

module.exports = {
  ROLES,
  listTechnicians,
  getTechnician,
  createTechnician,
  updateTechnician,
  deleteTechnician,
  seedOwnerIfEmpty,
  _repo: techniciansRepo,
};
