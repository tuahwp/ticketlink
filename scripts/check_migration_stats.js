const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function stats() {
  const total = await pool.query('SELECT count(*) FROM "Ticket"');
  const activeMigrated = await pool.query('SELECT count(DISTINCT "ticketId") FROM "TicketActivity" WHERE type = \'FOLLOW_UP\'');
  const totalActivities = await pool.query('SELECT count(*) FROM "TicketActivity" WHERE type = \'FOLLOW_UP\'');
  const resolvedWithRes = await pool.query('SELECT count(*) FROM "Ticket" WHERE "resolutionDetails" IS NOT NULL AND status IN (\'RESOLVED\', \'COMPLETE\', \'CLOSED\')');
  const activeRemainingWithRes = await pool.query('SELECT count(*) FROM "Ticket" WHERE "resolutionDetails" IS NOT NULL AND status NOT IN (\'RESOLVED\', \'COMPLETE\', \'CLOSED\')');
  const resolvedStatusBreakdown = await pool.query('SELECT status, count(*) FROM "Ticket" GROUP BY status ORDER BY count(*) DESC');

  console.log('--- DATABASE TICKET STATS ---');
  console.log('Total tickets in database:', total.rows[0].count);
  console.log('Tickets with migrated FOLLOW_UP activities:', activeMigrated.rows[0].count);
  console.log('Total FOLLOW_UP activities created across all tickets:', totalActivities.rows[0].count);
  console.log('Active tickets remaining with resolutionDetails:', activeRemainingWithRes.rows[0].count);
  console.log('Resolved/Complete/Closed tickets holding resolutionDetails:', resolvedWithRes.rows[0].count);
  console.log('\nStatus Breakdown:');
  console.log(resolvedStatusBreakdown.rows);
}

stats().then(() => pool.end()).catch(e => { console.error(e); pool.end(); });
