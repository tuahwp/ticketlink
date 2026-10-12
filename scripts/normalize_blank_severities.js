const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const { Pool } = require('pg');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function normalizeSeverities() {
  const isDryRun = process.argv.includes('--dry-run');

  console.log('====================================================');
  console.log(`TICKET SEVERITY AUDIT & NORMALIZATION (ADR 0013)`);
  console.log(`Mode: ${isDryRun ? 'DRY-RUN (audit only, no mutations)' : 'APPLY (mutating NULL to NA)'}`);
  console.log('====================================================\n');

  // 1. Current severity distribution
  const dist = await pool.query(`
    SELECT COALESCE(severity::text, 'NULL (blank)') as severity, count(*)::int as count
    FROM "Ticket"
    GROUP BY severity
    ORDER BY count DESC
  `);
  console.log('1. Current Severity Breakdown:');
  console.table(dist.rows);

  // 2. Tickets with NULL severity AND NO slaDeadline (safe to normalize to NA)
  const safeToNormalize = await pool.query(`
    SELECT count(*)::int as count
    FROM "Ticket"
    WHERE severity IS NULL AND "slaDeadline" IS NULL
  `);
  const safeCount = safeToNormalize.rows[0].count;
  console.log(`2. Blank severity with NO SLA deadline (safe to set to NA): ${safeCount}`);

  // 3. Tickets with NULL severity BUT WITH an active slaDeadline (requires admin review)
  const reviewRequired = await pool.query(`
    SELECT id, "ticketRefNo", "clientSiteName", "state", "slaDeadline", "status", "createdAt"
    FROM "Ticket"
    WHERE severity IS NULL AND "slaDeadline" IS NOT NULL
    ORDER BY id ASC
  `);
  console.log(`3. Blank severity WITH SLA deadline (requires manual admin triage): ${reviewRequired.rows.length}`);
  if (reviewRequired.rows.length > 0) {
    console.log('\nTickets requiring manual review:');
    console.table(reviewRequired.rows.map(r => ({
      id: r.id,
      ref: r.ticketRefNo || `#${r.id}`,
      site: r.clientSiteName,
      state: r.state,
      deadline: r.slaDeadline ? new Date(r.slaDeadline).toISOString() : '-',
      status: r.status,
    })));
  }

  // 4. Apply mutation if not dry-run
  if (!isDryRun && safeCount > 0) {
    console.log(`\nApplying update: updating ${safeCount} tickets from NULL to 'NA'...`);
    const updateRes = await pool.query(`
      UPDATE "Ticket"
      SET severity = 'NA', "updatedAt" = NOW()
      WHERE severity IS NULL AND "slaDeadline" IS NULL
    `);
    console.log(`✓ Successfully updated ${updateRes.rowCount} tickets to 'NA'.`);

    // Verify final distribution
    const postDist = await pool.query(`
      SELECT COALESCE(severity::text, 'NULL (blank)') as severity, count(*)::int as count
      FROM "Ticket"
      GROUP BY severity
      ORDER BY count DESC
    `);
    console.log('\nPost-normalization Severity Breakdown:');
    console.table(postDist.rows);
  } else if (isDryRun) {
    console.log('\n[Dry-run completed. Run without --dry-run to apply normalization.]');
  } else {
    console.log('\nNo blank tickets without SLA deadline needed normalization.');
  }
}

normalizeSeverities()
  .then(() => pool.end())
  .catch((err) => {
    console.error('Audit failed:', err);
    pool.end();
  });
