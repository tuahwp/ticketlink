const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const { Pool } = require('pg');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function migrateAcceptedToFeAck() {
  try {
    const checkRes = await pool.query(`
      SELECT count(*)::int as count
      FROM "Ticket"
      WHERE "subStatus" = 'ACCEPTED'
    `);
    const count = checkRes.rows[0].count;
    console.log(`Found ${count} tickets with subStatus = 'ACCEPTED'`);

    if (count > 0) {
      const updateRes = await pool.query(`
        UPDATE "Ticket"
        SET "subStatus" = 'FE_ACK'
        WHERE "subStatus" = 'ACCEPTED'
      `);
      console.log(`Successfully updated ${updateRes.rowCount} tickets to subStatus = 'FE_ACK'`);
    } else {
      console.log('No tickets require migration.');
    }
  } catch (err) {
    console.error('Migration error:', err);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

migrateAcceptedToFeAck();
