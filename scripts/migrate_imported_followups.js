const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const { Pool } = require('pg');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

function parseDateFromText(text) {
  // Try matching date patterns like 03/08/2026, 18/08/2026, 18/8/2026, 19/08/26, 4/8/2026
  const dateMatch = text.match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})(?:\s+(\d{1,2}):(\d{2})\s*(AM|PM)?)?/i);
  if (dateMatch) {
    const day = parseInt(dateMatch[1], 10);
    const month = parseInt(dateMatch[2], 10) - 1;
    let year = parseInt(dateMatch[3], 10);
    if (year < 100) year += 2000;
    
    let hours = 9;
    let minutes = 0;
    if (dateMatch[4] && dateMatch[5]) {
      hours = parseInt(dateMatch[4], 10);
      minutes = parseInt(dateMatch[5], 10);
      if (dateMatch[6]) {
        const ampm = dateMatch[6].toUpperCase();
        if (ampm === 'PM' && hours < 12) hours += 12;
        if (ampm === 'AM' && hours === 12) hours = 0;
      }
    }
    const d = new Date(year, month, day, hours, minutes);
    if (!isNaN(d.getTime())) return d;
  }
  return null;
}

function splitUpdateBlocks(text) {
  if (!text || !text.trim()) return [];
  const normalized = text.replace(/\r\n/g, '\n').trim();
  
  // Split by common header delimiters like "Update from ...", "Update (...)", "Update:", etc.
  const regex = /(?=Update\s+from\s+[^\n]+|Update\s*\([^\)]+\)|Update\s*:)/gi;
  const parts = normalized.split(regex).map(p => p.trim()).filter(Boolean);
  
  if (parts.length === 0) {
    return [normalized];
  }
  return parts;
}

async function migrate() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const res = await client.query(`
      SELECT id, "ticketRefNo", status, "holdReason", "resolutionDetails", "createdAt", "reportedAt"
      FROM "Ticket"
      WHERE "resolutionDetails" IS NOT NULL 
        AND TRIM("resolutionDetails") != ''
        AND status NOT IN ('RESOLVED', 'COMPLETE', 'CLOSED')
      ORDER BY id ASC
    `);

    console.log(`Found ${res.rows.length} tickets to migrate...`);

    let migratedCount = 0;
    let totalActivitiesCreated = 0;

    for (const ticket of res.rows) {
      const rawText = ticket.resolutionDetails.trim();
      const blocks = splitUpdateBlocks(rawText);

      let extractedHoldReason = ticket.holdReason;

      for (let i = 0; i < blocks.length; i++) {
        const block = blocks[i];
        
        // Determine author
        let author = "Field Engineer";
        if (/Update from OKI/i.test(block)) author = "OKI Support";
        else if (/Update from AGS/i.test(block)) author = "AGS Team";
        else if (/Memerlukan kelulusan JPJ/i.test(block) || /tiada di dalam senarai/i.test(block)) {
          author = "System / Moderator";
          if (!extractedHoldReason) {
            extractedHoldReason = block.slice(0, 250);
          }
        }

        // Determine timestamp
        const parsedDate = parseDateFromText(block) || ticket.createdAt || new Date();

        // Check if identical activity note already exists for this ticket
        const existingAct = await client.query(`
          SELECT id FROM "TicketActivity" 
          WHERE "ticketId" = $1 AND notes = $2
        `, [ticket.id, block]);

        if (existingAct.rows.length === 0) {
          await client.query(`
            INSERT INTO "TicketActivity" ("ticketId", "type", "status", "notes", "author", "createdAt")
            VALUES ($1, $2, $3, $4, $5, $6)
          `, [
            ticket.id,
            "FOLLOW_UP",
            ticket.status,
            block,
            author,
            parsedDate
          ]);
          totalActivitiesCreated++;
        }
      }

      // Clear resolutionDetails from active ticket and update holdReason if applicable
      await client.query(`
        UPDATE "Ticket"
        SET "resolutionDetails" = NULL,
            "holdReason" = COALESCE("holdReason", $2)
        WHERE id = $1
      `, [ticket.id, extractedHoldReason]);

      migratedCount++;
    }

    await client.query('COMMIT');
    console.log(`Successfully migrated ${migratedCount} tickets.`);
    console.log(`Created ${totalActivitiesCreated} structured TicketActivity entries.`);

  } catch (err) {
    await client.query('ROLLBACK');
    console.error("Migration failed, rolled back:", err);
  } finally {
    client.release();
    await pool.end();
  }
}

migrate();
