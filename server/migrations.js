// One-time startup data migrations.
//
// Each migration has an `id` string that's recorded in migrations.json
// after it runs successfully. On boot, runMigrations() iterates the list,
// skips any that have already run, and only applies the ones that haven't.
// Migrations must be idempotent in practice because the marker file can
// get out of sync in edge cases (e.g. if the data volume is restored from
// a backup that predates the marker write).
//
// Migrations write through the audited repo layer so the cleanup itself
// shows up in the audit trail for Jimmy to review.

const { readJSON, writeJSON } = require('./data-dir');
const { repo } = require('./repo');
const { recordAudit } = require('./audit-helpers');

const MIGRATIONS = [
  {
    id: 'phase-1-orphan-chris-gee-cleanup',
    description:
      'Phase 1.7 + 1.8: delete the test Chris Gee job from the Completed column ' +
      'and un-orphan any lead stuck at converted without a jobId back-reference.',
    run() {
      const leadsRepo = repo('leads');
      const jobsRepo = repo('jobs');
      let actions = 0;

      // --- Phase 1.8: delete the test Chris Gee job ---
      // Narrow scope: only the job(s) that are in Completed, have no leadId,
      // and whose customer name is Chris Gee (or Christopher Gee). This will
      // only match the test artifact — real Chris Gee jobs would normally
      // have a leadId if they came through Convert to Job.
      const jobs = jobsRepo.all();
      const testJobs = jobs.filter(j => {
        const name = (j.customerName || '').trim().toLowerCase();
        return (
          (name === 'chris gee' || name === 'christopher gee') &&
          j.status === 'completed' &&
          !j.leadId
        );
      });
      for (const job of testJobs) {
        jobsRepo.delete(job.id, {
          actor: 'migration',
          description: `Phase 1.8 cleanup: removed test Chris Gee job from Completed column`,
        });
        actions++;
      }

      // --- Phase 1.7: un-orphan converted leads with no jobId ---
      // For each lead stuck at status='converted' with no jobId, try to find
      // a matching job (same customer name, phone OR email) and stamp the
      // back-references on both sides. If no match, revert the lead's status
      // to 'contacted' — the user can Convert to Job again via the proper
      // flow if they actually want a job.
      const leads = leadsRepo.all();
      const orphans = leads.filter(l => l.status === 'converted' && !l.jobId);

      for (const lead of orphans) {
        const nameKey = (lead.name || '').trim().toLowerCase();
        const phoneKey = (lead.phone || '').replace(/\D/g, '');
        const emailKey = (lead.email || '').trim().toLowerCase();

        // Reload jobs because we may have deleted some above.
        const currentJobs = jobsRepo.all();
        const match = currentJobs.find(j => {
          if (j.leadId) return false; // already linked to another lead
          const jobName = (j.customerName || '').trim().toLowerCase();
          if (jobName !== nameKey) return false;
          const jobPhone = (j.phone || '').replace(/\D/g, '');
          const jobEmail = (j.email || '').trim().toLowerCase();
          return (phoneKey && jobPhone === phoneKey) || (emailKey && jobEmail === emailKey);
        });

        if (match) {
          // Stamp both sides so the back-reference is consistent going forward.
          jobsRepo.update(
            match.id,
            { leadId: lead.id },
            {
              actor: 'migration',
              description: `Phase 1.7 cleanup: linked job back to its originating lead`,
            }
          );
          leadsRepo.update(
            lead.id,
            { jobId: match.id },
            {
              actor: 'migration',
              description: `Phase 1.7 cleanup: stamped jobId on previously-orphaned converted lead`,
            }
          );
          actions += 2;
        } else {
          // No matching job exists. Revert to contacted so the lead isn't
          // sitting in a misleading Converted state. Jimmy can re-run
          // Convert to Job through the proper flow.
          leadsRepo.update(
            lead.id,
            { status: 'contacted', jobId: null },
            {
              actor: 'migration',
              description:
                `Phase 1.7 cleanup: reverted orphaned converted lead to contacted (no matching job found)`,
            }
          );
          actions++;
        }
      }

      return {
        testJobsDeleted: testJobs.length,
        orphansLinked: orphans.length - orphans.filter(l => {
          // Re-check which orphans ended up without a back-ref
          const after = leadsRepo.find(l.id);
          return after?.status !== 'converted';
        }).length,
        orphansReverted: orphans.filter(l => {
          const after = leadsRepo.find(l.id);
          return after?.status === 'contacted';
        }).length,
        actions,
      };
    },
  },
];

function runMigrations() {
  const ran = readJSON('migrations', { applied: [] });
  const applied = new Set(ran.applied || []);
  const results = [];

  for (const m of MIGRATIONS) {
    if (applied.has(m.id)) {
      results.push({ id: m.id, skipped: true });
      continue;
    }
    try {
      const out = m.run();
      applied.add(m.id);
      results.push({ id: m.id, ok: true, details: out });

      recordAudit({
        action: 'migration',
        recordType: 'system',
        recordId: m.id,
        actor: 'migration',
        description: `Ran migration ${m.id}: ${m.description}`,
        context: out,
      });

      console.log(`[migration] ${m.id} applied:`, out);
    } catch (e) {
      results.push({ id: m.id, ok: false, error: e.message });
      console.error(`[migration] ${m.id} FAILED:`, e);
      // Don't record as applied; it'll retry next boot.
    }
  }

  writeJSON('migrations', { applied: Array.from(applied) });
  return results;
}

module.exports = { runMigrations, MIGRATIONS };
