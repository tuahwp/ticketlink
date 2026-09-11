const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const { Pool } = require('pg');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function inspectUnresolvedTicketsWithResolutionDetails() {
  try {
    const res = await pool.query(`
      SELECT id, "ticketRefNo", status, "resolutionDetails", "reportedAt", "createdAt"
      FROM "Ticket"
      WHERE "resolutionDetails" IS NOT NULL 
        AND "resolutionDetails" != ''
        AND status NOT IN ('RESOLVED', 'COMPLETE', 'CLOSED')
    `);
    console.log(`Found ${res.rows.length} non-resolved tickets with resolutionDetails:`);
    for (const t of res.rows) {
      console.log(`\n--- Ticket #${t.id} (${t.ticketRefNo}) [${t.status}] ---`);
      console.log(t.resolutionDetails);
    }
  } catch (err) {
    console.error(err);
  } finally {
    await pool.end();
  }
}

inspectUnresolvedTicketsWithResolutionDetails();
