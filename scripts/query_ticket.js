const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const { Pool } = require('pg');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function run() {
  try {
    console.log("Searching for ticket IT260802017...");
    const res = await pool.query(`
      SELECT t.*, m.name as maincon_name, sp.name as partner_name, fe.name as fe_name
      FROM "Ticket" t
      LEFT JOIN "Maincon" m ON t."mainconId" = m.id
      LEFT JOIN "ServicePartner" sp ON t."partnerId" = sp.id
      LEFT JOIN "FieldEngineer" fe ON t."assignedFeId" = fe.id
      WHERE t."ticketRefNo" ILIKE '%IT260802017%' 
         OR CAST(t."customValues" AS TEXT) ILIKE '%IT260802017%'
         OR t."issueDescription" ILIKE '%IT260802017%'
    `);
    
    console.log("Result count:", res.rows.length);
    if (res.rows.length > 0) {
      for (const ticket of res.rows) {
        console.log("=== TICKET FOUND ===");
        console.log("ID:", ticket.id);
        console.log("ticketRefNo:", ticket.ticketRefNo);
        console.log("status:", ticket.status);
        console.log("subStatus:", ticket.subStatus);
        console.log("holdReason:", ticket.holdReason);
        console.log("resolutionDetails:", ticket.resolutionDetails);
        console.log("customValues:", JSON.stringify(ticket.customValues, null, 2));
        console.log("reportedAt:", ticket.reportedAt);
        console.log("createdAt:", ticket.createdAt);
        console.log("updatedAt:", ticket.updatedAt);
        console.log("serviceReportUrl:", ticket.serviceReportUrl);
        console.log("defectiveSerial:", ticket.defectiveSerial);
        console.log("defectiveReturnStatus:", ticket.defectiveReturnStatus);
        
        const actRes = await pool.query(`SELECT * FROM "TicketActivity" WHERE "ticketId" = $1 ORDER BY "createdAt" ASC`, [ticket.id]);
        console.log("=== ACTIVITIES (" + actRes.rows.length + ") ===");
        console.log(JSON.stringify(actRes.rows, null, 2));
        
        const spRes = await pool.query(`SELECT * FROM "TicketSparePart" WHERE "ticketId" = $1`, [ticket.id]);
        console.log("=== SPARE PARTS (" + spRes.rows.length + ") ===");
        console.log(JSON.stringify(spRes.rows, null, 2));
      }
    } else {
      console.log("Searching partial / all tickets to inspect columns and data structure...");
      const sample = await pool.query(`SELECT id, "ticketRefNo", status, "holdReason", "resolutionDetails", "customValues" FROM "Ticket" ORDER BY id DESC LIMIT 5`);
      console.log("Sample tickets:", JSON.stringify(sample.rows, null, 2));
    }
  } catch (err) {
    console.error("Query error:", err);
  } finally {
    await pool.end();
  }
}

run();
